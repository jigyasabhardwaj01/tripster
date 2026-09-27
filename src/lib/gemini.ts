import "server-only";
import {
  buildCandidateList,
  buildDiscoveryFormatPrompt,
  buildDiscoverySearchPrompt,
  buildFromPicksPrompt,
  isValidFromPicksRecommendation,
  isValidRecommendation,
  Recommendation,
  RECOMMENDATION_SCHEMA,
  SubmissionForMatching,
} from "./geminiMatching";

export type { SubmissionForMatching, Recommendation, BudgetEstimate, SuggestedWindow } from "./geminiMatching";
export { buildCandidateList } from "./geminiMatching";

const MODEL = "gemini-3.5-flash";

async function callGemini(body: Record<string, unknown>): Promise<{ text: string; grounded: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text content");
  return { text, grounded: Boolean(candidate?.groundingMetadata) };
}

async function callGeminiJson(prompt: string, schema: unknown): Promise<unknown> {
  const { text } = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  return JSON.parse(text); // throws on malformed JSON — caller treats as an invalid attempt
}

/** From-picks destination: retries once, throws if both attempts fail — never a place nobody named. */
export async function generateFromPicks(submissions: SubmissionForMatching[]): Promise<Recommendation | null> {
  const candidates = buildCandidateList(submissions);
  if (candidates.length === 0) return null; // nobody named a specific place — nothing to pick from, no exceptions

  const prompt = buildFromPicksPrompt(submissions, candidates);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = await callGeminiJson(prompt, RECOMMENDATION_SCHEMA);
      if (isValidFromPicksRecommendation(parsed, candidates)) return parsed;
      console.error(`from_picks attempt ${attempt}: response failed shape/candidate validation`, parsed);
    } catch (err) {
      console.error(`from_picks attempt ${attempt} failed:`, err);
    }
  }
  throw new Error("Gemini did not return a valid from-picks recommendation after 2 attempts");
}

export interface DiscoveredResult {
  recommendation: Recommendation;
  verified: boolean; // true only if a real, grounded web search actually ran (groundingMetadata present)
}

/**
 * Two calls, not one: combining Gemini's google_search tool with
 * responseSchema-constrained JSON output in a single call does NOT actually
 * invoke the search (confirmed live — no groundingMetadata came back, just
 * a plausible-sounding guess). So: call 1 does real grounded research in
 * plain text (search tool, no schema); call 2 formats ONLY those findings
 * into the strict schema (schema, no search tool) — it can't add facts call
 * 1 didn't produce. If call 1 never actually grounds, or either call fails
 * validation twice, falls back to a single ungrounded structured call and
 * reports verified: false so the frontend labels it honestly.
 */
export async function generateDiscovered(submissions: SubmissionForMatching[]): Promise<DiscoveredResult> {
  try {
    const { text: findings, grounded } = await callGemini({
      contents: [{ role: "user", parts: [{ text: buildDiscoverySearchPrompt(submissions) }] }],
      tools: [{ google_search: {} }],
    });

    if (grounded) {
      const formatPrompt = buildDiscoveryFormatPrompt(findings);
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const parsed = await callGeminiJson(formatPrompt, RECOMMENDATION_SCHEMA);
          if (isValidRecommendation(parsed)) return { recommendation: parsed, verified: true };
          console.error(`discovered format attempt ${attempt}: response failed shape validation`, parsed);
        } catch (err) {
          console.error(`discovered format attempt ${attempt} failed:`, err);
        }
      }
      // Grounded research came back but formatting it twice failed — fall through to the ungrounded fallback below rather than losing the slot entirely.
    }
  } catch (err) {
    console.error("Discovered-destination search step failed or was unavailable:", err);
  }

  // Fallback: no real grounding happened (tool unsupported/unavailable, or
  // formatting the grounded findings failed twice) — say so via verified:false
  // rather than presenting a guess with the same confidence as a real search result.
  const ungroundedPrompt = `${buildDiscoverySearchPrompt(submissions)}\n\nReturn your best answer directly in the exact structure requested below (destination, summary, suggested_window, budget_estimate, attractions) even without search results.`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = await callGeminiJson(ungroundedPrompt, RECOMMENDATION_SCHEMA);
      if (isValidRecommendation(parsed)) return { recommendation: parsed, verified: false };
      console.error(`discovered fallback attempt ${attempt}: response failed shape validation`, parsed);
    } catch (err) {
      console.error(`discovered fallback attempt ${attempt} failed:`, err);
    }
  }
  throw new Error("Gemini did not return a valid discovered recommendation after fallback attempts");
}
