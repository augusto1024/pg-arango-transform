import Database from './database';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';
import fs from 'fs';

const MAX_FILE_SIZE_IN_BYTES = 524288000; // 500Mb

const newWriteStream = (type: 'edge' | 'node'): fs.WriteStream => {
  const id = `./data/${type}-${new Date().valueOf()}-${uuid()}.json`;
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
  }
  return fs.createWriteStream(id);
};

/**
 * @returns all the tables belonging to the database;
 */
export const getDatabaseTables = async (): Promise<Table[]> => {
  const db = await Database.init();
  const tables: Record<string, Table> = {};
  const { rows } = await db.query<TablesQueryResponse>(
    `SELECT
      table_name as "tableName",
      column_name as "columnName",
	    table_schema as "tableSchema"
     FROM information_schema.columns where table_schema <> 'information_schema' and  table_schema <> 'pg_catalog';`
  );

  for (const row of rows) {
    if (!tables[row.tableName]) {
      tables[row.tableName] = {
        name: row.tableName,
        schema: row.tableSchema,
        columns: {},
      };
    }

    tables[row.tableName].columns[row.columnName] = {
      name: row.columnName,
    };
  }

  for (const table of Object.values(tables)) {
    const keys = await getTableKeys(table.name);
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

  return Object.values(tables);
};

/**
 * Given a table, it returns all the FOREIGN KEYS and PRIMARY KEYS
 *
 * @param tableName: The name of the table to get the keys from
 * @returns {TableKey[]} An array of keys belonging to the table
 */
export const getTableKeys = async (tableName: string): Promise<TableKey[]> => {
  const db = await Database.init();
  const { rows } = await db.query<TableKey>(
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
    WHERE tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY') AND tc.table_name='${tableName}';`
  );
  return rows;
};

export const saveTableRowsToFile = async (table: Table): Promise<void> => {
  const db = await Database.init();
  const { rows } = await db.query<TableRowsResponse>(
    `SELECT * FROM ${table.schema}.${table.name};`
  );

  let nodesFileStream: fs.WriteStream;
  let nodeFileStreamSize: number;
  let edgesFileStream: fs.WriteStream;
  let edgesFileStreamSize: number;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const node = {} as GraphNode;
    const primaryKey = Object.values(table.columns).find(
      (column) => column.isForeignKey
    );

    node._key = primaryKey ? (`${row[primaryKey.name]}` as string) : uuid();

    let edgeString = '';
    let nodeString = '';

    for (const columnName of Object.keys(row)) {
      if (table.columns[columnName].isForeignKey) {
        edgeString += `${JSON.stringify({
          _from: `${table.name}/${node._key}`,
          _to: `${table.columns[columnName].foreignTableName}/${row[columnName]}`,
        })},`;
      } else {
        node[columnName] = row[columnName];
      }
    }

    if (edgeString.length > 1) {
      if (i === rows.length - 1) {
        edgeString = edgeString.slice(0, edgeString.length - 1);
      }

      if (!edgesFileStream) {
        edgesFileStream = newWriteStream('edge');
        edgesFileStreamSize = 0;
        edgesFileStream.write('[');
      }

      edgesFileStream.write(edgeString);
      edgesFileStreamSize += Buffer.byteLength(edgeString, 'utf-8');

      if (edgesFileStreamSize > MAX_FILE_SIZE_IN_BYTES) {
        edgesFileStream.write(']');
        edgesFileStream.close();
        edgesFileStream = undefined;
      }
    }

    if (Object.keys(node).length > 0) {
      nodeString = `${JSON.stringify(node)},`;

      if (i === rows.length - 1) {
        nodeString = nodeString.slice(0, nodeString.length - 1);
      }

      if (!nodesFileStream) {
        nodesFileStream = newWriteStream('node');
        nodeFileStreamSize = 0;
        nodesFileStream.write('[');
      }

      nodesFileStream.write(nodeString);
      nodeFileStreamSize += Buffer.byteLength(nodeString, 'utf-8');

      if (nodeFileStreamSize > MAX_FILE_SIZE_IN_BYTES) {
        nodesFileStream.write(']');
        nodesFileStream.close();
        nodesFileStream = undefined;
      }
    }
  }

  if (nodesFileStream) {
    nodesFileStream.write(']');
    nodesFileStream.close();
  }

  if (edgesFileStream) {
    edgesFileStream.write(']');
    edgesFileStream.close();
  }
};
