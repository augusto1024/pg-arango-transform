const log = (message: string): void => {
  console.log(`LOG: ${message}...`);
};

log.ln = (message: string) => {
  console.log(`\nLOG: ${message}...`);
};

log.err = (message: string) => {
  console.error(`ERR: ${message}...`);
  console.log('Terminating...');
  process.exit(1);
};

export default log;
