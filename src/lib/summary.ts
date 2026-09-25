// The ONLY place an LLM call would ever be allowed to touch: turning
// already-computed fit scores into a one-line plain-language summary. It
// must never see raw preferences and must never influence scoring or the
// final decision.
//
// Not wired up yet by design — get the rule-based scoring and the
// auto/deadline-driven trip flow solid first. `summarizeDestinationFit` is
// the integration point: swap its body for a real model call (Gemini or
// otherwise) when that's ready. Until then it just returns the fallback.
import { DestinationScore } from "./scoring";

export function buildFallbackSummary(ds: DestinationScore): string {
  const total = ds.participantFits.length;
  const fullFits = ds.participantFits.filter((f) => f.criteriaPassed === 4).length;
  const issues = ds.participantFits
    .filter((f) => f.criteriaPassed < 4)
    .map((f) => {
      const failed = [f.budget, f.dates, f.destinationType, f.dealbreakers].filter((c) => !c.pass);
      return `${f.participantName} (${failed.length} issue${failed.length > 1 ? "s" : ""})`;
    });
  if (fullFits === total) return `Works well for everyone in the group.`;
  return `Works well for ${fullFits} of ${total}${issues.length ? `, tight for ${issues.join(", ")}` : ""}.`;
}

// --- AI SUMMARY INTEGRATION POINT (not wired up) -----------------------
// When ready: check for an API key, call the model with only the
// already-computed pass/fail facts from `ds` (never raw preferences), and
// fall back to buildFallbackSummary on any error or missing key.
export async function summarizeDestinationFit(ds: DestinationScore): Promise<string> {
  return buildFallbackSummary(ds);
}
