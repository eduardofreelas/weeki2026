import type { Database, Sql } from "../db.js";
import { createHash, randomUUID } from "node:crypto";
import type { Scope } from "../payments/repository.js";
import { authorize, workspaceLock } from "../payments/repository.js";
import { ContractError } from "./errors.js";
import type {
  ContractDocument,
  ContractSignatureRequest,
  ContractTemplate,
  WeekiContract,
} from "../../shared/contracts.js";
import type { VerifiedSignatureEvent } from "./provider.js";

export async function inContractsWorkspace<T>(
  db: Database,
  scope: Scope,
  fn: (sql: Sql) => Promise<T>,
  write = true,
) {
  return db.transaction(async (sql) => {
    await authorize(sql, scope, write);
    await workspaceLock(sql, scope.workspaceId);
    return fn(sql);
  });
}

export async function listContracts(sql: Sql, workspaceId: string, offset = 0) {
  return (
    await sql.query<{ data: WeekiContract }>(
      "SELECT data FROM weeki_contracts.contracts WHERE workspace_id=$1 AND archived_at IS NULL ORDER BY updated_at DESC,id DESC LIMIT 100 OFFSET $2",
      [workspaceId, offset],
    )
  ).rows.map((row) => row.data);
}

export async function getContract(sql: Sql, workspaceId: string, id: string) {
  const result = await sql.query<{ data: WeekiContract }>(
    "SELECT data FROM weeki_contracts.contracts WHERE workspace_id=$1 AND id=$2",
    [workspaceId, id],
  );
  if (!result.rows[0]) throw new ContractError("CONTRACT_NOT_FOUND", 404);
  return result.rows[0].data;
}

export async function nextNumber(sql: Sql, workspaceId: string) {
  const year = new Date().getFullYear();
  const result = await sql.query<{ total: string }>(
    "SELECT count(*)::text AS total FROM weeki_contracts.contracts WHERE workspace_id=$1 AND number LIKE $2",
    [workspaceId, `CTR-${year}-%`],
  );
  return `CTR-${year}-${String(Number(result.rows[0]?.total || 0) + 1).padStart(4, "0")}`;
}

export async function saveContract(sql: Sql, workspaceId: string, contract: WeekiContract) {
  await sql.query(
    `INSERT INTO weeki_contracts.contracts(id,workspace_id,number,client_id,related_service_id,related_task_id,related_project_id,proposal_id,charge_id,current_version_id,editorial_status,signature_status,contract_status,ai_generated,data,archived_at,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT(id,workspace_id) DO UPDATE SET number=excluded.number,client_id=excluded.client_id,related_service_id=excluded.related_service_id,related_task_id=excluded.related_task_id,related_project_id=excluded.related_project_id,proposal_id=excluded.proposal_id,charge_id=excluded.charge_id,current_version_id=excluded.current_version_id,editorial_status=excluded.editorial_status,signature_status=excluded.signature_status,contract_status=excluded.contract_status,ai_generated=excluded.ai_generated,data=excluded.data,archived_at=excluded.archived_at,updated_at=excluded.updated_at`,
    [
      contract.id,
      workspaceId,
      contract.number,
      contract.clientId,
      contract.relatedServiceId,
      contract.relatedTaskId,
      contract.relatedProjectId,
      contract.proposalId,
      contract.chargeId,
      contract.currentVersionId || null,
      contract.editorialStatus,
      contract.signatureStatus,
      contract.contractStatus,
      contract.aiGenerated,
      JSON.stringify(contract),
      contract.archivedAt,
      contract.createdAt,
      contract.updatedAt,
    ],
  );

  for (const version of contract.versions) {
    await sql.query(
      `INSERT INTO weeki_contracts.versions(id,workspace_id,contract_id,version,content_hash,immutable,data,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id,workspace_id) DO UPDATE SET content_hash=excluded.content_hash,immutable=excluded.immutable,data=excluded.data`,
      [
        version.id,
        workspaceId,
        contract.id,
        version.version,
        version.contentHash,
        version.immutable,
        JSON.stringify(version),
        version.createdAt,
      ],
    );
  }

  await sql.query(
    "DELETE FROM weeki_contracts.parties WHERE workspace_id=$1 AND contract_id=$2",
    [workspaceId, contract.id],
  );
  for (const party of contract.parties) {
    await sql.query(
      "INSERT INTO weeki_contracts.parties(id,workspace_id,contract_id,role,data) VALUES($1,$2,$3,$4,$5)",
      [party.id, workspaceId, contract.id, party.role, JSON.stringify(party)],
    );
  }

  await sql.query(
    "DELETE FROM weeki_contracts.signers WHERE workspace_id=$1 AND contract_id=$2",
    [workspaceId, contract.id],
  );
  for (const signer of contract.signers) {
    await sql.query(
      "INSERT INTO weeki_contracts.signers(id,workspace_id,contract_id,email,signing_order,status,external_id,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        signer.id,
        workspaceId,
        contract.id,
        signer.email,
        signer.order,
        signer.status,
        signer.externalId || null,
        JSON.stringify(signer),
      ],
    );
  }

  for (const document of contract.documents) {
    await saveDocument(sql, workspaceId, contract.id, document);
  }
  for (const request of contract.signatureRequests) {
    await saveSignatureRequest(sql, workspaceId, contract.id, request);
  }
}

