import { randomUUID } from "node:crypto";
import type { Database, Sql } from "../db.js";
import { PaymentError } from "../payments/errors.js";
import { authorize, inWorkspace, type Scope } from "../payments/repository.js";
import {
  createDefaultAvailability,
  isAvailabilityConfigured,
  normalizeAvailability,
  validateAvailability,
  WEEKDAYS,
  type AvailabilityException,
  type WeekdayKey,
  type WeekiAvailability,
} from "../../shared/availability.js";
import {
  defaultOnboardingState,
  type AccountProfile,
  type AccountProfileInput,
  type AccountSession,
  type AuthProviderId,
  type ConnectedAuthProvider,
  type OnboardingInput,
  type OnboardingState,
  type OnboardingStep,
} from "../../shared/account.js";
import { availabilityInputSchema, onboardingInputSchema, profileInputSchema } from "./schemas.js";

const providerLabels: Record<AuthProviderId, string> = {
  oidc: "Provedor de identidade",
  email: "E-mail e senha",
  google: "Google",
  apple: "Apple",
};

interface ProfileRow {
  email: string | null;
  email_verified: boolean | null;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  professional_name: string | null;
  terms_accepted_at: Date | string | null;
  privacy_policy_accepted_at: Date | string | null;
  workspace_name: string | null;
  business_name: string | null;
  business_area: string | null;
  work_description: string | null;
  timezone: string | null;
}

interface OnboardingRow {
  status: OnboardingState["status"];
  step: OnboardingStep;
  completed_steps: OnboardingStep[] | string | null;
  skipped_at: Date | string | null;
  completed_at: Date | string | null;
  updated_at: Date | string | null;
}

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

