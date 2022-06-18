import ArangoDatabase from './arango-database';
import PgDatabase from './pg-database';
import Stream from './stream';

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

  const nodeStream = new Stream('node');
  const edgeStream = new Stream('edge');

  await postgresDatabase.export(nodeStream, edgeStream);

  await nodeStream.close();
  await edgeStream.close();

  const nodeFiles = await nodeStream.getFileNames();
  for (const fileName of nodeFiles) {
    const file = await nodeStream.getFile(fileName);
    await arangoDatabase.import('test', file);
  }

  const edgeFiles = await edgeStream.getFileNames();
  for (const fileName of edgeFiles) {
    const file = await edgeStream.getFile(fileName);
    await arangoDatabase.import('edges', file);
  }

  console.timeEnd('migrate-timer');
  process.exit(0);
};

migrate();
