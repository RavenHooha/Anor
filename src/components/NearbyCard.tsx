import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { colors, spacing, radius, typography } from '../theme';
import { STATUS_BY_ID } from '../types/status';
import { isFoundingMember } from '../lib/founding';
import FoundingBadge from './FoundingBadge';
import SupporterBadge from './SupporterBadge';
import { validAccent } from '../types/cosmetics';
import { tierAtLeast } from '../types/subscription';
import type { NearbyUser } from '../types/user';

type Props = {
  user: NearbyUser;
  onPress: (user: NearbyUser) => void;
  onMessage?: (user: NearbyUser) => void;
  // Co-presence cards share a venue, so distance is meaningless (0) — hide it.
  hideDistance?: boolean;
};

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export default function NearbyCard({ user, onPress, onMessage, hideDistance }: Props) {
  const cfg = STATUS_BY_ID[user.status];
  const isFocus = user.status === 'focus';
  const accent = validAccent(user.supporter.accentColor);
  const bioColor = tierAtLeast(user.supporter.tier, 'patron')
    ? (accent ?? colors.highlight)
    : null;

  const metaParts: string[] = [];
  if (user.age != null) metaParts.push(String(user.age));
  if (!hideDistance) metaParts.push(formatDistance(user.distanceM));
  const meta = metaParts.join(' · ');

  return (
    <Pressable
      onPress={() => onPress(user)}
      disabled={isFocus}
      style={({ pressed }) => [
        styles.card,
        isFocus && styles.cardFocus,
        pressed && !isFocus && styles.cardPressed,
      ]}
    >
      <View style={styles.photoWrap}>
        <Avatar uri={user.photoUrl} name={user.name} size={110} style={styles.photo} />
        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
      </View>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text
            style={[styles.name, accent ? { color: accent } : null]}
            numberOfLines={1}
          >
            {user.name}
          </Text>
          <SupporterBadge tier={user.supporter.tier} size={22} />
        </View>
        <View style={styles.statusRow}>
          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {isFoundingMember(user.createdAt) && <FoundingBadge />}
        </View>
        {user.venue && (
          <View style={styles.venueRow}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={styles.venueText} numberOfLines={1}>
              {user.venue}
            </Text>
          </View>
        )}
        {user.bio.length > 0 && (
          <Text
            style={[styles.bio, bioColor ? { color: bioColor } : null]}
            numberOfLines={2}
          >
            {user.bio}
          </Text>
        )}
        {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
      </View>
      {!isFocus && onMessage && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onMessage(user);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Message ${user.name}`}
          style={({ pressed }) => [
            styles.chatBtn,
            pressed && styles.chatBtnPressed,
          ]}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: { borderColor: colors.primary },
  cardFocus: { opacity: 0.4 },
  photoWrap: { position: 'relative' },
  photo: {
    width: 110,
    height: 110,
    backgroundColor: colors.surfaceElevated,
  },
  statusDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.title, fontSize: 17, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusLabel: { ...typography.caption, fontWeight: '600' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  venueText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  bio: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chatBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  chatBtnPressed: { backgroundColor: colors.surfaceElevated },
});
