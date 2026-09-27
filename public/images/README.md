# Image folders

Drop real photo files (`.jpg`/`.jpeg`/`.png`/`.webp`) straight into these
folders — no code changes needed, the app picks up whatever's there at
build time.

- `destinations/goa/` — Goa-specific photos (aerial beach/boat shots, the
  Goa collage).
- `destinations/kerala/` — Kerala/backwaters photos (houseboat shots).
- `moods/mountain/` — generic mountain/hiking photos, not tied to one place.
- `moods/beach/` — generic beach/tropical photos, not tied to one place.

Add more `destinations/<name>/` folders the same way to extend matching to
more places (e.g. `destinations/manali/`) — the folder name is what gets
matched against a destination name.

If a folder is empty, or nothing matches, the app shows plain text with no
image — never a broken image icon or a generic placeholder.
