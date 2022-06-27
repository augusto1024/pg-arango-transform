import { Database } from 'arangojs';
import { Config } from 'arangojs/connection';

class ArangoDatabase {
  private config: Config;
  private connection: Database;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Establishes a connection with the database and checks if the
   * database exists.
   */
  public async init(): Promise<void> {
    this.connection = new Database(this.config);
    const exists = await this.connection.exists();
    if (!exists) {
      throw new Error("The database doesn't exist");
    }
  }

  /**
   *
   * @param collection The name of the collection to import.
   * @param nodes The nodes to insert into the collection.
   * @param options Options object. "isEdge" stablishes if the collection should be an edge collection or not.
   */
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

  /**
   *
   * @param name The name of the graph.
   * @param collections The collection names to add to the graph.
   */
  public async createGraph(name: string, collections: string[]): Promise<void> {
    await this.connection.createGraph(name, [
      {
        collection: 'edges',
        from: collections,
        to: collections,
      },
    ]);
  }
}

export default ArangoDatabase;
