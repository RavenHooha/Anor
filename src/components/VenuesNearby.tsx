import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import VenueCard from './VenueCard';
import type { NearbyVenue } from '../data/venues';

const OTHER = 'Other';

function catOf(v: NearbyVenue): string {
  return v.category && v.category.trim() ? v.category : OTHER;
}

/**
 * The "Places nearby" section: a category filter row plus the venue list. With
 * "All" selected the list is grouped by category (each category's venues
 * together, under a subheader); tapping a category narrows to a flat list of
 * just those. Venues arrive nearest-first, so both category order and
 * within-group order are distance-based.
 */
export default function VenuesNearby({ venues }: { venues: NearbyVenue[] }) {
  const [filter, setFilter] = useState<string | null>(null);

  // Categories present, in first-appearance (nearest-first) order.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const v of venues) {
      const c = catOf(v);
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [venues]);

  // If the active category drops out of range as the user moves, fall back to All.
  const activeFilter = filter && categories.includes(filter) ? filter : null;

  const groups = useMemo(() => {
    if (activeFilter) return null;
    const map = new Map<string, NearbyVenue[]>();
    for (const v of venues) {
      const c = catOf(v);
      const arr = map.get(c) ?? [];
      arr.push(v);
      map.set(c, arr);
    }
    return categories.map((c) => ({ category: c, venues: map.get(c) ?? [] }));
  }, [venues, categories, activeFilter]);

  const flat = activeFilter ? venues.filter((v) => catOf(v) === activeFilter) : [];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
        <Text style={styles.headerTitle}>Places nearby</Text>
      </View>

      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="All" active={!activeFilter} onPress={() => setFilter(null)} />
          {categories.map((c) => (
            <Chip key={c} label={c} active={activeFilter === c} onPress={() => setFilter(c)} />
          ))}
        </ScrollView>
      )}

      {groups ? (
        groups.map((g) => (
          <View key={g.category} style={styles.group}>
            <Text style={styles.groupTitle}>
              {g.category} · {g.venues.length}
            </Text>
            <View style={styles.grid}>
              {g.venues.map((v) => (
                <VenueCard key={v.id} venue={v} />
              ))}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.grid}>
          {flat.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && !active && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs, paddingRight: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: { opacity: 0.6 },
  chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipLabelActive: { color: colors.background },
  group: { gap: spacing.sm },
  groupTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  grid: { gap: spacing.md },
});
