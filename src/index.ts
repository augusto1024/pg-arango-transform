import { getTables, transforRowsToNodes } from './functions';
import { Database } from 'arangojs';
import log from './log';

const arango = new Database({
  url: process.env.ARANGO_HOST,
  auth: {
    username: process.env.ARANGO_USERNAME,
    password: process.env.ARANGO_PASSWORD,
  },
});

const migrate = async (databaseName: string) => {
  console.time("migrate-timer");

  log('Checking if database exists');
  let database: boolean;
  try {
    database = await arango.database(databaseName).exists();
  } catch {
    log.err('Failed to check if database exists');
  }
  if (database) {
    log('Droping database');
    try {
      await arango.dropDatabase(databaseName);
    } catch {
      log.err('Failed to drop database');
    }
  } else {
    log(`LOG: Database doesn't exist`);
  }
  log('Creating database');
  try {
    await arango.createDatabase(databaseName, {
      users: [{ username: 'root' }],
    });
  } catch {
    log.err('Failed to create database');
  }

  log.ln('Fetching tables');
  const tables = await getTables();

  let edges = [];

  log.ln('Transforming rows to nodes');
  for (const table of tables) {
    const { nodes: tableNodes, edges: tableEdges } = await transforRowsToNodes(
      table
    );
    edges = [...edges, ...tableEdges];
    if (tableNodes.length) {
      try {
        await arango.database(databaseName).createCollection(table.name);
        await arango
          .database(databaseName)
          .collection(table.name)
          .import(tableNodes);
      } catch {
        log.err(`Failed to create "${table.name}" collection`);
      }
    }
  }

  log.ln('Creating edges...');
  try {
    await arango.database(databaseName).createEdgeCollection('edges');
    await arango.database(databaseName).collection('edges').import(edges);
  } catch {
    log.err('Failed to create edges collection');
  }

  console.timeEnd('migrate-timer');
  log.ln('DONE!');
  process.exit(0);
};

migrate('test');
