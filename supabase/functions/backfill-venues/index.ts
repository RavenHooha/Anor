// backfill-venues — populate the `venues` table from OpenStreetMap.
//
// Two callers, one primitive ("fetch a tile"):
//   • Strategy B (lazy):  body { lat, lng }      — any authed user; fetches the
//     single tile they're in, cache-gated so each tile hits Overpass at most
//     once per refresh window no matter how many users pass through.
//   • Strategy A (bulk):  body { bbox }          — admin only; fans out over
//     every tile in the box and force-refreshes them (seed a launch town).
//
// Only this function (service role) writes OSM venues. Admin/partner rows
// (source='admin') are never touched — the upsert conflict key is (osm_type,
// osm_id), which is null for admin rows.
//
// Setup:
//   supabase functions deploy backfill-venues
// (Keep JWT verification ON — we need the caller's identity for the admin gate.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildOverpassQuery,
  parseOverpass,
  tileBboxFromKey,
  tileKey,
  tileKeysInBbox,
  type Bbox,
} from '../_shared/osm.ts';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const REFRESH_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const MAX_TILES_PER_CALL = 40; // bound an admin bbox import to one safe batch

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type TileResult = { count: number } | { error: string };

async function fetchOverpass(b: Bbox): Promise<{ data: unknown } | { error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Anor/1.0 (venue backfill; https://anor.app)',
      },
      body: 'data=' + encodeURIComponent(buildOverpassQuery(b)),
      signal: ctrl.signal,
    });
    if (!res.ok) return { error: `overpass ${res.status}` };
    return { data: await res.json() };
  } catch (e) {
    return { error: `overpass fetch: ${e instanceof Error ? e.message : 'failed'}` };
  } finally {
    clearTimeout(t);
  }
}

// Fetch one tile (unless cached & fresh and not forced); upsert its venues;
// record the tile. Returns the venue count, or a specific error string so the
// caller can surface *why* a tile failed (Overpass vs DB write) instead of a
// blanket "unavailable".
async function fetchTile(key: string, force: boolean): Promise<TileResult> {
  if (!force) {
    const { data: tile } = await admin
      .from('venue_tiles')
      .select('fetched_at')
      .eq('tile_key', key)
      .maybeSingle();
    if (tile && Date.now() - new Date(tile.fetched_at).getTime() < REFRESH_MS) {
      return { count: 0 }; // fresh cache — nothing to do
    }
  }

  const fetched = await fetchOverpass(tileBboxFromKey(key));
  if ('error' in fetched) return { error: fetched.error };

  const venues = parseOverpass(fetched.data as { elements?: [] });
  if (venues.length > 0) {
    const rows = venues.map((v) => ({
      source: 'osm',
      osm_type: v.osm_type,
      osm_id: v.osm_id,
      name: v.name,
      category: v.category,
      location: `POINT(${v.lng} ${v.lat})`,
      address: v.address,
      active: true,
      source_synced_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .from('venues')
      .upsert(rows, { onConflict: 'osm_type,osm_id' });
    if (error) return { error: `db venues: ${error.message}` };
  }

  const { error: tErr } = await admin
    .from('venue_tiles')
    .upsert(
      { tile_key: key, fetched_at: new Date().toISOString(), venue_count: venues.length },
      { onConflict: 'tile_key' },
    );
  if (tErr) return { error: `db tiles: ${tErr.message}` };
  return { count: venues.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let body: { lat?: number; lng?: number; bbox?: Bbox | number[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  // ── Strategy A: admin bbox import ──────────────────────────────────────
  if (body.bbox) {
    // Allowed for an in-app admin (their JWT passes is_admin) OR a direct call
    // bearing the service-role key (the one-off "seed this town" from a dev
    // machine). The service key is a strong secret, so it's a fine admin proof.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let allowed = token === SERVICE_KEY;
    if (!allowed) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await userClient.rpc('is_admin');
      allowed = !!isAdmin;
    }
    if (!allowed) return json({ error: 'admin only' }, 403);

    const raw = body.bbox;
    const b: Bbox = Array.isArray(raw)
      ? { south: raw[0], west: raw[1], north: raw[2], east: raw[3] }
      : raw;

    const keys = tileKeysInBbox(b);
    if (keys.length > MAX_TILES_PER_CALL) {
      return json(
        { error: `bbox too large: ${keys.length} tiles (max ${MAX_TILES_PER_CALL}). Split it.` },
        400,
      );
    }

    let added = 0;
    let failed = 0;
    let sampleError: string | null = null;
    for (const key of keys) {
      const r = await fetchTile(key, true);
      if ('error' in r) {
        failed++;
        if (!sampleError) sampleError = r.error;
      } else {
        added += r.count;
      }
      // Be a good Overpass citizen — small gap between tile calls.
      await new Promise((res) => setTimeout(res, 1000));
    }
    return json({ tiles: keys.length, added, failed, sample_error: sampleError });
  }

  // ── Strategy B: per-user tile ──────────────────────────────────────────
  if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    const key = tileKey(body.lat, body.lng);
    const r = await fetchTile(key, false);
    if ('error' in r) return json({ added: 0, unavailable: true, error: r.error });
    return json({ added: r.count });
  }

  return json({ error: 'provide {lat,lng} or {bbox}' }, 400);
});
