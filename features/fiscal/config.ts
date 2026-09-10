const enabled = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : value === "true";

export const FISCAL_FLAGS = {
  moduleEnabled: enabled(process.env.NEXT_PUBLIC_FISCAL_MODULE_ENABLED, true),
  apiEnabled: enabled(process.env.NEXT_PUBLIC_FISCAL_API_ENABLED),
  nationalIntegrationEnabled: enabled(
    process.env.NEXT_PUBLIC_NFSE_NATIONAL_INTEGRATION_ENABLED,
  ),
  autoIssueEnabled: enabled(process.env.NEXT_PUBLIC_NFSE_AUTO_ISSUE_ENABLED),
  whatsappEnabled: enabled(process.env.NEXT_PUBLIC_NFSE_WHATSAPP_ENABLED),
} as const;

export const FISCAL_VISUAL_MODE = !FISCAL_FLAGS.apiEnabled;
