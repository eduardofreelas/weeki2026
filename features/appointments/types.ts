export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type AppointmentMode = "google_meet" | "video" | "in_person" | "phone";

export interface EventType {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  mode: AppointmentMode;
  price: number | null;
  includedInPlan: boolean;
  clientOnly: boolean;
  active: boolean;
  slug: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  typeId: string;
  clientId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  mode: AppointmentMode;
  location: string;
  meetingUrl: string;
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type EventTypeDraft = Omit<EventType, "id" | "createdAt" | "updatedAt">;
export type AppointmentDraft = Omit<Appointment, "id" | "createdAt" | "updatedAt">;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Aguardando aprovação",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const APPOINTMENT_MODE_LABELS: Record<AppointmentMode, string> = {
  google_meet: "Google Meet",
  video: "Videochamada",
  in_person: "Presencial",
  phone: "Telefone",
};
