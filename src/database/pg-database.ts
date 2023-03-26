import pg, { Client, ClientConfig } from 'pg';
import { v4 as uuid } from 'uuid';
import { difference } from 'lodash';

import Stream from '../utils/stream';
import { EDGE_PREFIX, EDGE_QUERY_PREFIX } from '../utils/constants';
import {
  GET_TABLES,
  GET_PRIMARY_KEYS,
  GET_FOREIGN_KEY,
  GET_FOREIGN_KEY_TABLE_INFO,
  GET_UNIQUE_KEY,
  GET_FOREIGN_PK,
} from './queries';
import { MigrationDatabase } from './database';

pg.types.setTypeParser(1114, (stringValue) => stringValue); //1114 for time without timezone type;
pg.types.setTypeParser(1082, (stringValue) => stringValue); //1082 for date type

const QUERY_RESULT_SIZE = 50000;

const removeForbiddenCharacters = (str) =>
  str.replace(/[^A-Za-z0-9_\-:.@()+,=;$!*'%]/g, '');
export default class PgDatabase extends MigrationDatabase {
  private config: ClientConfig;
  private connection: Client;
  private tables: Table[];

  constructor(
    config: ClientConfig,
    notify?: (message: TransformMessage) => void
  ) {
    super(notify);
    this.config = config;
  }

  /**
   * Establishes a connection with the database and gets the information
   * of all of its tables.
   */
  public async init(): Promise<void> {
    this.connection = new Client(this.config);
    try {
      this.notify({ message: 'Connecting to Postgres database', type: 'info' });
      await this.connection.connect();
    } catch (err) {
      this.notify({
        message: 'Failed to connect to Postgres database',
        type: 'error',
      });
      throw err;
    }

    try {
      this.notify({ message: 'Fetching schema information' });
      this.tables = await this.getTables();
      this.notify({ message: `${this.tables.length} tables found` });
    } catch (err) {
      this.notify({
        message: 'Failed to fetch schema information',
        type: 'error',
      });
      throw err;
    }

    this.notify({
      message: 'Successfully connected to Postgres database',
    });
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

    let convertedTables = 0;

    this.notify({ message: 'Exporting tables to files', type: 'info' });
    this.notify({
      message: `${convertedTables} of ${this.tables.length} tables saved`,
    });

    await this.connection.query('BEGIN;');

    await Promise.all(
      this.tables.map((table) =>
        this.exportTable(table, stream)
          .then(() => {
            convertedTables = convertedTables + 1;
            this.notify({
              message: `${convertedTables} of ${this.tables.length} tables saved`,
            });
          })
          .catch((err) => {
            this.notify({
              message: `Failed to export table "${table.name}"`,
              type: 'error',
            });
            throw err;
          })
      )
    ).then(async () => await stream.close());

    await this.connection.query('COMMIT;');

    this.notify({
      message: `Tables exported successfully`,
      type: 'done',
    });
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

    const foreignKeyColumns = table.foreignKeys
      .map((foreignKey) => foreignKey.columns.map((column) => column.name))
      .flat(); // name of foreign key columns

    const columnsThatBelongToNode = table.allColumns
      .map((column) => column.name)
      .filter((column) => !foreignKeyColumns.includes(column));

    // If the primary key is composite, the resulting key in the Arango database will be
    // "tableName/attr1-attr2-...-attrN"
    const generateNodeKey = (row: Record<string, unknown>): string =>
      removeForbiddenCharacters(
        table.primaryKey.map(({ name }) => row[name]?.toString()).join('-')
      ) || uuid();

    const cursorName = `${table.name}_cursor`;

    await this.connection.query(`
      DECLARE ${cursorName} CURSOR FOR SELECT * FROM ${table.schema}.${table.name};
    `);

    while (!done) {
      // Get rows from table
      const { rows } = await this.connection.query<TableRowsResponse>(
        `FETCH ${QUERY_RESULT_SIZE} FROM ${cursorName};`
      );

      if (!rows.length) {
        done = true;
        break;
      }

      // Go through every row in the query response
      for (const row of rows) {
        const node = {
          _key: generateNodeKey(row),
        } as GraphNode;

        // Insert in node all the attributes that don't belong to a foreign key
        for (const column of columnsThatBelongToNode) {
          node[column] = row[column];
        }
        await stream.push(table.name, node);

        // Insert in edges all the attributes that belong to a foreign key
        for (const foreignKey of table.foreignKeys) {
          let prefix;
          let tableName;
          let edge;

          if (foreignKey.pointsToPK) {
            edge = {
              _from: `${table.name}/${node._key}`,
              _to: `${foreignKey.foreignTable}/${removeForbiddenCharacters(
                foreignKey.columns
                  .map((key) => row[key.name]?.toString())
                  .join('-')
              )}`,
            };
            prefix = EDGE_PREFIX;
            tableName = table.name;
          } else {
            const filters = foreignKey.columns.reduce((acc, column) => {
              return { ...acc, [column.foreignColumn]: row[column.name] };
            }, {});

            edge = {
              _from: `${table.name}/${node._key}`,
              _to: filters,
            };
            prefix = EDGE_QUERY_PREFIX;
            tableName = foreignKey.foreignTable;
          }

          await stream.push(`${prefix}${tableName}`, edge);
        }
      }
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
      GET_TABLES
    );

    // Generate tables object (containing table name, table schema and unfiltered columns)
    const tables: Record<string, Table> = columns.reduce((tablesObj, row) => {
      if (!tablesObj[row.tableName]) {
        tablesObj[row.tableName] = {
          name: row.tableName,
          schema: row.tableSchema,
          allColumns: columns
            .filter((column) => column.tableName === row.tableName)
            .map(
              (column): Column => ({
                name: column.columnName,
              })
            ),
          primaryKey: [],
          foreignKeys: [],
        } as Table;
      }
      return tablesObj;
    }, {} as Record<string, Table>);

    for (const table of Object.values(tables)) {
      let [foreignKeys, primaryKeys, uniqueKeys] = await Promise.all([
        this.getForeignKeys(table.name),
        this.getPrimaryKey(table.name),
        this.getUniqueKeys(table.name),
      ]);

      table.foreignKeys = foreignKeys;
      table.primaryKey = primaryKeys;
      table.uniqueKeys = uniqueKeys;
    }

    return Object.values(tables);
  }

  /**
   * @param tableName The name of the table from where to get the primary key
   * @returns An array of columns that form the primary key
   */
  private async getPrimaryKey(tableName: string): Promise<Column[]> {
    const { rows: columns } = await this.connection.query<Column>(
      GET_PRIMARY_KEYS,
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
    }>(GET_FOREIGN_KEY, [tableName]);

    if (!foreignKeyColumns.length) return [];

    const constraints = foreignKeyColumns.reduce((constraintNames, column) => {
      if (!constraintNames.includes(column.constraintName)) {
        constraintNames.push(column.constraintName);
      }
      return constraintNames;
    }, []);

    // Get full foreign key information
    const { rows: foreignKeys } = await this.connection.query<{
      columnName: string;
      constraintName: string;
      foreignColumnName: string;
      foreignTableName: string;
    }>(GET_FOREIGN_KEY_TABLE_INFO, [constraints]);

    const foreignTableNames = foreignKeys.map((key) => key.foreignTableName);
    const { rows: foreignTablePrimaryKey } = await this.connection.query<{
      primaryKey: string;
      tableName: string;
    }>(GET_FOREIGN_PK, [foreignTableNames]);

    const keys = Object.values(
      foreignKeys.reduce((keys, key) => {
        if (keys[key.foreignTableName]) {
          keys[key.foreignTableName].columns.push({
            name: key.columnName,
            foreignColumn: key.foreignColumnName,
          });
        } else {
          keys[key.foreignTableName] = {
            name: key.constraintName,
            foreignTable: key.foreignTableName,
            pointsToPK: undefined,
            columns: [
              {
                name: key.columnName,
                foreignColumn: key.foreignColumnName,
              },
            ],
          };
        }
        return keys;
      }, {} as Record<string, ForeignKey>)
    );

    // "pointsToPK" attribute on the FK
    const FKs = keys.map((key) => {
      const primaryKeys = foreignTablePrimaryKey
        .filter((pk) => pk.tableName === key.foreignTable)
        .map(({ primaryKey }) => primaryKey);

      const foreignKeyColumns = key.columns.map(
        ({ foreignColumn }) => foreignColumn
      );

      const pointsToPK =
        difference([...new Set(primaryKeys)], [...new Set(foreignKeyColumns)])
          .length === 0;
      return { ...key, pointsToPK };
    });

    return FKs;
  }

  /**
   * @param tableName The name of the table from where to get the unique keys
   * @returns The unique keys of the table
   */
  private async getUniqueKeys(tableName: string): Promise<UniqueKey[]> {
    const { rows: uniqueKeyColumns } = await this.connection.query<{
      columnName: string;
      constraintName: string;
    }>(GET_UNIQUE_KEY, [tableName]);

    if (!uniqueKeyColumns.length) return [];

    return Object.values(
      uniqueKeyColumns.reduce((keys, key) => {
        if (keys[key.constraintName]) {
          keys[key.constraintName].columns.push({
            name: key.columnName,
          });
        } else {
          keys[key.constraintName] = {
            name: key.constraintName,
            columns: [
              {
                name: key.columnName,
              },
            ],
          };
        }
        return keys;
      }, {} as Record<string, UniqueKey>)
    );
  }
}
