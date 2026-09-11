import { z } from "zod";
import { WEEKDAYS } from "../../shared/availability.js";
import type { AuthProviderId, OnboardingStep, OnboardingStatus } from "../../shared/account.js";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdayKeys = WEEKDAYS.map((day) => day.key) as ["0", "1", "2", "3", "4", "5", "6"];
const onboardingSteps: [OnboardingStep, ...OnboardingStep[]] = ["work", "space", "availability", "connections", "done"];
const onboardingStatuses: [OnboardingStatus, ...OnboardingStatus[]] = ["not_started", "in_progress", "skipped", "completed"];
export const authProviders: [AuthProviderId, ...AuthProviderId[]] = ["oidc", "email", "google", "apple"];

export const availabilityInputSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  minNoticeMinutes: z.coerce.number().int().min(0).max(525600),
  maxFutureDays: z.coerce.number().int().min(1).max(730),
  weekly: z.record(
    z.enum(weekdayKeys),
    z.object({
      enabled: z.boolean(),
      periods: z.array(z.object({
        id: z.string().trim().min(1).max(80),
        start: time,
        end: time,
      })).max(12),
    }),
  ),
  exceptions: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["available", "blocked", "holiday", "vacation"]),
    start: time.optional(),
    end: time.optional(),
    note: z.string().max(500).optional(),
  })).max(500).optional(),
  configuredAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export const profileInputSchema = z.object({
  name: z.string().trim().max(120).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  professionalName: z.string().trim().max(140).optional(),
  businessName: z.string().trim().max(140).optional(),
  businessArea: z.string().trim().max(120).optional(),
  workDescription: z.string().trim().max(500).optional(),
  workspaceName: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(80).optional(),
});

export const onboardingInputSchema = z.object({
  status: z.enum(onboardingStatuses).optional(),
  step: z.enum(onboardingSteps).optional(),
  completedSteps: z.array(z.enum(onboardingSteps)).max(5).optional(),
});

export const passwordRequestSchema = z.object({
  email: z.string().email().max(254),
});
