import "server-only";

// This is now the ONLY matching logic in the app — there is no rule-based
// scoring running alongside it. One call, one JSON result, written to
// `results` exactly once per session (see src/lib/sessionDb.ts).

export interface SubmissionForMatching {
  name: string;
  budgetMin: number;
  budgetMax: number;
  dateRanges: { start: string; end: string }[];
  destinationTypes: string[];
  dealbreakers: string;
}

export interface MatchFit {
  name: string;
  score: number; // 1-5
  reason: string;
}

export interface MatchOption {
  destination: string;
  summary: string;
  fits: MatchFit[];
}

export interface MatchResult {
  options: MatchOption[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    options: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          destination: { type: "string" },
          summary: { type: "string" },
          fits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                score: { type: "integer" },
                reason: { type: "string" },
              },
              required: ["name", "score", "reason"],
            },
          },
        },
        required: ["destination", "summary", "fits"],
      },
    },
  },
  required: ["options"],
};

function buildPrompt(submissions: SubmissionForMatching[]): string {
  const lines = submissions.map((s) => {
    const dates = s.dateRanges.map((r) => `${r.start} to ${r.end}`).join("; ") || "none given";
    return [
      `- ${s.name}:`,
      `  budget: ₹${s.budgetMin}–₹${s.budgetMax} per person`,
      `  available dates: ${dates}`,
      `  wants: ${s.destinationTypes.join(", ") || "no preference"}`,
      `  dealbreakers: ${s.dealbreakers.trim() || "none stated"}`,
    ].join("\n");
  });

  return `You are matching a group of friends to a shared trip destination based on everyone's submitted preferences below. Reason jointly across ALL participants at once — not pairwise comparisons.

${lines.join("\n\n")}

Propose 2-3 destination options total. For each option, give a one-line summary and, for EVERY participant listed above, a fit score from 1 (poor fit) to 5 (great fit) with a one-line reason grounded in their stated budget, dates, preferred type, and dealbreakers. Do not invent facts not implied by what's stated above.`;
}

function isValidMatchResult(value: unknown): value is MatchResult {
  if (typeof value !== "object" || value === null) return false;
  const options = (value as { options?: unknown }).options;
  if (!Array.isArray(options) || options.length < 2 || options.length > 3) return false;
  return options.every((opt) => {
    if (typeof opt !== "object" || opt === null) return false;
    const o = opt as Record<string, unknown>;
    if (typeof o.destination !== "string" || typeof o.summary !== "string") return false;
    if (!Array.isArray(o.fits)) return false;
    return o.fits.every((fit) => {
      if (typeof fit !== "object" || fit === null) return false;
      const f = fit as Record<string, unknown>;
      return (
        typeof f.name === "string" &&
        typeof f.score === "number" &&
        Number.isInteger(f.score) &&
        f.score >= 1 &&
        f.score <= 5 &&
        typeof f.reason === "string"
      );
    });
  });
}

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
          responseSchema: RESPONSE_SCHEMA,
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
 * MatchResult, retries exactly once. Throws if both attempts fail — the
 * caller (sessionDb.ts) is responsible for surfacing that as an error state
 * rather than writing a partial/bad `results` row.
 */
export async function matchDestinations(submissions: SubmissionForMatching[]): Promise<MatchResult> {
  const prompt = buildPrompt(submissions);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = await callGeminiOnce(prompt);
      if (isValidMatchResult(parsed)) return parsed;
      console.error(`Gemini attempt ${attempt}: response failed shape validation`, parsed);
    } catch (err) {
      console.error(`Gemini attempt ${attempt} failed:`, err);
    }
  }

  throw new Error("Gemini did not return a valid match result after 2 attempts");
}
