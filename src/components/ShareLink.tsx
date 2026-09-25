"use client";

import { useState } from "react";

export default function ShareLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can be unavailable (e.g. http, older WebViews) — no-op, link is still selectable
    }
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
      <p className="text-xs font-medium text-brand-700">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
