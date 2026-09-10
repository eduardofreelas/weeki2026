import { z } from "zod";

const limited = (max = 255) => z.string().trim().max(max);
const addressSchema = z.object({
  street: limited(),
  number: limited(30),
  complement: limited(120),
  district: limited(120),
  zipCode: limited(12),
  city: limited(120),
  cityCode: limited(12),
  state: limited(2),
  countryCode: z.literal("BR"),
}).strict();

const issuerSchema = z.object({
  personType: z.enum(["individual", "company"]),
  document: limited(24),
  legalName: limited(255),
  tradeName: limited(255),
  municipalRegistration: limited(50),
  email: limited(320),
  phone: limited(30),
  address: addressSchema,
  taxRegime: z.enum(["", "mei", "simples_nacional", "presumed_profit", "actual_profit", "other"]),
  simpleNational: z.boolean(),
  mei: z.boolean(),
}).strict();

const taxSchema = z.object({
  issRate: z.number().finite().min(0).max(100),
  issWithheld: z.boolean(),
  inssWithheld: z.boolean(),
  irWithheld: z.boolean(),
  csllWithheld: z.boolean(),
  pisWithheld: z.boolean(),
  cofinsWithheld: z.boolean(),
  approximateTaxAmount: z.number().finite().min(0),
}).strict();

export const fiscalProfileSchema = issuerSchema.extend({
  provider: z.enum(["national_nfse", "focus_nfe", "plugnotas"]),
  environment: z.enum(["sandbox", "production"]),
  configuredAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
}).strict();

export const fiscalAutomationSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["never", "ask_on_service_completion", "on_service_completion", "on_payment_confirmed"]),
  sendEmail: z.boolean(),
  saveToClient: z.boolean(),
  attachToService: z.boolean(),
  attachToCharge: z.boolean(),
  whatsappEnabled: z.literal(false),
}).strict();

export const fiscalServiceSchema = z.object({
  id: z.string().uuid().optional(),
  localId: limited(128),
  name: limited(255),
  fiscalDescription: limited(2000),
  serviceCode: limited(80),
  taxationCode: limited(80),
  defaultAmount: z.number().finite().min(0),
  incidenceCity: limited(120),
  incidenceCityCode: limited(12),
  operationNature: limited(120),
  tax: taxSchema,
  active: z.boolean(),
}).strict();

const customerSchema = z.object({
  localId: limited(128),
  personType: z.enum(["individual", "company"]),
  document: limited(24),
  name: limited(255),
  municipalRegistration: limited(50),
  email: limited(320),
  phone: limited(30),
  address: addressSchema,
}).strict();

export const createFiscalDraftSchema = z.object({
  idempotencyKey: z.string().min(8).max(160).regex(/^[A-Za-z0-9:_-]+$/),
  clientId: limited(128).min(1),
  customer: customerSchema,
  serviceConfigId: z.string().uuid(),
  description: limited(2000),
  amount: z.number().finite().positive().max(1_000_000_000),
  competenceDate: z.string().date(),
  origin: z.enum(["manual", "service_completion", "payment_confirmed", "automation"]),
  taskId: limited(128).nullable().optional(),
  chargeId: limited(128).nullable().optional(),
  projectId: limited(128).nullable().optional(),
}).strict();
