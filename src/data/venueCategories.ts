import { Ionicons } from '@expo/vector-icons';

// Per-category glyph, shared by the venue cards and the "Places nearby" group
// headers. Keys are lowercased category labels (see the OSM tag→category map in
// supabase/functions/_shared/osm.ts); anything unmapped falls back to a generic
// storefront.
export const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  cafe: 'cafe',
  bar: 'wine',
  pub: 'beer',
  restaurant: 'restaurant',
  food: 'fast-food',
  bakery: 'cafe',
  cinema: 'film',
  theatre: 'musical-notes',
  nightlife: 'musical-notes',
  arts: 'color-palette',
  community: 'people',
  library: 'library',
  coworking: 'briefcase',
  market: 'basket',
  bookshop: 'book',
  gym: 'barbell',
  sports: 'basketball',
  dance: 'musical-notes',
  museum: 'business',
  gallery: 'color-palette',
};

export function iconForCategory(category: string | null): keyof typeof Ionicons.glyphMap {
  if (!category) return 'storefront';
  return CATEGORY_ICON[category.toLowerCase()] ?? 'storefront';
}