export async function saveDocument(sql: Sql, workspaceId: string, contractId: string, document: ContractDocument) {
  await sql.query(
    `INSERT INTO weeki_contracts.documents(id,workspace_id,contract_id,version_id,kind,storage_key,checksum,content_type,size,immutable,data,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT(id,workspace_id) DO UPDATE SET storage_key=excluded.storage_key,checksum=excluded.checksum,content_type=excluded.content_type,size=excluded.size,immutable=excluded.immutable,data=excluded.data`,
    [
      document.id,
      workspaceId,
      contractId,
      document.versionId,
      document.kind,
      document.storageKey,
      document.checksum,
      document.contentType,
      document.size,
      document.immutable,
      JSON.stringify(document),
      document.createdAt,
    ],
  );
}

export async function saveSignatureRequest(sql: Sql, workspaceId: string, contractId: string, request: ContractSignatureRequest) {
  await sql.query(
    `INSERT INTO weeki_contracts.signature_requests(id,workspace_id,contract_id,version_id,provider,external_id,status,request_key,request_hash,data,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT(id,workspace_id) DO UPDATE SET external_id=excluded.external_id,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at`,
    [
      request.id,
      workspaceId,
      contractId,
      request.versionId,
      request.provider,
      request.externalId,
      request.status,
      request.idempotencyKey,
      requestHash(request),
      JSON.stringify(request),
      request.sentAt || new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}

export async function listTemplates(sql: Sql, workspaceId: string) {
  return (
    await sql.query<{ data: ContractTemplate }>(
      "SELECT data FROM weeki_contracts.templates WHERE workspace_id=$1 ORDER BY favorite DESC, updated_at DESC",
      [workspaceId],
    )
  ).rows.map((row) => row.data);
}

export async function saveTemplate(sql: Sql, workspaceId: string, template: ContractTemplate) {
  await sql.query(
    `INSERT INTO weeki_contracts.templates(id,workspace_id,name,favorite,archived_at,data,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(id,workspace_id) DO UPDATE SET name=excluded.name,favorite=excluded.favorite,archived_at=excluded.archived_at,data=excluded.data,updated_at=excluded.updated_at`,
    [
      template.id,
      workspaceId,
      template.name,
      template.favorite,
      template.archivedAt,
      JSON.stringify(template),
      template.createdAt,
      template.updatedAt,
    ],
  );
}

export async function audit(
  sql: Sql,
  workspaceId: string,
  contractId: string | null,
  action: string,
  data: Record<string, unknown> = {},
) {
  await sql.query(
    "INSERT INTO weeki_contracts.audit(id,workspace_id,contract_id,action,data) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), workspaceId, contractId, action, JSON.stringify(data)],
  );
}

export async function enqueueSignatureEvent(sql: Sql, event: VerifiedSignatureEvent) {
  const request = await sql.query<{
    id: string;
    workspace_id: string;
    contract_id: string;
  }>(
    "SELECT id,workspace_id,contract_id FROM weeki_contracts.signature_requests WHERE provider=$1 AND external_id=$2",
    [event.provider, event.externalRequestId],
  );
  if (!request.rows[0]) throw new ContractError("CONTRACT_WEBHOOK_NOT_FOUND", 404);
  const row = request.rows[0];
  const inserted = await sql.query(
    `INSERT INTO weeki_contracts.signature_events(id,workspace_id,signature_request_id,contract_id,provider,external_id,event_type,data)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(provider,external_id) DO NOTHING RETURNING id`,
    [
      randomUUID(),
      row.workspace_id,
      row.id,
      row.contract_id,
      event.provider,
      event.id,
      event.type,
      JSON.stringify(event),
    ],
  );
  return { accepted: true, duplicate: inserted.rows.length === 0 };
}

export async function nextSignatureEvent(sql: Sql) {
  const events = await sql.query<{
    id: string;
    workspace_id: string;
    signature_request_id: string;
    contract_id: string;
    data: VerifiedSignatureEvent;
    attempts: number;
  }>(
    "SELECT id,workspace_id,signature_request_id,contract_id,data,attempts FROM weeki_contracts.signature_events WHERE status IN ('pending','retry') AND next_attempt_at<=now() ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1",
  );
  return events.rows[0] ?? null;
}

export async function completeSignatureEvent(sql: Sql, id: string) {
  await sql.query(
    "UPDATE weeki_contracts.signature_events SET status='processed',processed_at=now(),attempts=attempts+1,error_code=NULL WHERE id=$1",
    [id],
  );
}

export async function failSignatureEvent(sql: Sql, id: string, attempts: number, error: ContractError) {
  const retry = error.retryable && attempts < 7;
  await sql.query(
    "UPDATE weeki_contracts.signature_events SET status=$2,attempts=attempts+1,error_code=$3,next_attempt_at=$4 WHERE id=$1",
    [
      id,
      retry ? "retry" : "failed",
      error.code,
      new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts)),
    ],
  );
}

function requestHash(request: ContractSignatureRequest) {
  return createHash("sha256").update(`${request.versionId}:${request.provider}:${request.signingMode}:${request.expiresAt}`).digest("hex");
}
