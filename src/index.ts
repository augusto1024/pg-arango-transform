import ArangoDatabase from './database/arango-database';
import PgDatabase from './database/pg-database';
import Stream from './utils/stream';

const migrate = async () => {
  console.time('migrate-timer');

  const arangoDatabase = new ArangoDatabase({
    databaseName: process.env.ARANGO_DATABASE,
    url: process.env.ARANGO_HOST,
    auth: {
      username: process.env.ARANGO_USERNAME,
      password: process.env.ARANGO_PASSWORD,
    },
  });

  const postgresDatabase = new PgDatabase({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });

  await arangoDatabase.init();
  await postgresDatabase.init();

  const stream = new Stream();

  await postgresDatabase.export(stream);

  await stream.close();

  const collections = [];

  const nodeFiles = await stream.getFileNames();
  for (const fileName of nodeFiles) {
    const collection = fileName.match(/^[^-]+/)[0];
    collection !== 'edges' && collections.push(collection);

    const file = await stream.getFile(fileName);

    await arangoDatabase.import(collection, file, {
      isEdge: collection === 'edges',
    });
  }

  await arangoDatabase.createGraph('TestGraph', collections);

  console.timeEnd('migrate-timer');
  process.exit(0);
};

migrate();
