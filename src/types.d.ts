
type TableColumn = {
  name: string;
  nullable: boolean;
  type: string;
  maxLen: number;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignTableName?: string;
  foreignColumnName?: string;
};

type Table = {
  name: string;
  columns: Record<string, TableColumn>;
  isCollection?: boolean;
};

type TablesQueryResponse = {
  tableName: string;
  columnName: string;
  isNullable: boolean;
  dataType: string;
  characterMaximumLength: number;
};

type TableRowsResponse = Record<string, unknown>;

type TableKeysResponse = {
  columnName: string;
  type: 'FOREIGN KEY' | 'PRIMARY KEY';
  foreignTableName: string;
  foreignColumnName: string;
};

type GraphNode = Record<string, unknown> & { _key: string };
type GraphEdge = Record<string, unknown> & { _from: string; _to: string };
