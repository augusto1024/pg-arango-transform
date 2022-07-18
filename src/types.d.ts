type Column = {
  name: string;
};

type ForeignKeyColumn = Column & { referencedColumn: string };

type ForeignKey = {
  name: string;
  referencedTable: string;
  columns: Required<ForeignKeyColumn>[];
}

type Table = {
  name: string;
  schema: string;
  regularColumns: Column[];
  primaryKey: Column[];
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
}
