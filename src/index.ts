import { ClientConfig } from 'pg';
import { Config } from 'arangojs/connection';
import ArangoDatabase from './database/arango-database';
import PgDatabase from './database/pg-database';
import Stream from './utils/stream';

export type MigrateOptions = {
  createGraph?: boolean;
  graphName?: string;
};

class Transform {
  private arangoDatabase: ArangoDatabase;
  private postgresDatabase: PgDatabase;
  private notify: (message: TransformMessage) => void;

  constructor(notify?: (message: TransformMessage) => void) {
    this.notify = notify ? notify : (message: TransformMessage) => undefined;
  }

  /**
   * Establishes the connection to the Postgres database and the Arango database.
   * @param postgresConfig The configuration for the Postgres database.
   * @param arangoConfig The configuration for the Arango database.
   */
  public async init(
    postgresConfig: ClientConfig,
    arangoConfig: Config
  ): Promise<void> {
    this.arangoDatabase = new ArangoDatabase(arangoConfig, this.notify);
    this.postgresDatabase = new PgDatabase(postgresConfig, this.notify);

    try {
      await this.arangoDatabase.init();
    } catch {
      throw new Error('Failed to connect to Arango database');
    }

    try {
      await this.postgresDatabase.init();
    } catch (e) {
      throw new Error('Failed to connect to Postgres database');
    }

    this.notify({
      message: 'Succesfully connected to Arango and Postgres Databases',
      type: 'done',
    });
  }

  private checkInit(): void {
    const message = (database: string) =>
      `No ${database} database was found. Maybe forgot to run "Transformer.init()"?`;
    if (!this.arangoDatabase) {
      this.notify({
        message: message('Arango'),
        type: 'error',
      });
      throw new Error(message('Arango'));
    } else if (!this.postgresDatabase) {
      this.notify({
        message: message('Arango'),
        type: 'error',
      });
      throw new Error(message('Postgres'));
    }
  }

  /**
   * Returns an object that represents the preview graph.
   * @returns {GraphPreview} The preview Graph.
   */
  // TODO: FIX
  public async getGraphPreview(): Promise<GraphPreview> {
    this.checkInit();

    const tables = await this.postgresDatabase.getTables();

    let nodeCount = 0;

    const nodes: Record<string, number> = {};
    const edges: EdgePreview[] = [];

    // for (const table of tables) {
    //   if (!nodes[table.name]) {
    //     nodes[table.name] = nodeCount;
    //     nodeCount++;
    //   }
    //   for (const column of Object.values(table.columns)) {
    //     if (column.isForeignKey) {
    //       if (!nodes[column.foreignTableName]) {
    //         nodes[column.foreignTableName] = nodeCount;
    //         nodeCount++;
    //       }
    //       edges.push({
    //         from: nodes[table.name],
    //         to: nodes[column.foreignTableName],
    //       });
    //     }
    //   }
    // }

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

    const tables = await this.postgresDatabase.getTables();
    for (const table of tables) {
      for (const uniqueKey of table.uniqueKeys) {
        this.notify({
          message: `Creating index for ${uniqueKey.name}`,
          type: 'info',
        });
        await this.arangoDatabase.createIndex({
          collection: table.name,
          fields: uniqueKey.columns.map((attr) => attr.name),
          name: uniqueKey.name,
          unique: true,
        });
      }
    }

    await this.arangoDatabase.importFromStream(stream);

    options.createGraph &&
      (await this.arangoDatabase.createGraph(options.graphName));
  }
}

export default Transform;
