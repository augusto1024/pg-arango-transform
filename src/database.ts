import { Client } from 'pg';
import log from './log';

export default class Database {
  private static instance: Database;
  private client: Client;

  public static async init(): Promise<Database> {
    if (!this.instance) {
      const instance = new Database();

      const client = new Client({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT, 10) || 5432,
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
      });

      try {
        log('Connecting to Postgres database')
        await client.connect();
      } catch (err) {
        log.err('Failed to connect to Postgres database');
        throw err;
      }

      instance.client = client;
      this.instance = instance;
    }

    return this.instance;
  }

  public async query<T>(query: string, values?: unknown[]) {
    return this.client.query<T>(query, values);
  }
}
