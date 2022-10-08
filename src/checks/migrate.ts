import Transform from '../index';
import { getDatabasesConfig } from './utils';

(async function () {
  const { postgresConfig, arangoConfig } = getDatabasesConfig();

  const transform = new Transform((message) => console.log(message));

  try {
    await transform.init(postgresConfig, arangoConfig);
  } catch (error) {
    console.error(error);
    process.exit(-1);
  }

  try {
    await transform.migrate({
      createGraph: true,
      graphName: process.env.ARANGO_DATABASE,
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(-1);
  }
})();
