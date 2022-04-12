import Database from './database';
import { v4 as uuid } from 'uuid';
import 'dotenv/config'

export const getTables = async (): Promise<Table[]> => {
  const db = await Database.init();
  const tables: Record<string, Table> = {};
  const { rows } = await db.query<TablesQueryResponse>(
    `SELECT
      table_name as "tableName",
      column_name as "columnName",
      is_nullable as "isNullable",
      data_type as "dataType",
      character_maximum_length as "characterMaximumLength"
    FROM information_schema.columns
    WHERE table_schema = 'public';`
  );

  for (const row of rows) {
    if (!tables[row.tableName]) {
      tables[row.tableName] = {
        name: row.tableName,
        columns: {},
      };
    }

    tables[row.tableName].columns[row.columnName] = {
      name: row.columnName,
      nullable: row.isNullable,
      type: row.dataType,
      maxLen: row.characterMaximumLength,
    };
  }

  for (const table of Object.values(tables)) {
    const keys = await getKeys(table.name);
    keys.forEach((key) => {
      const column = tables[table.name].columns[key.columnName];
      if (key.type === 'FOREIGN KEY') {
        column.isForeignKey = true;
        column.foreignColumnName = key.foreignColumnName;
        column.foreignTableName = key.foreignTableName;
      } else {
        column.isPrimaryKey = true;
      }
    });
  }

  const output = Object.values(tables);
  output.forEach((table) => {
    if (
      Object.values(table.columns).filter((column) => column.isForeignKey)
        .length > 1
    ) {
      table.isCollection = true;
    }
  });

  return output;
};

export const getKeys = async (
  tableName: string
): Promise<TableKeysResponse[]> => {
  const db = await Database.init();
  const { rows } = await db.query<TableKeysResponse>(
    `SELECT
      kcu.column_name AS "columnName",
      tc.constraint_type AS type,
      ccu.table_name AS "foreignTableName",
      ccu.column_name AS "foreignColumnName"
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type in ('FOREIGN KEY', 'PRIMARY KEY') AND tc.table_name='${tableName}';`
  );
  return rows;
};

export const transforRowsToNodes = async (
  table: Table
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> => {
  const db = await Database.init();
  const { rows } = await db.query<TableRowsResponse>(
    `select * from ${table.name};`
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const row of rows) {
    const node = {} as GraphNode;
    const primaryKey = Object.values(table.columns).find(
      (column) => column.isPrimaryKey
    );

    node._key = primaryKey ? (row[primaryKey.name] as string) : uuid();

    for (const columnName of Object.keys(row)) {
      if (table.columns[columnName].isForeignKey) {
        edges.push({
          _from: `${table.name}/${node._key}`,
          _to: `${table.columns[columnName].foreignTableName}/${row[columnName]}`,
        });
      } else {
        node[columnName] = row[columnName];
      }
    }

    nodes.push(node);
  }

  return { nodes, edges };
};
