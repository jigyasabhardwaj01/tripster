"use client";

import { useEffect, useState } from "react";
import { computeCountdown } from "@/lib/countdown";

export default function CountdownTimer({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire?: () => void;
}) {
  const [countdown, setCountdown] = useState(() => computeCountdown(deadline));

  useEffect(() => {
    const tick = () => {
      const next = computeCountdown(deadline);
      setCountdown(next);
      if (next.expired) onExpire?.();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return (
    <p
      className={`rounded-xl px-4 py-2 text-center text-sm font-medium ${
        countdown.expired ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-800"
      }`}
    >
      {countdown.expired ? "Deadline passed — locking in results…" : countdown.label}
    </p>
  );
}
