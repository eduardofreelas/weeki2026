import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type {
  FiscalCertificateMetadata,
  FiscalCustomer,
  FiscalProfile,
  FiscalServiceConfig,
  MunicipalParameters,
  NfseRequest,
  NfseResponse,
} from "../../shared/fiscal.js";
import {
  isValidFiscalDocument,
  validateNfseRequest,
} from "../../shared/fiscal-validation.js";
import { FiscalError } from "../fiscal/errors.js";
import type {
  FiscalDocumentPayload,
  FiscalProvider,
  FiscalProviderContext,
} from "../fiscal/provider.js";
import { FiscalService, type ServerFiscalDraft } from "../fiscal/service.js";
import { fixture, type Fixture } from "./helpers.js";

class FakeFiscalProvider implements FiscalProvider {
  readonly id = "national_nfse" as const;
  readonly enabled = true;
  issued = 0;
  failure: FiscalError | null = null;

  async issueNfse(request: NfseRequest, context: FiscalProviderContext): Promise<NfseResponse> {
    void request;
    void context;
    this.issued += 1;
    if (this.failure) throw this.failure;
    return {
      providerReference: "provider-test-1",
      status: "AUTHORIZED",
      number: "1001",
      series: "1",
      accessKey: "test-access-key",
      issuedAt: new Date().toISOString(),
      rawStatus: "authorized",
    };
  }

  async getNfse(providerReference: string): Promise<NfseResponse> {
    void providerReference;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async cancelNfse(providerReference: string, reason: string): Promise<NfseResponse> {
    void providerReference;
    void reason;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async replaceNfse(requestReference: string, request: NfseRequest, context: FiscalProviderContext): Promise<NfseResponse> {
    void requestReference;
    void request;
    void context;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async getPdf(providerReference: string): Promise<FiscalDocumentPayload> {
    void providerReference;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async getXml(providerReference: string): Promise<FiscalDocumentPayload> {
    void providerReference;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async getMunicipalParameters(cityCode: string): Promise<MunicipalParameters> {
    void cityCode;
    throw new FiscalError("NFSE_PROVIDER_STANDBY", 503);
  }

  async validate(request: NfseRequest) {
    return validateNfseRequest(request);
  }

  async getStatus(providerReference: string) {
    void providerReference;
    return { status: "AUTHORIZED" as const, rawStatus: "authorized" };
  }
}

const profile = (): FiscalProfile => ({
  personType: "individual",
  document: "52998224725",
  legalName: "Prestador de Teste",
  tradeName: "Weeki Teste",
  municipalRegistration: "",
  email: "prestador@example.test",
  phone: "11999999999",
  address: {
    street: "Rua Teste",
    number: "10",
    complement: "",
    district: "Centro",
    zipCode: "01001000",
    city: "São Paulo",
    cityCode: "3550308",
    state: "SP",
    countryCode: "BR",
  },
  taxRegime: "simples_nacional",
  simpleNational: true,
  mei: false,
  provider: "national_nfse",
  environment: "sandbox",
  configuredAt: null,
  updatedAt: null,
});

const serviceInput = (): Omit<FiscalServiceConfig, "id" | "createdAt" | "updatedAt"> => ({
  localId: "service-1",
  name: "Consultoria",
  fiscalDescription: "Serviços de consultoria em tecnologia",
  serviceCode: "01.01",
  taxationCode: "",
  defaultAmount: 850,
  incidenceCity: "São Paulo",
  incidenceCityCode: "3550308",
  operationNature: "",
  tax: {
    issRate: 2,
    issWithheld: false,
    inssWithheld: false,
    irWithheld: false,
    csllWithheld: false,
    pisWithheld: false,
    cofinsWithheld: false,
    approximateTaxAmount: 0,
  },
  active: true,
});

const customer = (): FiscalCustomer => ({
  localId: "client-1",
  personType: "company",
  document: "11222333000181",
  name: "Cliente de Teste Ltda.",
  municipalRegistration: "",
  email: "cliente@example.test",
  phone: "1133334444",
  address: {
    street: "Avenida Teste",
    number: "20",
    complement: "",
    district: "Centro",
    zipCode: "20040020",
    city: "Rio de Janeiro",
    cityCode: "3304557",
    state: "RJ",
    countryCode: "BR",
  },
});

async function configured(f: Fixture, provider = new FakeFiscalProvider()) {
  const fiscal = new FiscalService(f.db, provider);
  await fiscal.saveProfile(f.a, profile());
  const { config } = await fiscal.saveService(f.a, serviceInput());
  const draft: ServerFiscalDraft = {
    idempotencyKey: `manual:${randomUUID()}`,
    clientId: "client-1",
    customer: customer(),
    serviceConfigId: config.id,
    description: config.fiscalDescription,
    amount: 850,
    competenceDate: "2026-09-10",
    origin: "manual",
  };
  return { fiscal, provider, draft };
}

async function addCertificate(f: Fixture) {
  const metadata: FiscalCertificateMetadata = {
    id: randomUUID(),
    name: "certificate.pfx",
    holderName: "Prestador de Teste",
    holderDocument: "52998224725",
    validFrom: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    status: "active",
    updatedAt: new Date().toISOString(),
  };
  await f.db.query(
    "INSERT INTO weeki_fiscal.certificates(id,workspace_id,secret_reference,metadata) VALUES($1,$2,$3,$4)",
    [metadata.id, f.a.workspaceId, "kms://test/certificate", JSON.stringify(metadata)],
  );
}

function enableIntegration(t: TestContext) {
  const previous = process.env.NFSE_NATIONAL_INTEGRATION_ENABLED;
  process.env.NFSE_NATIONAL_INTEGRATION_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.NFSE_NATIONAL_INTEGRATION_ENABLED;
    else process.env.NFSE_NATIONAL_INTEGRATION_ENABLED = previous;
  });
}

test("CPF/CNPJ validation rejects repeated or malformed digits and accepts valid documents", () => {
  assert.equal(isValidFiscalDocument("529.982.247-25"), true);
  assert.equal(isValidFiscalDocument("11.222.333/0001-81"), true);
  assert.equal(isValidFiscalDocument("111.111.111-11"), false);
  assert.equal(isValidFiscalDocument("11.222.333/0001-82"), false);
});

test("draft creation requires a fiscal profile", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const fiscal = new FiscalService(f.db, new FakeFiscalProvider());
  const { config } = await fiscal.saveService(f.a, serviceInput());
  await assert.rejects(
    () => fiscal.createDraft(f.a, {
      idempotencyKey: `manual:${randomUUID()}`,
      clientId: "client-1",
      customer: customer(),
      serviceConfigId: config.id,
      description: config.fiscalDescription,
      amount: 850,
      competenceDate: "2026-09-10",
      origin: "manual",
    }),
    (error: unknown) => error instanceof FiscalError && error.code === "FISCAL_NOT_CONFIGURED",
  );
});

test("fiscal drafts are idempotent and isolated by workspace", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const { fiscal, draft } = await configured(f);
  const first = await fiscal.createDraft(f.a, draft);
  const duplicate = await fiscal.createDraft(f.a, draft);
  assert.equal(first.note.id, duplicate.note.id);
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  await assert.rejects(
    () => fiscal.createDraft(f.a, { ...draft, amount: 900 }),
    (error: unknown) => error instanceof FiscalError && error.code === "FISCAL_CONFLICT",
  );
  await assert.rejects(
    () => fiscal.get(f.b, first.note.id),
    (error: unknown) => error instanceof FiscalError && error.code === "FISCAL_NOT_FOUND",
  );
  assert.equal((await fiscal.list(f.b)).length, 0);
});

test("an authorized issue is reconciled once and certificate references stay server-only", async (t) => {
  enableIntegration(t);
  const f = await fixture();
  t.after(f.close);
  const { fiscal, provider, draft } = await configured(f);
  await addCertificate(f);
  const created = await fiscal.createDraft(f.a, draft);
  await fiscal.prepare(f.a, created.note.id);
  const issued = await fiscal.issue(f.a, created.note.id);
  assert.equal(issued.status, "AUTHORIZED");
  assert.equal(issued.providerReference, "provider-test-1");
  assert.equal((await fiscal.issue(f.a, created.note.id)).id, issued.id);
  assert.equal(provider.issued, 1);
  assert(!JSON.stringify(await fiscal.overview(f.a)).includes("kms://test/certificate"));
});

test("provider rejection is persisted before the safe error is returned", async (t) => {
  enableIntegration(t);
  const f = await fixture();
  t.after(f.close);
  const { fiscal, provider, draft } = await configured(f);
  await addCertificate(f);
  provider.failure = new FiscalError("FISCAL_PROVIDER_REJECTED", 422, { providerCode: "TEST_REJECTION" });
  const created = await fiscal.createDraft(f.a, draft);
  await fiscal.prepare(f.a, created.note.id);
  await assert.rejects(
    () => fiscal.issue(f.a, created.note.id),
    (error: unknown) => error instanceof FiscalError && error.code === "FISCAL_PROVIDER_REJECTED",
  );
  const failed = await fiscal.get(f.a, created.note.id);
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.errors[0].code, "FISCAL_PROVIDER_REJECTED");
  const errors = await f.db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM weeki_fiscal.nfse_errors WHERE workspace_id=$1 AND nfse_id=$2",
    [f.a.workspaceId, created.note.id],
  );
  assert.equal(Number(errors.rows[0].count), 1);
});

