# Venue auto-population (OpenStreetMap)

Populates the `venues` table from OpenStreetMap so co-presence works without
hand-seeding every town, while paid/partner venues stay authoritative.

## How it works

Both strategies share one primitive — **fetch one map tile's venues** (tiles
are `TILE_DEG = 0.02°` ≈ 2.2 km squares):

- **Strategy B (lazy, per-user).** The app calls `backfill-venues` with the
  user's `{lat,lng}`. The function fetches that tile from Overpass, upserts the
  venues, and records the tile in `venue_tiles`. The next user in that tile is
  free (served from the cache until the refresh window lapses).
- **Strategy A (bulk, admin).** Call `backfill-venues` with a `{bbox}`. It fans
  out over every tile in the box and force-refreshes them — used to seed a
  launch town up front.

Server-side `venue_tiles` caching means a tile hits Overpass **at most once per
refresh window** (60 days) regardless of how many users pass through. The client
also throttles per-tile (`anor.venues.lastEnsuredTile`) to avoid re-invoking.

## Pieces

- `supabase/migrations/0049_venue_osm_source.sql` — adds `source`, `osm_type`,
  `osm_id`, `source_synced_at` to `venues`; the `(osm_type, osm_id)` dedup index;
  and the `venue_tiles` ledger.
- `supabase/functions/_shared/osm.ts` — tile math, the curated tag→category
  allowlist, the Overpass query builder, and the element parser (pure logic).
- `supabase/functions/backfill-venues/index.ts` — the edge function (both modes).
- `src/data/venues.ts` → `ensureVenuesNearby()` — client trigger (Strategy B).
- `src/screens/HomeScreen.tsx` — fires `ensureVenuesNearby` per tile, refreshes
  the list when new venues land.
- `src/screens/SettingsScreen.tsx` — the required "Map data © OpenStreetMap"
  attribution (ODbL).

## Activation

1. **Apply migrations** 0048 (nearby bounds) and 0049 — SQL editor or
   `supabase db push`.
2. **Deploy the function** (keep JWT verification on):
   ```
   supabase functions deploy backfill-venues
   ```
3. **Seed the launch town (Strategy A)** with the service-role key:
   ```
   curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/backfill-venues" \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"bbox":[35.35,-83.24,35.40,-83.19]}'
   ```
   That bbox is roughly Sylva, NC `[south, west, north, east]` (~9 tiles). The
   response is `{ tiles, added, unavailable }`.
4. **Strategy B** then runs automatically: as users open the app around town,
   any tile not already covered gets fetched on first visit.

## Refresh

Tiles re-fetch after 60 days (`REFRESH_MS`). On re-sync, vanished OSM venues
should be soft-deactivated, not deleted (preserves check-in history) — see
follow-ups.

## Follow-ups (not in v1)

- **Partner ↔ OSM dedup.** When real partners exist, skip an OSM venue that
  lands within ~50 m of an admin venue with a fuzzy-matching name (admin rows
  are already never overwritten — this just avoids a visual duplicate). Moot
  until there are partner venues.
- **Soft-delete on re-sync.** Mark OSM venues absent from a fresh pull
  `active = false` instead of leaving stale rows.
- **Big-city tiling.** `MAX_TILES_PER_CALL = 40` bounds one admin call; a large
  metro needs to be split into several bbox calls (or a queue).
- **Unit test** `parseOverpass` / `categoryFor` against a sample Overpass
  response.
- **Overpass scale.** Public Overpass is fine for soft launch; at volume,
  self-host or use a paid Overpass provider.
