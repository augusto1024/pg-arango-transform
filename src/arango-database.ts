import { Database } from 'arangojs';
import { Config } from 'arangojs/connection';

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

  public async import(
    collection: string,
    nodes: Record<string, unknown>[],
    options?: { isEdge: boolean }
  ): Promise<void> {
    if (options?.isEdge) {
      await this.connection.createEdgeCollection(collection);
      await this.connection.collection(collection).import(nodes);
    } else {
      await this.connection.createCollection(collection);
      await this.connection.collection(collection).import(nodes);
    }
  }
}

export default ArangoDatabase;
