import type { ReportTemplate } from "@/shared/reports";

const now = () => new Date().toISOString();

export function createSeedReportTemplates(): ReportTemplate[] {
  const createdAt = now();
  return [
    {
      id: "template-monthly-services",
      name: "Relatório mensal de serviços",
      description: "Capa, resumo executivo, indicadores, atividades, evidências e próximos passos.",
      type: "monthly_services",
      defaultBlocks: ["cover", "executive_summary", "indicators", "activities", "deliverables", "files", "in_progress", "next_steps", "observations", "signature"],
      visual: {},
      favorite: true,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "template-activities",
      name: "Relatório de atividades",
      description: "Lista objetiva de atividades executadas, status e evidências relacionadas.",
      type: "activities",
      defaultBlocks: ["cover", "executive_summary", "indicators", "activities", "files", "signature"],
      visual: {},
      favorite: true,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "template-simple",
      name: "Relatório simples",
      description: "Estrutura enxuta para prestação de contas rápida.",
      type: "custom",
      defaultBlocks: ["cover", "executive_summary", "activities", "observations", "signature"],
      visual: {},
      favorite: false,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "template-detailed",
      name: "Relatório detalhado",
      description: "Modelo completo com indicadores, atividades, horas, financeiro e conclusão.",
      type: "custom",
      defaultBlocks: ["cover", "executive_summary", "indicators", "activities", "deliverables", "files", "hours", "financial", "in_progress", "next_steps", "observations", "conclusion", "signature"],
      visual: {},
      favorite: false,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "template-technical",
      name: "Relatório técnico",
      description: "Pensado para visitas, verificações, ocorrências, fotos e observações.",
      type: "technical",
      defaultBlocks: ["cover", "executive_summary", "indicators", "activities", "images", "before_after", "in_progress", "next_steps", "observations", "signature"],
      visual: {},
      favorite: false,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}
