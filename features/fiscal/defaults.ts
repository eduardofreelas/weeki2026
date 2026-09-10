import {
  emptyFiscalAddress,
  emptyFiscalIssuer,
  type FiscalAutomationSettings,
  type FiscalProfile,
} from "@/shared/fiscal";
import type { FiscalWorkspaceState } from "./types";

export const createDefaultFiscalProfile = (): FiscalProfile => ({
  ...emptyFiscalIssuer(),
  address: emptyFiscalAddress(),
  provider: "national_nfse",
  environment: "sandbox",
  configuredAt: null,
  updatedAt: null,
});

export const defaultFiscalAutomation = (): FiscalAutomationSettings => ({
  enabled: false,
  mode: "never",
  sendEmail: false,
  saveToClient: true,
  attachToService: true,
  attachToCharge: true,
  whatsappEnabled: false,
});

export const createDefaultFiscalState = (): FiscalWorkspaceState => ({
  version: 1,
  profile: createDefaultFiscalProfile(),
  certificate: null,
  serviceConfigs: [],
  notes: [],
  automation: defaultFiscalAutomation(),
  onboardingDismissed: false,
});
