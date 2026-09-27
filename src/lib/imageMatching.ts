// Pure matching/selection logic, split out from the filesystem-reading
// manifest module so it's unit-testable without touching disk.

export interface ImageManifest {
  /** folder name (e.g. "goa") -> image filenames in public/images/destinations/<folder>/ */
  destinations: Record<string, string[]>;
  /** folder name (e.g. "beach") -> image filenames in public/images/moods/<folder>/ */
  moods: Record<string, string[]>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Case-insensitive, partial match: "North Goa" matches folder "goa". Ties broken by first match in manifest order. */
function findDestinationFolder(destinationName: string, manifest: ImageManifest): string | null {
  const target = normalize(destinationName);
  if (!target) return null;
  for (const folder of Object.keys(manifest.destinations)) {
    if (manifest.destinations[folder].length === 0) continue;
    const folderKey = normalize(folder);
    if (target.includes(folderKey) || folderKey.includes(target)) return folder;
  }
  return null;
}

/** Deterministic when given a seeded rng (for tests); Math.random by default. */
function pickRandom<T>(items: T[], rng: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length)];
}

export interface MatchedImage {
  path: string; // public path, e.g. "/images/destinations/goa/foo.jpg"
  source: "destination" | "mood";
}

/**
 * Step 1: match the destination name against a destinations/ folder.
 * Step 2: fall back to the group's most common destination_types tag
 * against a moods/ folder. Step 3: no match — null, never a placeholder.
 */
export function matchDestinationImage(
  destinationName: string,
  mostCommonDestinationType: string | null,
  manifest: ImageManifest,
  rng: () => number = Math.random
): MatchedImage | null {
  const destFolder = findDestinationFolder(destinationName, manifest);
  if (destFolder) {
    const file = pickRandom(manifest.destinations[destFolder], rng);
    if (file) return { path: `/images/destinations/${destFolder}/${file}`, source: "destination" };
  }

  if (mostCommonDestinationType) {
    const moodKey = normalize(mostCommonDestinationType);
    const moodFolder = Object.keys(manifest.moods).find((f) => normalize(f) === moodKey);
    if (moodFolder) {
      const file = pickRandom(manifest.moods[moodFolder], rng);
      if (file) return { path: `/images/moods/${moodFolder}/${file}`, source: "mood" };
    }
  }

  return null;
}

/** The most-suggested destination_types tag across a group's submissions — ties broken by first-seen order. */
export function mostCommonDestinationType(destinationTypesPerSubmission: string[][]): string | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const types of destinationTypesPerSubmission) {
    for (const t of types) {
      const key = t.trim().toLowerCase();
      if (!key) continue;
      if (!counts.has(key)) order.push(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (order.length === 0) return null;
  return order.reduce((best, key) => ((counts.get(key) ?? 0) > (counts.get(best) ?? 0) ? key : best), order[0]);
}

/** Pooled hero images for the ambient slideshow: every mood folder plus every destination folder, for a broader mix. */
export function allSlideshowImages(manifest: ImageManifest): string[] {
  const paths: string[] = [];
  for (const [folder, files] of Object.entries(manifest.moods)) {
    for (const f of files) paths.push(`/images/moods/${folder}/${f}`);
  }
  for (const [folder, files] of Object.entries(manifest.destinations)) {
    for (const f of files) paths.push(`/images/destinations/${folder}/${f}`);
  }
  return paths;
}
