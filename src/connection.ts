import { Client, ClientConfig } from 'pg';

export default class Connection {
  private config: ClientConfig;
  private client: Client;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  public async init(): Promise<void> {
    this.client = new Client(this.config);

    try {
      await this.client.connect();
    } catch (err) {
      throw err;
    }
  }

  public async query<T>(query: string, values?: unknown[]) {
    return this.client.query<T>(query, values);
  }
}
