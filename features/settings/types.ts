export type WeekiTheme = "light" | "dark" | "system";
export type InterfaceDensity = "comfortable" | "compact";
export type TimeFormat = "24h" | "12h";
export type WeekStartDay = "monday" | "sunday";
export type IntegrationId = "google_calendar" | "google_drive" | "trello" | "asaas";

export interface WeekiProfileSettings {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  role: string;
}

export interface WeekiRegionalSettings {
  timezone: string;
  language: "pt-BR";
  dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd";
  timeFormat: TimeFormat;
  weekStartsOn: WeekStartDay;
  currency: "BRL";
}

export interface WeekiAppearanceSettings {
  theme: WeekiTheme;
  density: InterfaceDensity;
}

export interface WeekiNotificationSettings {
  inApp: boolean;
  email: boolean;
  dailySummary: boolean;
  deadlineReminders: boolean;
  appointmentReminders: boolean;
  paymentUpdates: boolean;
  productNews: boolean;
}

export interface WeekiSecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionTimeout: "7d" | "30d" | "90d";
}

export interface WeekiPrivacySettings {
  usageAnalytics: boolean;
  personalization: boolean;
}

export interface WeekiSettings {
  profile: WeekiProfileSettings;
  regional: WeekiRegionalSettings;
  appearance: WeekiAppearanceSettings;
  notifications: WeekiNotificationSettings;
  security: WeekiSecuritySettings;
  privacy: WeekiPrivacySettings;
  integrations: Record<IntegrationId, boolean>;
}

