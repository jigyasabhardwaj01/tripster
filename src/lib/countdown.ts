export interface Countdown {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string; // e.g. "2d 3h 14m left" or "Deadline passed"
}

export function computeCountdown(deadlineIso: string, now: number = Date.now()): Countdown {
  const diffMs = new Date(deadlineIso).getTime() - now;
  if (diffMs <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, label: "Deadline passed" };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  if (days === 0 && hours === 0) parts.push(`${seconds}s`); // only show seconds in the final minutes

  return { expired: false, days, hours, minutes, seconds, label: `${parts.join(" ")} left` };
}
