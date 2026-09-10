import type { Database, Sql } from "../db.js";
import { authorize, workspaceLock, type Scope } from "../payments/repository.js";
import type {
  FiscalAutomationSettings,
  FiscalCertificateMetadata,
  FiscalProfile,
  FiscalServiceConfig,
  NfseEvent,
  NfseRecord,
} from "../../shared/fiscal.js";
import { FiscalError } from "./errors.js";

export async function inFiscalWorkspace<T>(db: Database, scope: Scope, fn: (sql: Sql) => Promise<T>, write = true) {
  return db.transaction(async (sql) => {
    await authorize(sql, scope, write);
    await workspaceLock(sql, scope.workspaceId);
    return fn(sql);
  });
}

export async function fiscalProfile(sql: Sql, workspaceId: string) {
  const result = await sql.query<{ data: FiscalProfile }>(
    "SELECT data FROM weeki_fiscal.profiles WHERE workspace_id=$1",
    [workspaceId],
  );
  return result.rows[0]?.data ?? null;
}

export async function saveFiscalProfile(sql: Sql, workspaceId: string, profile: FiscalProfile) {
  await sql.query(
    "INSERT INTO weeki_fiscal.profiles(workspace_id,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(workspace_id) DO UPDATE SET data=excluded.data,updated_at=now()",
    [workspaceId, JSON.stringify(profile)],
  );
}

export async function automationSettings(sql: Sql, workspaceId: string) {
  const result = await sql.query<{ data: FiscalAutomationSettings }>(
    "SELECT data FROM weeki_fiscal.automation_settings WHERE workspace_id=$1",
    [workspaceId],
  );
  return result.rows[0]?.data ?? null;
}

export async function saveAutomationSettings(sql: Sql, workspaceId: string, settings: FiscalAutomationSettings) {
  await sql.query(
    "INSERT INTO weeki_fiscal.automation_settings(workspace_id,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(workspace_id) DO UPDATE SET data=excluded.data,updated_at=now()",
    [workspaceId, JSON.stringify(settings)],
  );
}

export async function serviceConfigs(sql: Sql, workspaceId: string) {
  return (await sql.query<{ data: FiscalServiceConfig }>(
    "SELECT data FROM weeki_fiscal.service_configs WHERE workspace_id=$1 ORDER BY updated_at DESC",
    [workspaceId],
  )).rows.map((row) => row.data);
}

export async function serviceConfig(sql: Sql, workspaceId: string, id: string) {
  const result = await sql.query<{ data: FiscalServiceConfig }>(
    "SELECT data FROM weeki_fiscal.service_configs WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!result.rows[0]) throw new FiscalError("FISCAL_NOT_FOUND", 404);
  return result.rows[0].data;
}

export async function saveServiceConfig(sql: Sql, workspaceId: string, config: FiscalServiceConfig) {
  await sql.query(
    "INSERT INTO weeki_fiscal.service_configs(id,workspace_id,local_service_id,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id,workspace_id) DO UPDATE SET local_service_id=excluded.local_service_id,data=excluded.data,updated_at=excluded.updated_at",
    [config.id, workspaceId, config.localId, JSON.stringify(config), config.createdAt, config.updatedAt],
  );
}

export async function certificateMetadata(sql: Sql, workspaceId: string) {
  const result = await sql.query<{ metadata: FiscalCertificateMetadata }>(
    "SELECT metadata FROM weeki_fiscal.certificates WHERE workspace_id=$1 ORDER BY updated_at DESC LIMIT 1",
    [workspaceId],
  );
  return result.rows[0]?.metadata ?? null;
}

export async function certificateCredential(sql: Sql, workspaceId: string) {
  const result = await sql.query<{
    secret_reference: string;
    metadata: FiscalCertificateMetadata;
  }>(
    "SELECT secret_reference,metadata FROM weeki_fiscal.certificates WHERE workspace_id=$1 ORDER BY updated_at DESC LIMIT 1",
    [workspaceId],
  );
  const row = result.rows[0];
  return row ? { secretReference: row.secret_reference, metadata: row.metadata } : null;
}

export async function listNfse(sql: Sql, workspaceId: string, offset = 0) {
  return (await sql.query<{ data: NfseRecord }>(
    "SELECT data FROM weeki_fiscal.nfse WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100 OFFSET $2",
    [workspaceId, Math.max(0, offset)],
  )).rows.map((row) => row.data);
}

export async function nfse(sql: Sql, workspaceId: string, id: string) {
  const result = await sql.query<{ data: NfseRecord }>(
    "SELECT data FROM weeki_fiscal.nfse WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!result.rows[0]) throw new FiscalError("FISCAL_NOT_FOUND", 404);
  return result.rows[0].data;
}

export async function createNfse(sql: Sql, workspaceId: string, note: NfseRecord, requestHash: string) {
  const inserted = await sql.query<{ data: NfseRecord }>(
    "INSERT INTO weeki_fiscal.nfse(id,workspace_id,service_config_id,request_key,request_hash,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,request_key) DO NOTHING RETURNING data",
    [note.id, workspaceId, note.serviceConfigId, note.idempotencyKey, requestHash, note.status, JSON.stringify(note), note.createdAt, note.updatedAt],
  );
  if (inserted.rows[0]) {
    await saveNfseEvent(sql, workspaceId, note.id, note.events[0]);
    return { note: inserted.rows[0].data, created: true };
  }
  const existing = await sql.query<{ data: NfseRecord; request_hash: string }>(
    "SELECT data,request_hash FROM weeki_fiscal.nfse WHERE workspace_id=$1 AND request_key=$2",
    [workspaceId, note.idempotencyKey],
  );
  if (!existing.rows[0]) throw new FiscalError("FISCAL_INTERNAL", 500);
  if (existing.rows[0].request_hash !== requestHash) throw new FiscalError("FISCAL_CONFLICT", 409);
  return { note: existing.rows[0].data, created: false };
}

export async function saveNfse(sql: Sql, workspaceId: string, note: NfseRecord, event?: NfseEvent) {
  const result = await sql.query(
    "UPDATE weeki_fiscal.nfse SET status=$3,data=$4,updated_at=$5 WHERE workspace_id=$1 AND id=$2 RETURNING id",
    [workspaceId, note.id, note.status, JSON.stringify(note), note.updatedAt],
  );
  if (!result.rows[0]) throw new FiscalError("FISCAL_NOT_FOUND", 404);
  if (event) await saveNfseEvent(sql, workspaceId, note.id, event);
}

export async function saveNfseError(sql: Sql, workspaceId: string, noteId: string, error: NfseRecord["errors"][number]) {
  await sql.query(
    "INSERT INTO weeki_fiscal.nfse_errors(id,workspace_id,nfse_id,code,provider,attempt,data,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING",
    [error.id, workspaceId, noteId, error.code, error.provider, error.attempt, JSON.stringify(error), error.createdAt],
  );
}

async function saveNfseEvent(sql: Sql, workspaceId: string, noteId: string, event: NfseEvent) {
  await sql.query(
    "INSERT INTO weeki_fiscal.nfse_events(id,workspace_id,nfse_id,kind,data,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
    [event.id, workspaceId, noteId, event.kind, JSON.stringify(event), event.createdAt],
  );
}
