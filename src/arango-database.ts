import { Database } from 'arangojs';
import { Config } from "arangojs/connection";

class ArangoDatabase {
  private config: Config;
  private connection: Database;

  constructor(config: Config) {
    this.config = config;
  }

  public async init() {
    this.connection = new Database(this.config);
    const exists = await this.connection.exists();
    if (!exists) {
      throw new Error("The database doesn't exist");
    }
  }

  public async import(tableName: string, nodes: Record<string, unknown>[]): Promise<void> {
    await this.connection.createCollection(tableName);
    await this.connection.collection(tableName).import(nodes);
  }
}

export default ArangoDatabase;
