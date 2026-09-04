export type TaskStatus = "not_started" | "in_progress" | "waiting" | "review" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "custom";

export interface Client { id: string; name: string; color: string; initials: string; }
export interface ChecklistItem { id: string; label: string; completed: boolean; }
export interface Attachment { id: string; name: string; size: number; type: string; }
export interface ActivityItem { id: string; text: string; createdAt: string; }
export interface Recurrence { type: RecurrenceType; days: number[]; }

export interface Task {
  id: string;
  title: string;
  description: string;
  clientId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledDate: string | null;
  scheduledTime: string;
  dueDate: string;
  dueTime: string;
  estimateMinutes: number | null;
  tags: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  notes: string;
  recurrence: Recurrence;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activity: ActivityItem[];
}

export type TaskDraft = Omit<Task, "id" | "createdAt" | "updatedAt" | "activity">;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  waiting: "Aguardando cliente",
  review: "Em revisão",
  completed: "Concluído",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "Não repetir",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  custom: "Dias personalizados",
};
