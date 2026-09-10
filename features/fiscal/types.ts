import type {
  FiscalAutomationSettings,
  FiscalCertificateMetadata,
  FiscalCustomer,
  FiscalProfile,
  FiscalService,
  FiscalServiceConfig,
  NfseOrigin,
  NfseRecord,
} from "@/shared/fiscal";

export interface FiscalWorkspaceState {
  version: 1;
  profile: FiscalProfile;
  certificate: FiscalCertificateMetadata | null;
  serviceConfigs: FiscalServiceConfig[];
  notes: NfseRecord[];
  automation: FiscalAutomationSettings;
  onboardingDismissed: boolean;
}

export interface NfseDraftInput {
  idempotencyKey?: string;
  clientId: string;
  serviceConfigId: string;
  description: string;
  amount: number;
  competenceDate: string;
  origin: NfseOrigin;
  taskId?: string | null;
  chargeId?: string | null;
  projectId?: string | null;
  customerOverride?: Partial<Omit<FiscalCustomer, "address">> & {
    address?: Partial<FiscalCustomer["address"]>;
  };
  serviceOverride?: Partial<Omit<FiscalService, "tax">> & {
    tax?: Partial<FiscalService["tax"]>;
  };
}

export interface FiscalPendingAction {
  source: "service" | "payment";
  sourceId: string;
  clientId: string;
  title: string;
  description: string;
  amount: number;
  competenceDate: string;
}

export interface CreateNfseResult {
  note: NfseRecord | null;
  duplicate: boolean;
  issues: Array<{ field: string; message: string }>;
}
