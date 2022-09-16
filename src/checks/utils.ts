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

export const getTotalCollections = async (connection) => {
  const defaultArangoCollections = 9;
  const edgeCollection = 1;

  const totalCollections = [];
  const query = `RETURN LENGTH(COLLECTIONS())`;
  try {
    const response = await connection.query({
      query,
      bindVars: {},
    });

    for await (const id of response) {
      totalCollections.push(id);
    }
  } catch (err) {
    console.error(err.message);
  }

  return totalCollections[0] - defaultArangoCollections - edgeCollection;
};

export const getAllTables = async (connection) => {
  const { rows: tables } = await connection.query(
    `SELECT table_name as name, table_schema as schema, table_type as table_type 
      FROM information_schema.tables 
      WHERE table_schema  NOT IN ('information_schema', 'pg_catalog') 
      AND table_type = 'BASE TABLE'`
  );

  return tables;
};

export const getTableRows = async (connection, tableSchema, tableName) => {
  const { rows: totalRows } = await connection.query(
    `SELECT count(*) FROM ${tableSchema}.${tableName}`
  );

  return Number(totalRows[0].count);
};

export const getTotalNodes = async (connection, collection) => {
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
