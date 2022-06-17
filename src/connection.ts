import { Client, ClientConfig } from 'pg';
import log from './log';

export default class Connection {
  private config: ClientConfig;
  private client: Client;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  public async init(): Promise<void> {
    this.client = new Client(this.config);

    try {
      log('Connecting to Postgres database')
      await this.client.connect();
    } catch (err) {
      log.err('Failed to connect to Postgres database');
      throw err;
    }
  }

  public async query<T>(query: string, values?: unknown[]) {
    return this.client.query<T>(query, values);
  }
}
