export function minutesToHours(minutes: number): string {
  const hours = minutes / 60;
  return hours.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function euro(value: number): string {
  return value.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}
