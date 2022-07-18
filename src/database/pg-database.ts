import { Client, ClientConfig } from 'pg';
import Stream from '../utils/stream';
import { v4 as uuid } from 'uuid';
import { EDGE_PREFIX } from '../utils/constants';

const PAGE_SIZE = 5000;
export default class PgDatabase {
  private config: ClientConfig;
  private connection: Client;
  private tables: Table[];

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * Establishes a connection with the database and gets the information
   * of all of its tables.
   */
  public async init(): Promise<void> {
    this.connection = new Client(this.config);
    await this.connection.connect();
    this.tables = await this.getTables();
  }

  /**
   * It saves all the rows on the database tables as nodes or edges into JSON files.
   * @param stream The Stream in which nodes/edges will be written.
   */
  public async export(stream: Stream): Promise<void> {
    if (!this.tables) {
      throw new Error(
        'ERROR: Database must be initialized before exporting it'
      );
    }

    await Promise.all(
      this.tables.map((table) => this.exportTable(table, stream))
    );
  }

  /**
   * Given a table in the database, it gets all the rows in it and saves them as node objects in the
   * nodes JSON file.
   * If a column in the table is a foreign key, it will not be saved as a node object, but it will be save
   * as an edge object instead in the edges JSON file.
   * @param {Table} table The Table object representing the table in the database.
   * @param stream The Stream in which nodes/edges will be written.
   */
  private async exportTable(table: Table, stream: Stream) {
    let done = false;
    let page = 0;

    const foreignKeyColumns = table.foreignKeys
      .map((foreignKey) => foreignKey.columns.map((column) => column.name))
      .flat();
    const columnsThatBelongToNode = table.primaryKey
      .map((column) => column.name)
      .filter((column) => !foreignKeyColumns.includes(column))
      .concat(table.regularColumns.map((column) => column.name));

    while (!done) {
      const { rows } = await this.connection.query<TableRowsResponse>(
        `SELECT * FROM ${table.schema}.${table.name} OFFSET $1 LIMIT $2;`,
        [page * PAGE_SIZE, PAGE_SIZE]
      );

      if (!rows.length) {
        done = true;
        break;
      }

      // Go through every row in the query response
      for (const row of rows) {
        // If the primary key is composite, the resulting key in the Arango database will be
        // "tableName/attr1-attr2-...-attrN"
        const node = {
          _key:
            Object.values(table.primaryKey)
              .map((column) => row[column.name])
              .join('-') || uuid(),
        } as GraphNode;

        // Insert in node all the attributes that don't to a foreign key
        for (const column of columnsThatBelongToNode) {
          node[column] = row[column];
        }
        await stream.push(table.name, node);

        // Insert in node all the attributes that belong to a foreign key (assuming they are FK to a PK)
        for (const foreignKey of table.foreignKeys) {
          const edge = {
            _from: `${table.name}/${node._key}`,
            _to: `${foreignKey.referencedTable}/${foreignKey.columns
              .map((column) => row[column.name])
              .join('-')}`,
          };
          await stream.push(`${EDGE_PREFIX}${table.name}`, edge);
        }
      }

      page += 1;
    }
  }

  /**
   * @returns all the tables belonging to the database.
   */
  public async getTables(): Promise<Table[]> {
    if (this.tables) {
      return this.tables;
    }

    // Get all columns from all tables in the database
    const { rows: columns } = await this.connection.query<TablesQueryResponse>(
      `SELECT
        table_name AS "tableName",
        column_name AS "columnName",
	      table_schema AS "tableSchema"
      FROM information_schema.columns WHERE table_schema <> 'information_schema' AND  table_schema <> 'pg_catalog';`
    );

    // Generate tables object (containing table name, table schema and unfiltered columns)
    const tables: Record<string, Table> = columns.reduce((tablesObj, row) => {
      if (!tablesObj[row.tableName]) {
        tablesObj[row.tableName] = {
          name: row.tableName,
          schema: row.tableSchema,
          regularColumns: columns
            .filter((column) => column.tableName === row.tableName)
            .map((column) => ({
              name: column.columnName,
            })),
          primaryKey: [],
          foreignKeys: [],
        };
      }
      return tablesObj;
    }, {} as Record<string, Table>);

    for (const table of Object.values(tables)) {
      let [foreignKeys, primaryKeys] = await Promise.all([
        this.getForeignKeys(table.name),
        this.getPrimaryKey(table.name),
      ]);

      table.foreignKeys = foreignKeys;
      table.primaryKey = primaryKeys;

      const tableKeyColumns = table.primaryKey
        .map((column) => column.name)
        .concat(
          table.foreignKeys
            .map((foreignKey) =>
              foreignKey.columns.map((column) => column.name)
            )
            .flat()
        );

      // Remove from table object all the columns that belong to a primary or foreign key
      table.regularColumns = table.regularColumns.filter(
        (column) => !tableKeyColumns.includes(column.name)
      );
    }

    return Object.values(tables);
  }

  /**
   * @param tableName The name of the table from where to get the primary key
   * @returns An array of columns that form the primary key
   */
  private async getPrimaryKey(tableName: string): Promise<Column[]> {
    const { rows: columns } = await this.connection.query<Column>(
      `SELECT
        ccu.column_name AS "name"
      FROM
        information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name=$1;`,
      [tableName]
    );
    return columns;
  }

  /**
   * @param tableName The name of the table from where to get the foreign keys
   * @returns The foreign keys of the table
   */
  private async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    const { rows: foreignKeyColumns } = await this.connection.query<{
      columnName: string;
      constraintName: string;
    }>(
      `SELECT
        kcu.column_name AS "columnName",
        tc.constraint_name AS "constraintName"
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;`,
      [tableName]
    );

    if (!foreignKeyColumns.length) return [];

    const constraints = foreignKeyColumns.reduce((constraintNames, column) => {
      if (!constraintNames.includes(column.constraintName)) {
        constraintNames.push(column.constraintName);
      }
      return constraintNames;
    }, []);

    const { rows: constraintColumns } = await this.connection.query<{
      constraintName: string;
      foreignColumnName: string;
      foreignTableName: string;
    }>(
      `SELECT
        ccu.constraint_name as "constraintName",
        ccu.column_name as "foreignColumnName",
        ccu.table_name as "foreignTableName"
      FROM information_schema.constraint_column_usage ccu
      WHERE ccu.constraint_name = ANY($1)`,
      [constraints]
    );

    const foreignKeys = foreignKeyColumns.map((foreignKeyColumn, index) => ({
      ...foreignKeyColumn,
      ...constraintColumns[index],
    }));

    return Object.values(
      foreignKeys.reduce((keys, key) => {
        if (keys[key.foreignTableName]) {
          keys[key.foreignTableName].columns.push({
            name: key.columnName,
            referencedColumn: key.foreignColumnName,
          });
        } else {
          keys[key.foreignTableName] = {
            name: key.constraintName,
            referencedTable: key.foreignTableName,
            columns: [
              {
                name: key.columnName,
                referencedColumn: key.foreignColumnName,
              },
            ],
          };
        }
        return keys;
      }, {} as Record<string, ForeignKey>)
    );
  }
}