test("a provider timeout remains processing and a second click cannot retransmit", async (t) => {
  enableIntegration(t);
  const f = await fixture();
  t.after(f.close);
  const { fiscal, provider, draft } = await configured(f);
  await addCertificate(f);
  provider.failure = new FiscalError("FISCAL_PROVIDER_TIMEOUT", 504, { retryable: true });
  const created = await fiscal.createDraft(f.a, draft);
  await fiscal.prepare(f.a, created.note.id);
  await assert.rejects(() => fiscal.issue(f.a, created.note.id));
  assert.equal((await fiscal.get(f.a, created.note.id)).status, "PROCESSING");
  assert.equal((await fiscal.issue(f.a, created.note.id)).status, "PROCESSING");
  assert.equal(provider.issued, 1);
});

test("a paid charge emits one internal payment.confirmed event after duplicate webhooks", async (t) => {
  const f = await fixture();
  t.after(f.close);
  const charge = await f.service.createCharge(f.a, f.input, randomUUID());
  f.adapters[0].records.get(charge.id)!.status = "PAID";
  await f.service.syncCharge(f.a, charge.id);
  await f.service.syncCharge(f.a, charge.id);
  const events = await f.db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM weeki_core.domain_events WHERE workspace_id=$1 AND event_type='payment.confirmed' AND aggregate_id=$2",
    [f.a.workspaceId, charge.id],
  );
  assert.equal(Number(events.rows[0].count), 1);
});
