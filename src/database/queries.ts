/**
 * Ignore VIEWS -> it.table_type = 'BASE TABLE
 * Ignore tables on information_schema and pg_catalog
 */
export const GET_TABLES = `SELECT
		ic.table_name AS "tableName",
		ic.column_name AS "columnName",
     ic.table_schema AS "tableSchema"
      FROM information_schema.columns as ic join information_schema.tables as it  on 
	  ic.table_name = it.table_name and ic.table_schema = it.table_schema 
	  WHERE ic.table_schema <> 'information_schema' 
	  AND  ic.table_schema <> 'pg_catalog'
	  AND it.table_type = 'BASE TABLE'`;

export const GET_PRIMARY_KEYS = `SELECT
        ccu.column_name AS "name"
      FROM
        information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name=$1;`;

export const GET_FOREIGN_KEY = `SELECT
        kcu.column_name AS "columnName",
        tc.constraint_name AS "constraintName"
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1;`;

export const GET_FOREIGN_KEY_TABLE_INFO = `SELECT
        kcu.column_name as "columnName",
        ccu.column_name as "foreignColumnName",
        ccu.constraint_name as "constraintName",
        ccu.table_name as "foreignTableName"
      FROM information_schema.constraint_column_usage ccu JOIN information_schema.key_column_usage kcu 
      ON  kcu.constraint_name = ccu.constraint_name where ccu.constraint_name = ANY($1)`;

export const GET_UNIQUE_KEY = `SELECT
        kcu.column_name AS "columnName",
        tc.constraint_name AS "constraintName"
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = $1;`;

export const GET_FOREIGN_PK = `SELECT
        ccu.column_name AS "primaryKey",
		tc.table_name as "tableName"
      FROM
        information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND
	  tc.table_name=ANY($1)`;
