import { db } from "./db";

export function addGraphEdge(
  channelId: string,
  fromNode: string,
  toNode: string,
  relationType: string,
  weight = 1.0,
): void {
  db()
    .prepare(
      `INSERT INTO context_graph(channel_id, from_node, to_node, relation_type, weight, created_at)
       VALUES(?, ?, ?, ?, ?, ?)`,
    )
    .run(channelId, fromNode, toNode, relationType, weight, Date.now());
}

export function getGraphNeighbors(
  channelId: string,
  node: string,
): Array<{ toNode: string; relationType: string; weight: number }> {
  const rows = db()
    .prepare(
      `SELECT to_node, relation_type, weight
       FROM context_graph
       WHERE channel_id = ? AND from_node = ?
       ORDER BY weight DESC`,
    )
    .all(channelId, node) as Array<{
    to_node: string;
    relation_type: string;
    weight: number;
  }>;
  return rows.map((r) => ({
    toNode: r.to_node,
    relationType: r.relation_type,
    weight: r.weight,
  }));
}

export function getGraphSummaryText(channelId: string): string {
  const countRow = db()
    .prepare(`SELECT COUNT(*) as total FROM context_graph WHERE channel_id = ?`)
    .get(channelId) as { total: number };

  if (countRow.total === 0) {
    return "El canal no registra relaciones entre conceptos todavia.";
  }

  const top = db()
    .prepare(
      `SELECT from_node, to_node, relation_type, weight
       FROM context_graph
       WHERE channel_id = ?
       ORDER BY weight DESC
       LIMIT 5`,
    )
    .all(channelId) as Array<{
    from_node: string;
    to_node: string;
    relation_type: string;
    weight: number;
  }>;

  const parts = top.map(
    (r) =>
      `${r.from_node} ${r.relation_type} ${r.to_node} (peso ${r.weight.toFixed(2)})`,
  );

  return `El canal registra ${countRow.total} relaciones entre conceptos. Las mas importantes: ${parts.join(", ")}.`;
}

export function inferDecisionContext(
  channelId: string,
  keyword: string,
): string {
  const rows = db()
    .prepare(
      `SELECT from_node, to_node, relation_type, weight
       FROM context_graph
       WHERE channel_id = ?
         AND (from_node LIKE ? OR to_node LIKE ?)
       ORDER BY weight DESC
       LIMIT 5`,
    )
    .all(channelId, `%${keyword}%`, `%${keyword}%`) as Array<{
    from_node: string;
    to_node: string;
    relation_type: string;
    weight: number;
  }>;

  if (rows.length === 0) {
    return "Sin contexto previo para ese termino.";
  }

  const parts = rows.map(
    (r) => `${r.from_node} ${r.relation_type} ${r.to_node}`,
  );

  return `El termino "${keyword}" aparece en ${rows.length} relacion${rows.length === 1 ? "" : "es"}: ${parts.join("; ")}.`;
}
