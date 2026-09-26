import "server-only";
import {
  buildCandidateList,
  buildPrompt,
  GEMINI_RESPONSE_SCHEMA,
  isValidMatchResult,
  MatchResult,
  SubmissionForMatching,
} from "./geminiMatching";

export type { SubmissionForMatching, MatchResult, BudgetCheck, CalendarCheck } from "./geminiMatching";
export { buildCandidateList } from "./geminiMatching";

// The only matching logic in the app: one Gemini call at lock time that
// picks a SINGLE finalized destination — not a ranked shortlist. The model
// is constrained to candidates the group itself suggested (preferred_locations,
// falling back to destination_types if nobody gave a location); it cannot
// introduce a place nobody named. Pure prompt/validation logic lives in
// geminiMatching.ts (see that file for why it's split out).

async function callGeminiOnce(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text content");
  return JSON.parse(text); // throws on malformed JSON — caller treats as an invalid attempt
}

/**
 * Calls Gemini once; if the response isn't well-formed JSON matching
 * MatchResult (including "finalized_trip is actually one of the candidates"),
 * retries exactly once. Throws if both attempts fail — the caller
 * (sessionDb.ts) is responsible for surfacing that as an error state rather
 * than writing a partial/bad `results` row.
 */
export async function matchDestinations(submissions: SubmissionForMatching[]): Promise<MatchResult> {
  const candidates = buildCandidateList(submissions);
  if (candidates.length === 0) {
    throw new Error("No candidate locations or destination types were submitted — nothing to finalize");
  }
  const prompt = buildPrompt(submissions, candidates);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = await callGeminiOnce(prompt);
      if (isValidMatchResult(parsed, candidates)) return parsed;
      console.error(`Gemini attempt ${attempt}: response failed shape/candidate validation`, parsed);
    } catch (err) {
      console.error(`Gemini attempt ${attempt} failed:`, err);
    }
  }

  throw new Error("Gemini did not return a valid finalized trip after 2 attempts");
}
