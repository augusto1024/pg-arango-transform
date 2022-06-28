type TableColumn = {
  name: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignTableName?: string;
  foreignColumnName?: string;
};

type Table = {
  name: string;
  schema: string;
  columns: Record<string, TableColumn>;
};

type TablesQueryResponse = {
  tableName: string;
  columnName: string;
  tableSchema: string;
};

type TableRowsResponse = Record<string, unknown>;

type TableKey = {
  columnName: string;
  type: 'FOREIGN KEY' | 'PRIMARY KEY';
  foreignTableName: string;
  foreignColumnName: string;
};

type GraphNode = Record<string, unknown> & { _key: string };
type GraphEdge = Record<string, unknown> & { _from: string; _to: string };

type NodePreview = { id: number; label: string };
type EdgePreview = { from: number; to: number };

type GraphPreview = {
  nodes: NodePreview[];
  edges: EdgePreview[];
}
