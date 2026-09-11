import { z } from "zod";
import {
  CONTRACT_CREATION_SOURCES,
  CONTRACT_VARIABLES,
  CONTRACT_EDITORIAL_STATUSES,
  CONTRACT_SIGNATURE_STATUSES,
  type ContractVariableId,
} from "../../shared/contracts.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));
const safeText = (max = 1000) => z.string().trim().max(max);
const contractVariableIdSchema = z.custom<ContractVariableId>(
  (value) => typeof value === "string" && CONTRACT_VARIABLES.some((variable) => variable.id === value),
);

const businessSnapshot = z.object({
  name: safeText(200),
  document: safeText(40),
  email: safeText(254),
  phone: safeText(40),
  representativeName: safeText(200),
  representativeRole: safeText(120),
  address: safeText(500),
}).strict();

const clientSnapshot = z.object({
  id: safeText(120),
  name: safeText(200),
  kind: z.enum(["individual", "company"]),
  document: safeText(40),
  email: safeText(254),
  phone: safeText(40),
  address: safeText(500),
  representativeName: safeText(200),
  representativeRole: safeText(120),
  capturedAt: z.string().datetime(),
}).strict().nullable();

const serviceSnapshot = z.object({
  id: safeText(120).nullable(),
  title: safeText(200),
  description: safeText(4000),
  scope: safeText(8000),
  deliverables: safeText(4000),
  deadline: safeText(1000),
  revisions: safeText(200),
  providerResponsibilities: safeText(4000),
  clientResponsibilities: safeText(4000),
  source: z.enum(["manual", "task", "fiscal_service", "proposal"]),
}).strict();

const billingSnapshot = z.object({
  id: safeText(120).nullable(),
  code: safeText(80),
  description: safeText(500),
  amount: z.number().min(0).max(999999999),
  dueDate: isoDate,
  paymentMethods: z.array(safeText(60)).max(8),
}).strict().nullable();

export const contractSourceSnapshotSchema = z.object({
  business: businessSnapshot,
  client: clientSnapshot,
  service: serviceSnapshot,
  billing: billingSnapshot,
  proposal: z.object({
    id: safeText(120).nullable(),
    title: safeText(200),
    fileName: safeText(260),
  }).strict().nullable(),
  capturedAt: z.string().datetime(),
}).strict();

export const contractTermsSchema = z.object({
  value: z.number().min(0).max(999999999),
  paymentTerms: safeText(4000),
  installments: z.number().int().min(1).max(240),
  firstDueDate: isoDate,
  lateFeePercent: z.number().min(0).max(100),
  dailyInterestPercent: z.number().min(0).max(100),
  adjustment: safeText(1000),
  startDate: isoDate,
  endDate: isoDate,
  cancellation: safeText(4000),
  termination: safeText(4000),
  confidentiality: z.boolean(),
  intellectualProperty: safeText(4000),
  portfolioAllowed: z.boolean(),
  dataProtection: safeText(4000),
  jurisdiction: safeText(200),
  additionalClauses: safeText(8000),
}).strict();

export const contractPartySchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["individual", "company"]),
  name: safeText(200),
  document: safeText(40),
  email: safeText(254),
  phone: safeText(40),
  address: safeText(500),
  role: safeText(80),
  representativeName: safeText(200),
  representativeRole: safeText(120),
  snapshotSource: z.enum(["business", "client", "manual"]),
}).strict();

export const contractSignerSchema = z.object({
  id: z.string().uuid().optional(),
  partyId: z.string().uuid().nullable().optional(),
  name: safeText(200),
  email: safeText(254),
  document: safeText(40),
  role: safeText(80),
  order: z.number().int().min(1).max(50),
  authMethod: z.enum(["provider_default", "email", "sms", "certificate"]),
  status: z.enum(CONTRACT_SIGNATURE_STATUSES).optional(),
  viewedAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  lastEventAt: z.string().datetime().nullable().optional(),
  externalId: z.string().max(200).optional(),
}).strict();

export const contractDraftSchema = z.object({
  source: z.enum(CONTRACT_CREATION_SOURCES),
  title: safeText(200),
  clientId: safeText(120).nullable(),
  templateId: safeText(120).nullable(),
  relatedServiceId: safeText(120).nullable(),
  relatedTaskId: safeText(120).nullable(),
  proposalId: safeText(120).nullable(),
  chargeId: safeText(120).nullable(),
  sourceSnapshot: contractSourceSnapshotSchema,
  terms: contractTermsSchema,
  parties: z.array(contractPartySchema).min(1).max(12),
  signers: z.array(contractSignerSchema).max(20),
  signingMode: z.enum(["simultaneous", "ordered"]),
  signatureMessage: safeText(2000),
  content: z.string().min(1).max(60000),
  aiGenerated: z.boolean().optional(),
  aiProvider: z.string().max(80).nullable().optional(),
}).strict();

export const contractUpdateSchema = z.object({
  title: safeText(200).optional(),
  editorialStatus: z.enum(CONTRACT_EDITORIAL_STATUSES).optional(),
  reviewConfirmed: z.boolean().optional(),
  terms: contractTermsSchema.partial().optional(),
  parties: z.array(contractPartySchema).min(1).max(12).optional(),
  signers: z.array(contractSignerSchema).max(20).optional(),
  signingMode: z.enum(["simultaneous", "ordered"]).optional(),
  signatureMessage: safeText(2000).optional(),
  content: z.string().min(1).max(60000).optional(),
}).strict();

export const contractTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: safeText(160),
  description: safeText(1000),
  category: safeText(80),
  content: z.string().min(1).max(60000),
  variables: z.array(z.object({
    id: contractVariableIdSchema,
    required: z.boolean(),
    fallback: safeText(500),
  }).strict()).max(60),
  favorite: z.boolean(),
  archivedAt: z.string().datetime().nullable().optional(),
}).strict();

export const aiGenerateSchema = z.object({
  contractId: z.string().uuid().optional(),
  instructions: safeText(6000),
  sourceSnapshot: contractSourceSnapshotSchema,
  terms: contractTermsSchema,
  clauses: z.object({
    cancellation: safeText(4000),
    termination: safeText(4000),
    intellectualProperty: safeText(4000),
    dataProtection: safeText(4000),
    additionalClauses: safeText(8000),
  }).strict(),
}).strict();

export const signatureSendSchema = z.object({
  expiresAt: z.string().datetime().optional(),
}).strict();

export const reasonSchema = z.object({
  reason: safeText(1000).optional(),
}).strict();
