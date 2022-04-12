## Instructions
### Run ArangoDB with Docker
- Install Docker
- Run `docker run -p 8529:8529 -e ARANGO_ROOT_PASSWORD=openSesame arangodb/arangodb:3.9.0`

### Correr el proyecto
- Create a `.env` file at the root of the project with the env vars from `.env.template`
- Run `npm run start`

## Optional
There's an `exmaple_db.sql` file which has an example relational database.
