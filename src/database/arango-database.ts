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
    nodes: GraphEdge[] | GraphNode[],
    options?: {
      isEdge: boolean;
      hasQuery?: boolean;
      foreignCollection?: string;
    }
  ): Promise<void> {
    const collectionExists = await this.connection
      .collection(collection)
      .exists();

    if (options?.isEdge) {
      let edges = nodes;
      if (options?.hasQuery) {
        edges = await this.getNodeIDs(nodes, options.foreignCollection);
      }

      !collectionExists &&
        (await this.connection.createEdgeCollection(collection));
      await this.connection.collection(collection).import(edges);
    } else {
      !collectionExists && (await this.connection.createCollection(collection));
      await this.connection.collection(collection).import(nodes);
    }
  }

  /**
   *
   * @param queryEdges The collections of edges that need to search for an id
   * @param collection The name of the collection where the node belongs
   */
  public async getNodeIDs(queryEdges, collection) {
    const matches = queryEdges.map((edge) => edge._to);
    const ids = [];

    const query = `FOR node IN ${collection}
                FILTER MATCHES(
                node, ${JSON.stringify(matches)}, false)
                RETURN node._id`;
    try {
      const response = await this.connection.query({
        query,
        bindVars: {},
      });

      for await (const id of response) {
        ids.push(id);
      }
    } catch (err) {
      console.error(err.message);
    }

    return queryEdges.map((edge, index) => ({ ...edge, _to: ids[index] }));
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
