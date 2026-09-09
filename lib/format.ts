export function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);
}

export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    const part = digits;
    if (part.length <= 3) return part;
    if (part.length <= 6) return `${part.slice(0, 3)}.${part.slice(3)}`;
    if (part.length <= 9) return `${part.slice(0, 3)}.${part.slice(3, 6)}.${part.slice(6)}`;
    return `${part.slice(0, 3)}.${part.slice(3, 6)}.${part.slice(6, 9)}-${part.slice(9)}`;
  }
  const part = digits;
  if (part.length <= 12) return `${part.slice(0, 2)}.${part.slice(2, 5)}.${part.slice(5, 8)}/${part.slice(8)}`;
  return `${part.slice(0, 2)}.${part.slice(2, 5)}.${part.slice(5, 8)}/${part.slice(8, 12)}-${part.slice(12)}`;
}
