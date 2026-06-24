-- Auto-populate venues from OpenStreetMap. Adds provenance + dedup columns to
-- venues and a tile-cache ledger so we fetch any given map tile from Overpass
-- at most once per refresh window (regardless of how many users walk through
-- it). The backfill-venues edge function is the only writer of OSM rows
-- (service role); admin/partner rows (source='admin') are never touched by the
-- OSM sync and stay authoritative.
--
-- Strategy A (bulk city import) and Strategy B (lazy per-user tile fetch) share
-- the same primitive — fetch one tile — so they share this schema.

alter table venues
  add column if not exists source           text not null default 'admin', -- 'admin' | 'osm'
  add column if not exists osm_type         text,    -- 'node' | 'way' | 'relation'
  add column if not exists osm_id           bigint,
  add column if not exists source_synced_at timestamptz;

-- Dedup key for OSM rows. NOT partial: admin rows have (osm_type, osm_id) =
-- (null, null), and Postgres treats NULLs as distinct in a unique index — so
-- many admin rows coexist freely while OSM rows dedup on their real ids. This
-- shape (plain, not partial) is what PostgREST/ON CONFLICT upsert needs.
create unique index if not exists venues_osm_uniq on venues (osm_type, osm_id);

-- ── venue_tiles: the Overpass fetch ledger ─────────────────────────────
-- One row per map tile we've pulled. fetched_at gates the refresh window;
-- service-role only (no RLS policies → clients can't read/write it).
create table if not exists venue_tiles (
  tile_key    text primary key,           -- "<tileX>_<tileY>" at TILE_DEG resolution
  fetched_at  timestamptz not null default now(),
  venue_count int not null default 0
);

alter table venue_tiles enable row level security;
