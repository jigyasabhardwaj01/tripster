export function formatDeadline(deadlineIso: string): string {
  const deadline = new Date(deadlineIso);
  const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const dateLabel = deadline.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (hoursLeft <= 0) return `Confirmation window closed (${dateLabel})`;
  if (hoursLeft < 1) return `Confirm by ${dateLabel} — less than an hour left`;
  const rounded = Math.round(hoursLeft);
  return `Confirm by ${dateLabel} — ${rounded} hour${rounded === 1 ? "" : "s"} left`;
}
