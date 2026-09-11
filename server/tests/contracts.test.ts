import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  emptyContractTerms,
  type ContractAiGenerationInput,
  type ContractAiGenerationResult,
  type ContractDraftInput,
} from "../../shared/contracts.js";
import { ContractError } from "../contracts/errors.js";
import type {
  SignatureDocumentPayload,
  SignatureProvider,
  SignatureSubmissionInput,
  SignatureSubmissionResult,
  SignatureWebhookInput,
  VerifiedSignatureEvent,
} from "../contracts/provider.js";
import { SignatureProviderRegistry } from "../contracts/registry.js";
import { ContractService, type ContractAiGenerator } from "../contracts/service.js";
import { fixture } from "./helpers.js";

class FakeSignatureProvider implements SignatureProvider {
  readonly id = "clicksign" as const;
  readonly environment = "sandbox" as const;
  sent = 0;
  reminders = 0;
  cancellations = 0;

  configured() {
    return true;
  }

  async sendForSignature(input: SignatureSubmissionInput): Promise<SignatureSubmissionResult> {
    this.sent += 1;
    return {
      externalId: `env_${input.contract.id}`,
      externalStatus: "running",
      status: "sent",
      documentExternalId: `doc_${input.request.id}`,
      signerExternalIds: Object.fromEntries(input.contract.signers.map((signer, index) => [signer.id, `signer_${index + 1}`])),
    };
  }

  async resendReminder() {
    this.reminders += 1;
  }

  async cancelRequest() {
    this.cancellations += 1;
  }

  async downloadSignedDocument(): Promise<SignatureDocumentPayload> {
    return {
      fileName: "signed.pdf",
      contentType: "application/pdf",
      data: Buffer.from("%PDF-1.4\nsigned\n%%EOF"),
    };
  }

  async downloadEvidence(): Promise<SignatureDocumentPayload> {
    return {
      fileName: "evidence.pdf",
      contentType: "application/pdf",
      data: Buffer.from("%PDF-1.4\nevidence\n%%EOF"),
    };
  }

  handleWebhook(input: SignatureWebhookInput): VerifiedSignatureEvent {
    if (input.headers.signature !== "ok") throw new ContractError("CONTRACT_WEBHOOK_INVALID", 401);
    const parsed = JSON.parse(input.raw) as {
      id: string;
      type: string;
      envelopeId: string;
      signerExternalId?: string;
      status: "viewed" | "partially_signed" | "signed" | "declined" | "expired" | "cancelled";
    };
    return {
      id: parsed.id,
      type: parsed.type,
      provider: this.id,
      externalRequestId: parsed.envelopeId,
      signerExternalId: parsed.signerExternalId,
      signatureStatus: parsed.status,
      signerStatus: parsed.status,
      occurredAt: new Date().toISOString(),
      rawStatus: parsed.type,
      safePayload: { id: parsed.id, type: parsed.type },
    };
  }
}

class FakeAi implements ContractAiGenerator {
  configured() {
    return true;
  }

  async generate(input: ContractAiGenerationInput): Promise<ContractAiGenerationResult> {
    return {
      title: `Contrato IA - ${input.sourceSnapshot.service.title}`,
      content: "<h1>Contrato IA</h1><p>Cláusula gerada com dados mínimos.</p>",
      missingFields: [],
      warnings: ["Revise juridicamente."],
      model: "fake-model",
      provider: "openai",
    };
  }
}

function contractDraft(): ContractDraftInput {
  const now = new Date().toISOString();
  const terms = {
    ...emptyContractTerms(),
    value: 850,
    paymentTerms: "Pix em duas parcelas.",
    startDate: "2099-01-01",
    endDate: "2099-12-31",
    jurisdiction: "Fortaleza/CE",
  };
  return {
    source: "manual",
    title: "Contrato de Prestação de Serviços",
    clientId: "local-client-1",
    templateId: null,
    relatedServiceId: "task-1",
    relatedTaskId: "task-1",
    proposalId: null,
    chargeId: null,
    sourceSnapshot: {
      business: {
        name: "Weeki Serviços",
        document: "52998224725",
        email: "prestador@example.test",
        phone: "85999990000",
        representativeName: "Prestador",
        representativeRole: "Sócio",
        address: "Rua Teste, 10",
      },
      client: {
        id: "local-client-1",
        name: "Cliente de Teste Ltda.",
        kind: "company",
        document: "11222333000181",
        email: "cliente@example.test",
        phone: "8533334444",
        address: "Avenida Teste, 20",
        representativeName: "Cliente",
        representativeRole: "Diretora",
        capturedAt: now,
      },
      service: {
        id: "task-1",
        title: "Consultoria",
        description: "Consultoria em tecnologia",
        scope: "Diagnóstico e plano de ação",
        deliverables: "Relatório e reunião",
        deadline: "30 dias",
        revisions: "2",
        providerResponsibilities: "Executar com zelo técnico.",
        clientResponsibilities: "Fornecer informações.",
        source: "task",
      },
      billing: null,
      proposal: null,
      capturedAt: now,
    },
    terms,
    parties: [
      {
        id: randomUUID(),
        type: "company",
        name: "Weeki Serviços",
        document: "52998224725",
        email: "prestador@example.test",
        phone: "85999990000",
        address: "Rua Teste, 10",
        role: "Contratada",
        representativeName: "Prestador",
        representativeRole: "Sócio",
        snapshotSource: "business",
      },
      {
        id: randomUUID(),
        type: "company",
        name: "Cliente de Teste Ltda.",
        document: "11222333000181",
        email: "cliente@example.test",
        phone: "8533334444",
        address: "Avenida Teste, 20",
        role: "Contratante",
        representativeName: "Cliente",
        representativeRole: "Diretora",
        snapshotSource: "client",
      },
    ],
    signers: [
      {
        id: randomUUID(),
        partyId: null,
        name: "Cliente",
        email: "cliente@example.test",
        document: "11222333000181",
        role: "Signatário",
        order: 1,
        authMethod: "provider_default",
        status: "not_started",
        viewedAt: null,
        signedAt: null,
        lastEventAt: null,
      },
    ],
    signingMode: "ordered",
    signatureMessage: "Segue contrato para assinatura.",
    content: "<h1>{{service.title}}</h1><p>{{client.name}}</p><script>alert(1)</script>",
  };
}

