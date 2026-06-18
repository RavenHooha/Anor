import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import type { NearbyVenue } from '../data/venues';

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  special: 'pricetag',
  event: 'calendar',
  update: 'information-circle',
};

export default function VenueCard({ venue }: { venue: NearbyVenue }) {
  const meta = [venue.category, formatDistance(venue.distanceM)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="storefront" size={18} color={colors.highlight} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
        </View>
      </View>

      {venue.post && (
        <View style={styles.post}>
          <Ionicons
            name={KIND_ICON[venue.post.kind] ?? 'pricetag'}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.postBody}>{venue.post.body}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headText: { flex: 1 },
  name: { ...typography.title, fontSize: 16, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
  post: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  postBody: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});
