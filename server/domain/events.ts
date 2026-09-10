import { randomUUID } from "node:crypto";
import type { Sql } from "../db.js";

export type WeekiDomainEventType = "payment.confirmed" | "service.completed";

export async function publishDomainEvent(
  sql: Sql,
  workspaceId: string,
  eventType: WeekiDomainEventType,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  const result = await sql.query<{ id: string }>(
    "INSERT INTO weeki_core.domain_events(id,workspace_id,event_type,aggregate_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,event_type,aggregate_id) DO NOTHING RETURNING id",
    [randomUUID(), workspaceId, eventType, aggregateId, JSON.stringify(payload)],
  );
  return result.rows[0]?.id ?? null;
}
