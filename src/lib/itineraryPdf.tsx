import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Recommendation } from "./geminiMatching";
import { ItineraryPdfData } from "./itineraryPdfData";

// Matches the app's own brand teal (tailwind.config.ts: brand.500/700) on a
// warm paper background — legibility over polish, per spec: two clear
// sections, readable type, no elaborate design.
const COLORS = {
  teal: "#0f9d78",
  tealDark: "#0a664e",
  paper: "#FBF7F0",
  text: "#2b2b28",
  muted: "#6b6558",
  cardBorder: "#e8e0d0",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.paper, padding: 36, fontSize: 11, color: COLORS.text, fontFamily: "Helvetica" },
  title: { fontSize: 20, fontWeight: 700, color: COLORS.tealDark, marginBottom: 4 },
  basedOnNote: {
    backgroundColor: "#FCEFD8",
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    fontSize: 10,
    color: "#7a5b1e",
  },
  section: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    padding: 16,
  },
  sectionLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: COLORS.teal, marginBottom: 4 },
  destination: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  badge: { fontSize: 8, color: COLORS.muted, marginBottom: 6 },
  summary: { fontSize: 11, marginBottom: 10, lineHeight: 1.4 },
  subheading: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", fontSize: 10, marginBottom: 2 },
  muted: { fontSize: 9, color: COLORS.muted },
  bullet: { fontSize: 10, marginBottom: 2 },
});

// Helvetica (the built-in PDF base font used here) has no ₹ glyph — it
// silently renders as a garbled character instead, found by actually
// extracting text from a live-rendered PDF, not just reading the component
// code (it showed up not only in the structured budget rows but in the
// model's own free-text summary/season prose too, since Gemini naturally
// writes inline ₹ figures there). Swapping in "Rs." for the PDF only keeps
// this legible without needing to bundle/fetch a custom font just for one
// symbol; the on-screen UI is unaffected and keeps the real ₹ glyph.
//
// Also found live: Gemini doesn't always emit the literal ₹ codepoint —
// one real response used ’ (U+2019, a right single quote) as its own
// stand-in right before a digit ("’10,000"). A real apostrophe never
// precedes a digit in this app's text, so that position is used as the
// signal rather than blanket-replacing ’ (which would otherwise mangle
// ordinary contractions/possessives elsewhere in the same sentence).
function toAsciiCurrency(s: string): string {
  // ‘ = ‘, ’ = ’ — written as escapes, not literal characters,
  // after a previous attempt at this same line silently typed the wrong
  // lookalike quote character and missed the actual one Gemini used.
  return s.replace(/₹/g, "Rs. ").replace(/[‘’'](?=\d)/g, "Rs. ");
}

function sanitizeRecommendation(r: Recommendation): Recommendation {
  return {
    destination: toAsciiCurrency(r.destination),
    summary: toAsciiCurrency(r.summary),
    suggested_window: {
      start_date: r.suggested_window.start_date,
      end_date: r.suggested_window.end_date,
      season: toAsciiCurrency(r.suggested_window.season),
    },
    budget_estimate: {
      transport: toAsciiCurrency(r.budget_estimate.transport),
      stay: toAsciiCurrency(r.budget_estimate.stay),
      food: toAsciiCurrency(r.budget_estimate.food),
      activities: toAsciiCurrency(r.budget_estimate.activities),
      note: toAsciiCurrency(r.budget_estimate.note),
    },
    attractions: r.attractions.map(toAsciiCurrency),
  };
}

function RecommendationSection({ recommendation, label, badge }: { recommendation: Recommendation; label: string; badge?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.destination}>{recommendation.destination}</Text>
      {badge && <Text style={styles.badge}>{badge}</Text>}
      <Text style={styles.summary}>{recommendation.summary}</Text>

      <Text style={styles.subheading}>Suggested window</Text>
      <Text style={{ fontSize: 10 }}>
        {recommendation.suggested_window.start_date} – {recommendation.suggested_window.end_date}
      </Text>
      <Text style={styles.muted}>{recommendation.suggested_window.season}</Text>

      <Text style={styles.subheading}>Budget estimate (per person)</Text>
      <View style={styles.row}>
        <Text>Transport</Text>
        <Text>{recommendation.budget_estimate.transport}</Text>
      </View>
      <View style={styles.row}>
        <Text>Stay</Text>
        <Text>{recommendation.budget_estimate.stay}</Text>
      </View>
      <View style={styles.row}>
        <Text>Food</Text>
        <Text>{recommendation.budget_estimate.food}</Text>
      </View>
      <View style={styles.row}>
        <Text>Activities</Text>
        <Text>{recommendation.budget_estimate.activities}</Text>
      </View>
      <Text style={styles.muted}>{recommendation.budget_estimate.note}</Text>

      <Text style={styles.subheading}>Top attractions</Text>
      {recommendation.attractions.map((a) => (
        <Text key={a} style={styles.bullet}>
          • {a}
        </Text>
      ))}
    </View>
  );
}

function ItineraryDocument({ data }: { data: ItineraryPdfData }) {
  const fromPicks = data.fromPicks ? sanitizeRecommendation(data.fromPicks) : null;
  const discovered = sanitizeRecommendation(data.discovered);
  return (
    <Document title={`${data.title} — Itinerary`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{toAsciiCurrency(data.title)}</Text>
        {data.basedOnNote && <Text style={styles.basedOnNote}>{toAsciiCurrency(data.basedOnNote)}</Text>}
        {fromPicks && <RecommendationSection recommendation={fromPicks} label="From your picks" />}
        <RecommendationSection
          recommendation={discovered}
          label="Discovered for you"
          badge={data.discoveredVerified ? "Web-search verified" : "AI-suggested, not independently verified"}
        />
      </Page>
    </Document>
  );
}

export async function renderItineraryPdf(data: ItineraryPdfData): Promise<Buffer> {
  return renderToBuffer(<ItineraryDocument data={data} />);
}
