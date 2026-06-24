// Shared OpenStreetMap helpers for the backfill-venues function. Pure logic
// (no IO) so it's trivially testable and reused by both the lazy per-user tile
// fetch (Strategy B) and the admin city-bbox import (Strategy A) — which is
// just "fetch every tile in the box".
//
// OSM data is ODbL: we may store/use it but MUST attribute "© OpenStreetMap
// contributors" in-app (see the legal line in Settings).

// Tile size in degrees. ~2.2 km in latitude; longitude shrinks toward the
// poles but at mid-latitudes it's a comparable span. Small enough that one
// Overpass call per tile is cheap, large enough that we don't shard a town
// into hundreds of tiles.
export const TILE_DEG = 0.02;

export type Bbox = { south: number; west: number; north: number; east: number };

export function tileKey(lat: number, lng: number): string {
  const x = Math.floor(lng / TILE_DEG);
  const y = Math.floor(lat / TILE_DEG);
  return `${x}_${y}`;
}

export function tileBboxFromKey(key: string): Bbox {
  const [x, y] = key.split('_').map(Number);
  return {
    west: x * TILE_DEG,
    south: y * TILE_DEG,
    east: (x + 1) * TILE_DEG,
    north: (y + 1) * TILE_DEG,
  };
}

// Every tile key whose cell intersects the given bbox (Strategy A fans out
// over these). Inclusive on both ends.
export function tileKeysInBbox(b: Bbox): string[] {
  const x0 = Math.floor(b.west / TILE_DEG);
  const x1 = Math.floor(b.east / TILE_DEG);
  const y0 = Math.floor(b.south / TILE_DEG);
  const y1 = Math.floor(b.north / TILE_DEG);
  const keys: string[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) keys.push(`${x}_${y}`);
  }
  return keys;
}

// ── Tag allowlist → friendly category ────────────────────────────────────
// Curated to "places people gather and might connect" — deliberately excludes
// the OSM long tail (ATMs, benches, vending machines, bus stops, etc.). Order
// of the maps below is the resolution priority when an element carries several.
const AMENITY: Record<string, string> = {
  cafe: 'Cafe',
  bar: 'Bar',
  biergarten: 'Bar',
  pub: 'Pub',
  restaurant: 'Restaurant',
  fast_food: 'Food',
  food_court: 'Food',
  ice_cream: 'Cafe',
  cinema: 'Cinema',
  theatre: 'Theatre',
  nightclub: 'Nightlife',
  arts_centre: 'Arts',
  community_centre: 'Community',
  library: 'Library',
  coworking_space: 'Coworking',
  marketplace: 'Market',
};
const SHOP: Record<string, string> = {
  coffee: 'Cafe',
  books: 'Bookshop',
  bakery: 'Bakery',
};
const LEISURE: Record<string, string> = {
  fitness_centre: 'Gym',
  sports_centre: 'Sports',
  dance: 'Dance',
};
const TOURISM: Record<string, string> = {
  museum: 'Museum',
  gallery: 'Gallery',
};

const TAG_GROUPS: { key: string; map: Record<string, string> }[] = [
  { key: 'amenity', map: AMENITY },
  { key: 'shop', map: SHOP },
  { key: 'leisure', map: LEISURE },
  { key: 'tourism', map: TOURISM },
];

type OsmTags = Record<string, string>;

export function categoryFor(tags: OsmTags | undefined): string | null {
  if (!tags) return null;
  for (const { key, map } of TAG_GROUPS) {
    const v = tags[key];
    if (v && map[v]) return map[v];
  }
  return null;
}

// ── Overpass query ───────────────────────────────────────────────────────
export function buildOverpassQuery(b: Bbox): string {
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  // nwr = node + way + relation in one shorthand; `out center tags` gives
  // ways/relations a single representative point so we can store a geography
  // point uniformly.
  const clauses = TAG_GROUPS.map(({ key, map }) => {
    const values = Object.keys(map).join('|');
    return `  nwr["${key}"~"^(${values})$"](${box});`;
  }).join('\n');
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout center tags;`;
}

// ── Parse Overpass JSON → venue rows ─────────────────────────────────────
export type OsmVenue = {
  osm_type: string; // 'node' | 'way' | 'relation'
  osm_id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

function addressFrom(tags: OsmTags): string | null {
  const line = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ')
    .trim();
  return line || tags['addr:full'] || null;
}

export function parseOverpass(json: { elements?: OverpassElement[] }): OsmVenue[] {
  const out: OsmVenue[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags;
    const name = tags?.name?.trim();
    if (!name) continue; // unnamed POIs are useless for "you're at X"
    const category = categoryFor(tags);
    if (!category) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    out.push({
      osm_type: el.type,
      osm_id: el.id,
      name,
      category,
      lat,
      lng,
      address: tags ? addressFrom(tags) : null,
    });
  }
  return out;
}
