import type { EntryStatus } from "../api/types";

const MAP: Record<EntryStatus, { label: string; className: string }> = {
  submitted: { label: "Ter goedkeuring", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Geaccordeerd", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Afgekeurd", className: "bg-rose-100 text-rose-800" },
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  const { label, className } = MAP[status];
  return <span className={`badge ${className}`}>{label}</span>;
}
