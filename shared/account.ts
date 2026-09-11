import type { WeekiAvailability } from "./availability.js";

export type AuthProviderId = "oidc" | "email" | "google" | "apple";
export type OnboardingStep = "work" | "space" | "availability" | "connections" | "done";
export type OnboardingStatus = "not_started" | "in_progress" | "skipped" | "completed";

export interface ConnectedAuthProvider {
  provider: AuthProviderId;
  label: string;
  issuer: string;
  email: string;
  connectedAt: string;
  lastLoginAt: string;
}

export interface AccountProfile {
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  phone: string;
  professionalName: string;
  businessName: string;
  businessArea: string;
  workDescription: string;
  workspaceName: string;
  timezone: string;
  termsAcceptedAt: string | null;
  privacyPolicyAcceptedAt: string | null;
}

export interface OnboardingState {
  status: OnboardingStatus;
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  skippedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface AccountSession {
  authConfigured: boolean;
  authenticated: boolean;
  userId: string;
  workspaceId: string;
  profile: AccountProfile;
  onboarding: OnboardingState;
  providers: ConnectedAuthProvider[];
  availability: WeekiAvailability;
}

export interface AccountSessionResponse {
  authConfigured: boolean;
  authenticated: boolean;
  session: AccountSession | null;
  message?: string;
}

export interface AccountProfileInput {
  name?: string;
  avatarUrl?: string;
  phone?: string;
  professionalName?: string;
  businessName?: string;
  businessArea?: string;
  workDescription?: string;
  workspaceName?: string;
  timezone?: string;
}

export interface OnboardingInput {
  status?: OnboardingStatus;
  step?: OnboardingStep;
  completedSteps?: OnboardingStep[];
}

export const ONBOARDING_STEPS: Array<{ id: Exclude<OnboardingStep, "done">; label: string }> = [
  { id: "work", label: "Seu trabalho" },
  { id: "space", label: "Seu espaco" },
  { id: "availability", label: "Disponibilidade" },
  { id: "connections", label: "Conexoes" },
];

export function defaultOnboardingState(status: OnboardingStatus = "not_started"): OnboardingState {
  return {
    status,
    step: status === "completed" ? "done" : "work",
    completedSteps: [],
    skippedAt: null,
    completedAt: status === "completed" ? new Date().toISOString() : null,
    updatedAt: null,
  };
}
