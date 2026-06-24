import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import { iconForCategory } from '../data/venueCategories';
import VenueCard from './VenueCard';
import type { NearbyVenue } from '../data/venues';

const OTHER = 'Other';

function catOf(v: NearbyVenue): string {
  return v.category && v.category.trim() ? v.category : OTHER;
}

/**
 * The "Places nearby" section: a category filter row over a list grouped by
 * category. Each category is a bold anchor (icon + label + count) with its
 * venues beneath. "All" shows every category; tapping a chip narrows to one.
 * Venues arrive nearest-first, so category order and within-group order are
 * both distance-based.
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
    const byCat = new Map<string, NearbyVenue[]>();
    for (const v of venues) {
      const c = catOf(v);
      const arr = byCat.get(c) ?? [];
      arr.push(v);
      byCat.set(c, arr);
    }
    const order = activeFilter ? [activeFilter] : categories;
    return order.map((c) => ({ category: c, venues: byCat.get(c) ?? [] }));
  }, [venues, categories, activeFilter]);

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

      {groups.map((g) => (
        <View key={g.category} style={styles.group}>
          <View style={styles.groupHeader}>
            <Ionicons name={iconForCategory(g.category)} size={16} color={colors.highlight} />
            <Text style={styles.groupLabel}>{g.category}</Text>
            <View style={styles.groupRule} />
          </View>
          <View style={styles.grid}>
            {g.venues.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </View>
        </View>
      ))}
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPressed: { opacity: 0.6 },
  chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipLabelActive: { color: colors.background },
  group: { gap: spacing.sm, marginTop: spacing.xs },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupLabel: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  grid: { gap: spacing.md },
});
