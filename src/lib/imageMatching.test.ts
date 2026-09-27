import { describe, expect, it } from "vitest";
import { allSlideshowImages, ImageManifest, matchDestinationImage, mostCommonDestinationType } from "./imageMatching";

function makeManifest(overrides: Partial<ImageManifest> = {}): ImageManifest {
  return {
    destinations: { goa: ["goa1.jpg", "goa2.jpg"], kerala: ["kerala1.jpg"] },
    moods: { beach: ["beach1.jpg"], mountain: ["mountain1.jpg", "mountain2.jpg"] },
    ...overrides,
  };
}

describe("matchDestinationImage", () => {
  it("matches an exact destination folder name", () => {
    const result = matchDestinationImage("Goa", null, makeManifest(), () => 0);
    expect(result).toEqual({ path: "/images/destinations/goa/goa1.jpg", source: "destination" });
  });

  it("matches case-insensitively and partially — 'North Goa' matches the goa folder", () => {
    const result = matchDestinationImage("North Goa", null, makeManifest(), () => 0);
    expect(result?.source).toBe("destination");
    expect(result?.path).toContain("/destinations/goa/");
  });

  it("picks randomly among multiple images using the given rng", () => {
    const first = matchDestinationImage("Goa", null, makeManifest(), () => 0);
    const second = matchDestinationImage("Goa", null, makeManifest(), () => 0.99);
    expect(first?.path).toBe("/images/destinations/goa/goa1.jpg");
    expect(second?.path).toBe("/images/destinations/goa/goa2.jpg");
  });

  it("falls back to the mood folder when the destination name doesn't match any folder", () => {
    const result = matchDestinationImage("Manali", "beach", makeManifest(), () => 0);
    expect(result).toEqual({ path: "/images/moods/beach/beach1.jpg", source: "mood" });
  });

  it("returns null (no image, not a placeholder) when neither the destination nor the mood matches", () => {
    const result = matchDestinationImage("Manali", "heritage", makeManifest(), () => 0);
    expect(result).toBeNull();
  });

  it("returns null when the matched destination folder exists but is empty", () => {
    const manifest = makeManifest({ destinations: { goa: [] } });
    const result = matchDestinationImage("Goa", "beach", manifest, () => 0);
    // falls through to the mood match rather than returning a path to nothing
    expect(result?.source).toBe("mood");
  });

  it("returns null when there's no destination match and no mood tag given", () => {
    expect(matchDestinationImage("Manali", null, makeManifest(), () => 0)).toBeNull();
  });
});

describe("mostCommonDestinationType", () => {
  it("returns the most-suggested tag across submissions", () => {
    expect(mostCommonDestinationType([["beach"], ["beach", "hills"], ["hills"], ["beach"]])).toBe("beach");
  });

  it("breaks ties by first-seen order", () => {
    expect(mostCommonDestinationType([["hills"], ["beach"]])).toBe("hills");
  });

  it("returns null when nobody gave any destination types", () => {
    expect(mostCommonDestinationType([[], []])).toBeNull();
  });

  it("is case-insensitive when counting", () => {
    expect(mostCommonDestinationType([["Beach"], ["beach"], ["hills"]])).toBe("beach");
  });
});

describe("allSlideshowImages", () => {
  it("pools every mood and destination folder together", () => {
    const images = allSlideshowImages(makeManifest());
    expect(images).toHaveLength(6);
    expect(images).toContain("/images/moods/beach/beach1.jpg");
    expect(images).toContain("/images/destinations/goa/goa1.jpg");
  });

  it("returns an empty list when every folder is empty", () => {
    expect(allSlideshowImages({ destinations: { goa: [] }, moods: { beach: [] } })).toEqual([]);
  });
});
