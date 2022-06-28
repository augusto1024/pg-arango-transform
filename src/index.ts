import { ClientConfig } from 'pg';
import { Config } from 'arangojs/connection';
import ArangoDatabase from './database/arango-database';
import PgDatabase from './database/pg-database';
import Stream from './utils/stream';

type MigrateOptions = {
  createGraph?: boolean;
  graphName?: string;
};

class Transform {
  private arangoDatabase: ArangoDatabase;
  private postgresDatabase: PgDatabase;

  /**
   * Establishes the connection to the Postgres database and the Arango database.
   * @param postgresConfig The configuration for the Postgres database.
   * @param arangoConfig The configuration for the Arango database.
   */
  public async init(
    postgresConfig: ClientConfig,
    arangoConfig: Config
  ): Promise<void> {
    this.arangoDatabase = new ArangoDatabase(arangoConfig);
    this.postgresDatabase = new PgDatabase(postgresConfig);

    try {
      await this.arangoDatabase.init();
    } catch {
      throw new Error('Failed to connect to Arango database');
    }

    try {
      await this.postgresDatabase.init();
    } catch {
      throw new Error('Failed to connect to Postgres database');
    }
  }

  private checkInit(): void {
    const message = (database: string) =>
      `No ${database} database was found. Maybe forgot to run "Transformer.init()"?`;
    if (!this.arangoDatabase) {
      throw new Error(message('Arango'));
    } else if (!this.postgresDatabase) {
      throw new Error(message('Postgres'));
    }
  }

  /**
   * Returns an object that represents the preview graph.
   * @returns {GraphPreview} The preview Graph.
   */
  public async getGraphPreview(): Promise<GraphPreview> {
    this.checkInit();

    const tables = await this.postgresDatabase.getTables();

    let nodeCount = 0;

    const nodes: Record<string, number> = {};
    const edges: EdgePreview[] = [];

    for (const table of tables) {
      if (!nodes[table.name]) {
        nodes[table.name] = nodeCount;
        nodeCount++;
      }
      for (const column of Object.values(table.columns)) {
        if (column.isForeignKey) {
          if (!nodes[column.foreignTableName]) {
            nodes[column.foreignTableName] = nodeCount;
            nodeCount++;
          }
          edges.push({ from: nodes[table.name], to: nodes[column.foreignTableName] });
        }
      }
    }

    return {
      nodes: Object.keys(nodes).map((label) => ({ id: nodes[label], label })),
      edges,
    };
  }

  /**
   * Migrates the Postgres database to the Arango database.
   * @param options An options object containing the following properties:
   * - createGraph: If true, a graph gets created automatically.
   * - graphName: The name of the graph.
   * - saveTransformFiles: If true, the transformation files will be saved.
   * - transformFilesPath: The path for the directory to store the transformation files.
   */
  public async migrate(options: MigrateOptions = {}): Promise<void> {
    this.checkInit();

    if (options.createGraph && !options.graphName) {
      throw new Error(
        'You need to set the graph name in order to create it. Please set the "graphName" property to the graph name.'
      );
    }

    const stream = new Stream();

    await this.postgresDatabase.export(stream);

    await stream.close();

    const collections = [];

    const nodeFiles = await stream.getFileNames();
    for (const fileName of nodeFiles) {
      const collection = fileName.match(/^[^-]+/)[0];
      collection !== 'edges' && collections.push(collection);

      const file = await stream.getFile(fileName);

      await this.arangoDatabase.import(collection, file, {
        isEdge: collection === 'edges',
      });
    }

    options.createGraph &&
      (await this.arangoDatabase.createGraph(options.graphName, collections));
  }
}

export default Transform;