function contractsService(provider = new FakeSignatureProvider(), ai = new FakeAi()) {
  return {
    provider,
    service: (db: Awaited<ReturnType<typeof fixture>>["db"]) =>
      new ContractService(db, new SignatureProviderRegistry([provider]), ai),
  };
}

test("contracts are created with snapshots, sanitized content and PDF metadata", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const { service } = contractsService();
  const contracts = service(f.db);
  const contract = await contracts.create(f.a, contractDraft());
  assert.equal(contract.clientName, "Cliente de Teste Ltda.");
  assert.equal(contract.versions.length, 1);
  assert(!contract.content.includes("<script>"));
  const generated = await contracts.generatePdf(f.a, contract.id);
  assert.equal(generated.document.kind, "preview_pdf");
  assert.equal(generated.document.checksum.length, 64);
  await assert.rejects(
    () => contracts.get(f.b, contract.id),
    (error: unknown) => error instanceof ContractError && error.code === "CONTRACT_NOT_FOUND",
  );
});

test("AI generation updates a contract through the backend and preserves a new version", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const { service } = contractsService();
  const contracts = service(f.db);
  const contract = await contracts.create(f.a, contractDraft());
  const updated = await contracts.generateAi(f.a, {
    contractId: contract.id,
    instructions: "Torne mais formal.",
    sourceSnapshot: contract.sourceSnapshot,
    terms: contract.terms,
    clauses: {
      cancellation: contract.terms.cancellation,
      termination: contract.terms.termination,
      intellectualProperty: contract.terms.intellectualProperty,
      dataProtection: contract.terms.dataProtection,
      additionalClauses: contract.terms.additionalClauses,
    },
  });
  assert("versions" in updated);
  assert.equal(updated.aiGenerated, true);
  assert.equal(updated.versions.length, 2);
  assert.equal(updated.versions[0].aiGenerated, true);
});

test("signature sending is idempotent and freezes the sent version", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const { provider, service } = contractsService();
  const contracts = service(f.db);
  const contract = await contracts.create(f.a, contractDraft());
  await contracts.update(f.a, contract.id, { reviewConfirmed: true, editorialStatus: "ready" });
  const key = randomUUID();
  const first = await contracts.sendForSignature(f.a, contract.id, key);
  const duplicate = await contracts.sendForSignature(f.a, contract.id, key);
  assert.equal(first.signatureStatus, "sent");
  assert.equal(duplicate.signatureRequests[0].externalId, first.signatureRequests[0].externalId);
  assert.equal(provider.sent, 1);
  await assert.rejects(
    () => contracts.update(f.a, contract.id, { content: "<p>Alterado depois do envio.</p>" }),
    (error: unknown) => error instanceof ContractError && error.code === "CONTRACT_IMMUTABLE_VERSION",
  );
});

test("Clicksign-style webhooks are idempotent and complete signatures from provider evidence", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const { service } = contractsService();
  const contracts = service(f.db);
  const contract = await contracts.create(f.a, contractDraft());
  await contracts.update(f.a, contract.id, { reviewConfirmed: true, editorialStatus: "ready" });
  const sent = await contracts.sendForSignature(f.a, contract.id, randomUUID());
  const signerExternalId = sent.signers[0].externalId!;
  const raw = JSON.stringify({
    id: "evt-signed-1",
    type: "document_signed",
    envelopeId: sent.signatureRequests[0].externalId,
    signerExternalId,
    status: "signed",
  });
  const accepted = await contracts.enqueueSignatureWebhook("clicksign", { raw, headers: { signature: "ok" }, query: new URLSearchParams() });
  const duplicate = await contracts.enqueueSignatureWebhook("clicksign", { raw, headers: { signature: "ok" }, query: new URLSearchParams() });
  assert.equal(accepted.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(await contracts.processNextWebhook(), true);
  const completed = await contracts.get(f.a, contract.id);
  assert.equal(completed.signatureStatus, "signed");
  assert.equal(completed.contractStatus, "pending");
  assert(completed.documents.some((document) => document.kind === "signed_pdf" && document.immutable));
  assert(completed.documents.some((document) => document.kind === "evidence" && document.immutable));
});
