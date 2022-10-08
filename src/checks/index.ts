import {
  getDatabasesConfig,
  getTotalCollections,
  getAllTables,
  getTableRows,
  getTotalNodes,
  setPostgressConnection,
  setArangoConnection,
} from './utils';

import { colors, log } from './logs';

const { postgresConfig, arangoConfig } = getDatabasesConfig();

(async function () {
  try {
    const postgresConnection = await setPostgressConnection(postgresConfig);
    const arangoConnection = await setArangoConnection(arangoConfig);

    const tables = await getAllTables(postgresConnection);

    // check number of collections equal to number of tables

    log(
      colors.yellow,
      '1. Running check: number of collections equal to number of tables'
    );
    const totalCollections = await getTotalCollections(arangoConnection);

    if (tables.length !== totalCollections) {
      log(colors.red, 'Check fail. Results:');
    } else {
      log(colors.green, 'Sanity check passed');
    }

    // check number of table nows equal number of collection nodes
    log(
      colors.yellow,
      '2. Running check: number of table rows equal number of collection nodes'
    );

    const differences = [];
    for (let { name, schema } of tables) {
      const tableRows = await getTableRows(postgresConnection, schema, name);
      const totalNodes = await getTotalNodes(arangoConnection, name);

      if (tableRows !== totalNodes) {
        differences.push(`${schema}.${name}`);
      }
    }

    if (differences.length) {
      log(
        colors.red,
        `Node and row count don't match for the following tables/collections:`
      );
      differences.forEach((name) => log(name, name));
    } else {
      log(colors.green, 'Sanity check passed');
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(-1);
  }
})();
