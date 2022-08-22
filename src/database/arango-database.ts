import { Database } from 'arangojs';
import { Config } from 'arangojs/connection';
import Stream from '../utils/stream';
import { MigrationDatabase } from './database';
import {
  EDGE_PREFIX,
  EDGE_QUERY_PREFIX,
  NODE_FILE_REGEX,
  EDGE_QUERY_FILE_REGEX,
} from '../utils/constants';

class ArangoDatabase extends MigrationDatabase {
  private config: Config;
  private connection: Database;

  constructor(config: Config, notify?: (message: TransformMessage) => void) {
    super(notify);
    this.config = config;
  }

  /**
   * Establishes a connection with the database and checks if the
   * database exists.
   */
  public async init(): Promise<void> {
    try {
      this.notify({ message: 'Connecting to Arango database', type: 'info' });
      this.connection = new Database(this.config);
      const exists = await this.connection.exists();

      if (!exists) {
        this.notify({
          message: 'Failed to connect to Arango database',
          type: 'error',
        });
        throw new Error("The database doesn't exist");
      }
    } catch (err) {
      this.notify({
        message: 'Failed to connect to Arango database',
        type: 'error',
      });
      throw err;
    }

    this.notify({
      message: 'Successfully connected to Arango database',
    });
  }

  public async importFromStream(stream: Stream) {
    const collections = [];

    const files = await stream.getFileNames();
    const nodeFiles = files.filter(
      (file) =>
        !file.startsWith(EDGE_PREFIX) && !file.startsWith(EDGE_QUERY_PREFIX)
    );

    const edgeFiles = files.filter((file) => file.startsWith(EDGE_PREFIX));
    const edgeQueryFiles = files.filter((file) =>
      file.startsWith(EDGE_QUERY_PREFIX)
    );

    const nodeFileRegExp = new RegExp(NODE_FILE_REGEX);

    this.notify({
      message: 'Importing nodes into Arango database',
      type: 'info',
    });

    for (const fileName of nodeFiles) {
      const collection = fileName.match(nodeFileRegExp)[0];
      try {
        const file = await stream.getFile(fileName);

        await this.import(collection, file as GraphNode[], {
          isEdge: false,
        });

        collections.push(collection);
      } catch (err) {
        this.notify({
          message: `Failed to import ${collection}`,
          type: 'error',
        });
        throw err;
      }
    }

    this.notify({
      message: 'Importing edges into Arango database',
      type: 'info',
    });

    for (const fileName of edgeFiles) {
      try {
        const file = await stream.getFile(fileName);

        await this.import('edges', file as GraphEdge[], {
          isEdge: true,
        });
      } catch (err) {
        this.notify({
          message: 'Failed to import edges',
          type: 'error',
        });
      }
    }

    const edgeQueryFileRegExp = new RegExp(EDGE_QUERY_FILE_REGEX);

    for (const fileName of edgeQueryFiles) {
      try {
        const foreignCollection = fileName.match(edgeQueryFileRegExp)[1];
        const file = await stream.getFile(fileName);

        await this.import('edges', file as GraphEdge[], {
          isEdge: true,
          hasQuery: true,
          foreignCollection,
        });
      } catch (err) {
        this.notify({
          message: 'Failed to import edges',
          type: 'error',
        });
      }
    }

    this.notify({
      message: 'Nodes and edges succesfully imported into Arango database',
      type: 'done',
    });
  }

  /**
   *
   * @param collection The name of the collection to import.
   * @param nodes The nodes to insert into the collection.
   * @param options Options object. "isEdge" stablishes if the collection should be an edge collection or not.
   */
  private async import(
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
  public async createGraph(name: string): Promise<void> {
    const collections = await this.connection.collections();
    const collectionsNames = collections.map((collection) => collection.name);

    await this.connection.createGraph(name, [
      {
        collection: 'edges',
        from: collectionsNames,
        to: collectionsNames,
      },
    ]);
  }
}

export default ArangoDatabase;
