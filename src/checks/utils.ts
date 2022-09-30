import { ClientConfig, Client } from 'pg';
import { Config } from 'arangojs/connection';
import { CollectionType, Database } from 'arangojs';

export const getDatabasesConfig = () => {
  const postgresConfig = {
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  };

  const arangoConfig = {
    databaseName: process.env.ARANGO_DATABASE,
    url: process.env.ARANGO_HOST,
    auth: {
      username: process.env.ARANGO_USERNAME,
      password: process.env.ARANGO_PASSWORD,
    },
  };

  return { postgresConfig, arangoConfig };
};

export const getTotalCollections = async (connection: Database) => {
  const collections = (await connection.listCollections()).filter(
    (collection) => collection.type !== CollectionType.EDGE_COLLECTION
  );

  return collections.length;
};

export const getAllTables = async (connection: Client) => {
  const { rows: tables } = await connection.query(
    `SELECT table_name as name, table_schema as schema, table_type as table_type 
      FROM information_schema.tables 
      WHERE table_schema  NOT IN ('information_schema', 'pg_catalog') 
      AND table_type = 'BASE TABLE'`
  );

  return tables;
};

export const getTableRows = async (
  connection: Client,
  tableSchema: string,
  tableName: string
) => {
  const { rows: totalRows } = await connection.query(
    `SELECT count(*) FROM ${tableSchema}.${tableName}`
  );

  return Number(totalRows[0].count);
};

export const getTotalNodes = async (
  connection: Database,
  collection: string
) => {
  const totalNodes = [];
  const query = `RETURN LENGTH(${collection})`;
  try {
    const response = await connection.query({
      query,
      bindVars: {},
    });

    for await (const id of response) {
      totalNodes.push(id);
    }
  } catch (err) {
    console.error(err.message);
  }

  return totalNodes[0];
};

export const setPostgressConnection = async (postgresConfig: ClientConfig) => {
  const connection = new Client(postgresConfig);
  await connection.connect();

  return connection;
};

export const setArangoConnection = async (arangoConfig: Config) => {
  const connection = new Database(arangoConfig);
  const exists = await connection.exists();
  if (!exists) {
    throw new Error("ArangoDB database doesn't exist");
  }

  return connection;
};
