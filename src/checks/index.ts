import { setPostgressConnection, setArangoConnection } from './migrate';

import {
  getDatabasesConfig,
  getTotalCollections,
  getAllTables,
  getTableRows,
  getTotalNodes,
} from './utils';

import { colors, log } from './logs';

const { postgresConfig, arangoConfig } = getDatabasesConfig();

const sanityChecks = async () => {
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
    log('Total collections:', totalCollections);
    log('Total tables:', tables.length);
  } else {
    log(colors.green, 'Sanity check pass');
  }

  // check number of table nows equal number of collection nodes
  log(
    colors.yellow,
    '2. Running check: number of table rows equal number of collection nodes'
  );
  let errors = false;

  tables.forEach(async ({ name, schema }) => {
    const tableRows = await getTableRows(postgresConnection, schema, name);
    const totalNodes = await getTotalNodes(arangoConnection, name);

    if (tableRows !== totalNodes) {
      errors = true;
      log(
        colors.red,
        `Nodes and table rows for collection ${schema}.${name} don't match.`
      );
    } else {
      log(
        colors.green,
        `Nodes and table rows for collection ${schema}.${name} match.`
      );
    }
  });
};

sanityChecks();
