import { Database as ArangoDatabase } from 'arangojs';
import PgDatabase from './pg-database';
import log from './log';
import Stream from './stream';

const arango = new ArangoDatabase({
  url: process.env.ARANGO_HOST,
  auth: {
    username: process.env.ARANGO_USERNAME,
    password: process.env.ARANGO_PASSWORD,
  },
});

const migrate = async (databaseName: string) => {
  console.time("migrate-timer");

  // log('Checking if database exists');
  // let database: boolean;
  // try {
  //   database = await arango.database(databaseName).exists();
  // } catch {
  //   log.err('Failed to check if database exists');
  // }
  // if (database) {
  //   log('Droping database');
  //   try {
  //     await arango.dropDatabase(databaseName);
  //   } catch {
  //     log.err('Failed to drop database');
  //   }
  // } else {
  //   log(`LOG: Database doesn't exist`);
  // }
  // log('Creating database');
  // try {
  //   await arango.createDatabase(databaseName, {
  //     users: [{ username: 'root' }],
  //   });
  // } catch {
  //   log.err('Failed to create database');
  // }


  const database = new PgDatabase({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });

  await database.init();

  log.ln('Transforming rows to nodes');


  const nodeStream = new Stream('node');
  const edgeStream = new Stream('edge');

  await database.export(nodeStream, edgeStream);
  // const tables = await getDatabaseTables();

  let edges = [];



  // for (const table of tables) {
    // await saveTableRowsToFile(
    //   table,
    //   nodeStream,
    //   edgeStream
    // );
    // edges = [...edges, ...tableEdges];
    // if (tableNodes.length) {
    //   try {
    //     await arango.database(databaseName).createCollection(table.name);
    //     await arango
    //       .database(databaseName)
    //       .collection(table.name)
    //       .import(tableNodes);
    //   } catch {
    //     log.err(`Failed to create "${table.name}" collection`);
    //   }
    // }
  // }

  await nodeStream.close();
  await edgeStream.close();

  // log.ln('Creating edges...');
  // try {
  //   await arango.database(databaseName).createEdgeCollection('edges');
  //   await arango.database(databaseName).collection('edges').import(edges);
  // } catch {
  //   log.err('Failed to create edges collection');
  // }

  console.timeEnd('migrate-timer');
  log.ln('DONE!');
  process.exit(0);
};

migrate('test');
