import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ImageManifest } from "./imageMatching";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function listImages(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort();
  } catch {
    return []; // folder doesn't exist yet — no images, not an error
  }
}

function listSubfolders(dir: string): Record<string, string[]> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const entry of entries) {
    if (entry.isDirectory()) result[entry.name] = listImages(path.join(dir, entry.name));
  }
  return result;
}

let cached: ImageManifest | null = null;

/**
 * Reads public/images/** off disk. Cached per server instance — image
 * folders don't change while the app is running, and this avoids a
 * filesystem walk on every request. Never throws: a missing/empty folder
 * just means no images for that category, per the "text only, never a
 * placeholder" fallback rule.
 */
export function getImageManifest(): ImageManifest {
  if (cached) return cached;
  const root = path.join(process.cwd(), "public", "images");
  cached = {
    destinations: listSubfolders(path.join(root, "destinations")),
    moods: listSubfolders(path.join(root, "moods")),
  };
  return cached;
}