function completedSteps(value: OnboardingRow["completed_steps"]) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .replace(/[{}"]/g, "")
    .split(",")
    .filter(Boolean) as OnboardingStep[];
}

async function ensureRows(sql: Sql, scope: Scope) {
  await sql.query(
    `INSERT INTO weeki_payments.user_profiles(user_id)
     VALUES($1)
     ON CONFLICT(user_id) DO NOTHING`,
    [scope.userId],
  );
  await sql.query(
    `INSERT INTO weeki_payments.onboarding_progress(workspace_id)
     VALUES($1)
     ON CONFLICT(workspace_id) DO NOTHING`,
    [scope.workspaceId],
  );
}

export async function upsertAuthProfile(
  sql: Sql,
  scope: Scope,
  input: {
    provider: AuthProviderId;
    issuer: string;
    subject: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    avatarUrl?: string;
    legalAccepted?: boolean;
  },
) {
  await ensureRows(sql, scope);
  const acceptedAt = input.legalAccepted ? new Date() : null;
  await sql.query(
    `INSERT INTO weeki_payments.auth_providers(user_id,provider,issuer,subject,email,display_name)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(provider,issuer,subject)
     DO UPDATE SET user_id=excluded.user_id,email=excluded.email,display_name=excluded.display_name,last_login_at=now()`,
    [
      scope.userId,
      input.provider,
      input.issuer,
      input.subject,
      input.email || "",
      input.name || "",
    ],
  );
  await sql.query(
    `UPDATE weeki_payments.user_profiles
     SET email=COALESCE(NULLIF($2,''), email),
         email_verified=$3 OR email_verified,
         name=COALESCE(NULLIF($4,''), name),
         avatar_url=COALESCE(NULLIF($5,''), avatar_url),
         professional_name=COALESCE(NULLIF($4,''), professional_name),
         terms_accepted_at=COALESCE(terms_accepted_at, $6),
         privacy_policy_accepted_at=COALESCE(privacy_policy_accepted_at, $6),
         updated_at=now()
     WHERE user_id=$1`,
    [
      scope.userId,
      input.email || "",
      Boolean(input.emailVerified),
      input.name || "",
      input.avatarUrl || "",
      acceptedAt,
    ],
  );
}

export class AccountService {
  constructor(public db: Database) {}

  async session(scope: Scope): Promise<AccountSession> {
    await authorize(this.db, scope);
    await ensureRows(this.db, scope);
    const [profile, onboarding, providers, availability] = await Promise.all([
      this.profile(scope),
      this.onboarding(scope),
      this.providers(scope),
      this.availability(scope),
    ]);
    return {
      authConfigured: true,
      authenticated: true,
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      profile,
      onboarding,
      providers,
      availability,
    };
  }

  async profile(scope: Scope): Promise<AccountProfile> {
    await authorize(this.db, scope);
    await ensureRows(this.db, scope);
    const rows = await this.db.query<ProfileRow>(
      `SELECT p.email,p.email_verified,p.name,p.avatar_url,p.phone,p.professional_name,
              p.terms_accepted_at,p.privacy_policy_accepted_at,
              w.name AS workspace_name,w.business_name,w.business_area,w.work_description,w.timezone
       FROM weeki_payments.user_profiles p
       JOIN weeki_payments.workspaces w ON w.id=$2
       WHERE p.user_id=$1`,
      [scope.userId, scope.workspaceId],
    );
    const row = rows.rows[0];
    if (!row) throw new PaymentError("NOT_FOUND", 404);
    const emailName = row.email?.split("@")[0] || "";
    return {
      name: row.name || row.professional_name || emailName,
      email: row.email || "",
      emailVerified: Boolean(row.email_verified),
      avatarUrl: row.avatar_url || "",
      phone: row.phone || "",
      professionalName: row.professional_name || row.name || "",
      businessName: row.business_name || "",
      businessArea: row.business_area || "",
      workDescription: row.work_description || "",
      workspaceName: row.workspace_name || "Meu espaco Weeki",
      timezone: row.timezone || "America/Fortaleza",
      termsAcceptedAt: iso(row.terms_accepted_at),
      privacyPolicyAcceptedAt: iso(row.privacy_policy_accepted_at),
    };
  }

  async updateProfile(scope: Scope, input: AccountProfileInput) {
    const data = profileInputSchema.parse(input);
    await inWorkspace(this.db, scope, async (sql) => {
      await ensureRows(sql, scope);
      await sql.query(
        `UPDATE weeki_payments.user_profiles
         SET name=COALESCE($2,name),
             avatar_url=COALESCE($3,avatar_url),
             phone=COALESCE($4,phone),
             professional_name=COALESCE($5,professional_name),
             updated_at=now()
         WHERE user_id=$1`,
        [
          scope.userId,
          data.name,
          data.avatarUrl,
          data.phone,
          data.professionalName,
        ],
      );
      await sql.query(
        `UPDATE weeki_payments.workspaces
         SET name=COALESCE($2,name),
             business_name=COALESCE($3,business_name),
             business_area=COALESCE($4,business_area),
             work_description=COALESCE($5,work_description),
             timezone=COALESCE($6,timezone),
             updated_at=now()
         WHERE id=$1`,
        [
          scope.workspaceId,
          data.workspaceName,
          data.businessName,
          data.businessArea,
          data.workDescription,
          data.timezone,
        ],
      );
    });
    return this.profile(scope);
  }

  async onboarding(scope: Scope): Promise<OnboardingState> {
    await authorize(this.db, scope);
    await ensureRows(this.db, scope);
    const rows = await this.db.query<OnboardingRow>(
      `SELECT status,step,completed_steps,skipped_at,completed_at,updated_at
       FROM weeki_payments.onboarding_progress WHERE workspace_id=$1`,
      [scope.workspaceId],
    );
    const row = rows.rows[0];
    if (!row) return defaultOnboardingState();
    return {
      status: row.status,
      step: row.step,
      completedSteps: completedSteps(row.completed_steps),
      skippedAt: iso(row.skipped_at),
      completedAt: iso(row.completed_at),
      updatedAt: iso(row.updated_at),
    };
  }

  async updateOnboarding(scope: Scope, input: OnboardingInput) {
    const data = onboardingInputSchema.parse(input);
    await inWorkspace(this.db, scope, async (sql) => {
      await ensureRows(sql, scope);
      const status = data.status;
      const step = status === "completed" ? "done" : data.step;
      await sql.query(
        `UPDATE weeki_payments.onboarding_progress
         SET status=COALESCE($2,status),
             step=COALESCE($3,step),
             completed_steps=COALESCE($4,completed_steps),
             skipped_at=CASE WHEN $2='skipped' THEN now() ELSE skipped_at END,
             completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END,
             updated_at=now()
         WHERE workspace_id=$1`,
        [
          scope.workspaceId,
          status,
          step,
          data.completedSteps,
        ],
      );
    });
    return this.onboarding(scope);
  }

  async providers(scope: Scope): Promise<ConnectedAuthProvider[]> {
    await authorize(this.db, scope);
    const rows = await this.db.query<{
      provider: AuthProviderId;
      issuer: string;
      email: string;
      connected_at: Date | string;
      last_login_at: Date | string;
    }>(
      `SELECT provider,issuer,email,connected_at,last_login_at
       FROM weeki_payments.auth_providers
       WHERE user_id=$1
       ORDER BY connected_at`,
      [scope.userId],
    );
    return rows.rows.map((row) => ({
      provider: row.provider,
      label: providerLabels[row.provider] || providerLabels.oidc,
      issuer: row.issuer,
      email: row.email || "",
      connectedAt: iso(row.connected_at)!,
      lastLoginAt: iso(row.last_login_at)!,
    }));
  }

  async availability(scope: Scope): Promise<WeekiAvailability> {
    await authorize(this.db, scope);
    await ensureRows(this.db, scope);
    const settings = await this.db.query<{
      timezone: string;
      default_duration_minutes: number;
      buffer_minutes: number;
      min_notice_minutes: number;
      max_future_days: number;
      configured_at: Date | string | null;
      updated_at: Date | string | null;
    }>(
      `SELECT timezone,default_duration_minutes,buffer_minutes,min_notice_minutes,max_future_days,configured_at,updated_at
       FROM weeki_payments.availability_settings WHERE workspace_id=$1`,
      [scope.workspaceId],
    );
    const profile = await this.profile(scope);
    if (!settings.rows[0]) return createDefaultAvailability(profile.timezone);
    const periods = await this.db.query<{
      id: string;
      weekday: number;
      starts_at: string;
      ends_at: string;
    }>(
      `SELECT id,weekday,starts_at::text,ends_at::text
       FROM weeki_payments.availability_periods
       WHERE workspace_id=$1
       ORDER BY weekday,starts_at`,
      [scope.workspaceId],
    );
    const exceptions = await this.db.query<{
      id: string;
      exception_date: string;
      kind: AvailabilityException["kind"];
      starts_at: string | null;
      ends_at: string | null;
      note: string;
    }>(
      `SELECT id,exception_date::text,kind,starts_at::text,ends_at::text,note
       FROM weeki_payments.availability_exceptions
       WHERE workspace_id=$1
       ORDER BY exception_date`,
      [scope.workspaceId],
    );
    const availability = createDefaultAvailability(settings.rows[0].timezone);
    for (const day of WEEKDAYS) availability.weekly[day.key] = { enabled: false, periods: [] };
    for (const period of periods.rows) {
      const key = String(period.weekday) as WeekdayKey;
      const day = availability.weekly[key];
      day.enabled = true;
      day.periods.push({
        id: period.id,
        start: period.starts_at.slice(0, 5),
        end: period.ends_at.slice(0, 5),
      });
    }
    return normalizeAvailability({
      ...availability,
      timezone: settings.rows[0].timezone,
      defaultDurationMinutes: settings.rows[0].default_duration_minutes,
      bufferMinutes: settings.rows[0].buffer_minutes,
      minNoticeMinutes: settings.rows[0].min_notice_minutes,
      maxFutureDays: settings.rows[0].max_future_days,
      exceptions: exceptions.rows.map((row) => ({
        id: row.id,
        date: row.exception_date.slice(0, 10),
        kind: row.kind,
        start: row.starts_at?.slice(0, 5),
        end: row.ends_at?.slice(0, 5),
        note: row.note,
      })),
      configuredAt: iso(settings.rows[0].configured_at),
      updatedAt: iso(settings.rows[0].updated_at),
    });
  }

  async saveAvailability(scope: Scope, input: WeekiAvailability) {
    const parsed = availabilityInputSchema.parse(input);
    const availability = normalizeAvailability(parsed as Partial<WeekiAvailability>);
    const result = validateAvailability(availability);
    if (!result.valid) throw new PaymentError("INVALID_INPUT", 422);
    await inWorkspace(this.db, scope, async (sql) => {
      await sql.query(
        `INSERT INTO weeki_payments.availability_settings(
           workspace_id,user_id,timezone,default_duration_minutes,buffer_minutes,min_notice_minutes,max_future_days,configured_at,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,now(),now())
         ON CONFLICT(workspace_id) DO UPDATE SET
           user_id=excluded.user_id,
           timezone=excluded.timezone,
           default_duration_minutes=excluded.default_duration_minutes,
           buffer_minutes=excluded.buffer_minutes,
           min_notice_minutes=excluded.min_notice_minutes,
           max_future_days=excluded.max_future_days,
           configured_at=COALESCE(weeki_payments.availability_settings.configured_at, now()),
           updated_at=now()`,
        [
          scope.workspaceId,
          scope.userId,
          availability.timezone,
          availability.defaultDurationMinutes,
          availability.bufferMinutes,
          availability.minNoticeMinutes,
          availability.maxFutureDays,
        ],
      );
      await sql.query("DELETE FROM weeki_payments.availability_periods WHERE workspace_id=$1", [scope.workspaceId]);
      let sort = 0;
      for (const day of WEEKDAYS) {
        const config = availability.weekly[day.key];
        if (!config.enabled) continue;
        for (const period of config.periods) {
          await sql.query(
            `INSERT INTO weeki_payments.availability_periods(id,workspace_id,weekday,starts_at,ends_at,sort_order)
             VALUES($1,$2,$3,$4,$5,$6)`,
            [
              randomUUID(),
              scope.workspaceId,
              Number(day.key),
              period.start,
              period.end,
              sort++,
            ],
          );
        }
      }
      await sql.query("DELETE FROM weeki_payments.availability_exceptions WHERE workspace_id=$1", [scope.workspaceId]);
      for (const exception of availability.exceptions) {
        await sql.query(
          `INSERT INTO weeki_payments.availability_exceptions(id,workspace_id,exception_date,kind,starts_at,ends_at,note)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            randomUUID(),
            scope.workspaceId,
            exception.date,
            exception.kind,
            exception.start || null,
            exception.end || null,
            exception.note || "",
          ],
        );
      }
      if (isAvailabilityConfigured(availability)) {
        await ensureRows(sql, scope);
        await sql.query(
          `UPDATE weeki_payments.onboarding_progress
           SET completed_steps=(
             SELECT ARRAY(SELECT DISTINCT unnest(completed_steps || ARRAY['availability']))
           ),
               updated_at=now()
           WHERE workspace_id=$1`,
          [scope.workspaceId],
        );
      }
    });
    return this.availability(scope);
  }
}
