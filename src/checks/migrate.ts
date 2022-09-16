import { ClientConfig, Client } from 'pg';
import { Database } from 'arangojs';
import { Config } from 'arangojs/connection';

import Transform, { MigrateOptions } from '../index';
import { getDatabasesConfig } from './utils';

export const migrateDatabase = async (
  postgresConfig: ClientConfig,
  arangoConfig: Config,
  options: MigrateOptions = {}
) => {
  const transform = new Transform();

  try {
    await transform.init(postgresConfig, arangoConfig);
  } catch (error) {
    throw new Error(error);
  }

  try {
    await transform.migrate(options);
    console.log('Migration success');
  } catch (error) {
    throw new Error(error);
  }
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

const { postgresConfig, arangoConfig } = getDatabasesConfig();

const options = { createGraph: true, graphName: process.env.ARANGO_DATABASE };

migrateDatabase(postgresConfig, arangoConfig, options);
