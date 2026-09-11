import type { ReportBlockKind, WeekiReport } from "@/shared/reports";

export type ReportAiAction =
  | "executive_summary"
  | "summarize_activities"
  | "improve_text"
  | "conclusion"
  | "highlight_results"
  | "identify_pending"
  | "next_steps"
  | "activity_description";

export const REPORTS_AI_FLAGS = {
  apiEnabled: process.env.NEXT_PUBLIC_WEEKI_REPORTS_AI_API === "enabled",
};

export interface ReportAiPayload {
  action: ReportAiAction;
  reportId: string;
  blockKind: ReportBlockKind | null;
  allowedContext: {
    title: string;
    clientName: string;
    periodStart: string;
    periodEnd: string;
    activities: Array<{
      title: string;
      description: string;
      status: string;
      date: string;
    }>;
    metrics: Array<{ label: string; value: string; detail: string }>;
  };
  guardrails: string[];
}

export function buildReportAiPayload(report: WeekiReport, action: ReportAiAction, blockKind: ReportBlockKind | null): ReportAiPayload {
  return {
    action,
    reportId: report.id,
    blockKind,
    allowedContext: {
      title: report.title,
      clientName: report.clientName,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      activities: report.sourceSnapshot.activities.map((activity) => ({
        title: activity.title,
        description: activity.description,
        status: activity.statusLabel,
        date: activity.date,
      })),
      metrics: report.metrics.map((metric) => ({ label: metric.label, value: metric.value, detail: metric.detail })),
    },
    guardrails: [
      "Use apenas dados presentes no payload.",
      "Nao invente resultados, valores, datas, clientes, metricas ou atividades.",
      "Quando uma informacao estiver ausente, escreva de forma neutra ou indique que nao foi registrada.",
      "Retorne texto editavel, sem promessas juridicas ou aceite formal.",
    ],
  };
}
