## Instructions

### Build the project

- Create a `.env` file at the root of the project with the env vars from `.env.template` (Arango & Postgres credentials)
- Run `npm install`
- Run `npm run build`

### Eject migration

- Be sure to have Arango & Postgres credentials on `.env` file
- Run `npm run migrate`

### Run checks

- Run `npm run checks`

1. Check number of collections equal to number of tables
2. Check number of table nows equal number of collection nodes

### If you want to run ArangoDB with Docker

- Install Docker
- Run `docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=openSesame arangodb/arangodb:3.9.0`

## Optional

There's an `exmaple_db.sql` file which has an example relational database.
