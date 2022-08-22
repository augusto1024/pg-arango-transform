type Column = {
  name: string;
};

type ForeignKeyColumn = Column & { foreignColumn: string };

type ForeignKey = {
  name: string;
  foreignTable: string;
  columns: Required<ForeignKeyColumn>[];
  pointsToPK: boolean;
};

type UniqueKey = {
  name: string;
  columns: Column[];
};

type Table = {
  name: string;
  schema: string;
  allColumns: Column[];
  primaryKey: Column[];
  uniqueKeys: UniqueKey[];
  foreignKeys: ForeignKey[];
};

type TablesQueryResponse = {
  tableName: string;
  columnName: string;
  tableSchema: string;
};

type TableRowsResponse = Record<string, unknown>;

type GraphNode = Record<string, unknown> & { _key: string };
type GraphEdge = Record<string, unknown> & { _from: string; _to: string };

type NodePreview = { id: number; label: string };
type EdgePreview = { from: number; to: number };

type GraphPreview = {
  nodes: NodePreview[];
  edges: EdgePreview[];
};

type TransformMessage = {
  message: string;
  type?: 'info' | 'error' | 'done'
}
