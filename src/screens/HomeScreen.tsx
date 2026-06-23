import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';
import StatusSelector from '../components/StatusSelector';
import StatusBadge from '../components/StatusBadge';
import NearbyCard from '../components/NearbyCard';
import MysteryCard from '../components/MysteryCard';
import VenueCard from '../components/VenueCard';
import RadiusSelector from '../components/RadiusSelector';
import VenueEditor from '../components/VenueEditor';
import LoadingScreen from '../components/LoadingScreen';
import { loadStatus, saveStatus } from '../storage/status';
import { loadRadius, saveRadius } from '../storage/radius';
import {
  fetchNearby,
  fetchCopresence,
  fetchMyCheckin,
  DEFAULT_RADIUS_M,
  RADIUS_PRESETS,
} from '../data/nearby';
import { fetchNearbyVenues, type NearbyVenue } from '../data/venues';
import { getMyVenue } from '../data/venue';
import { setNearbyAlert, clearNearbyAlert, getNearbyAlert } from '../data/alerts';
import { createOrGetThread } from '../storage/threads';
import { useBleNearby } from '../ble/useBleNearby';
import { useLocation } from '../location/useLocation';
import { reverseGeocodeArea, type AreaNames } from '../location/location';
import type { Status } from '../types/status';
import type { NearbyUser } from '../types/user';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [hereUsers, setHereUsers] = useState<NearbyUser[]>([]);
  const [hereVenue, setHereVenue] = useState<string | null>(null);
  const [checkedInVenue, setCheckedInVenue] = useState<string | null>(null);
  const [alertActive, setAlertActive] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);
  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [areaNames, setAreaNames] = useState<AreaNames | null>(null);
  const [venue, setVenue] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();

  const { status: bleStatus, devices: bleDevices, retry: retryBle } = useBleNearby();
  const { status: locStatus, coords, retry: retryLoc } = useLocation();

  useEffect(() => {
    loadStatus().then((s) => {
      setStatus(s);
      setStatusLoaded(true);
    });
    loadRadius().then(setRadiusM);
  }, []);

  const loadNearby = useCallback(async () => {
    if (!coords) return;
    try {
      const [users, nearbyVenues, myVenue, here, checkin, alert] = await Promise.all([
        fetchNearby(coords, radiusM),
        fetchNearbyVenues(coords, radiusM),
        getMyVenue(),
        fetchCopresence(),
        fetchMyCheckin(),
        getNearbyAlert(),
      ]);
      setNearby(users);
      setVenues(nearbyVenues);
      setVenue(myVenue);
      setHereUsers(here.users);
      setHereVenue(here.venue);
      setCheckedInVenue(checkin.confirmed ? checkin.venueName : null);
      setAlertActive(alert?.active ?? false);
    } catch {
      // ignore — banner state covers errors
    }
  }, [coords, radiusM]);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    if (!coords || status === 'focus') return;
    const id = setInterval(loadNearby, 20_000);
    return () => clearInterval(id);
  }, [coords, status, loadNearby]);

  useEffect(() => {
    if (!coords) return;
    reverseGeocodeArea(coords).then(setAreaNames);
  }, [coords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNearby();
    setRefreshing(false);
  };

  const onChange = (next: Status) => {
    setStatus(next);
    saveStatus(next).catch(() => {});
  };

  const onChangeRadius = (m: number) => {
    setRadiusM(m);
    saveRadius(m).catch(() => {});
  };

  const onToggleAlert = async () => {
    if (savingAlert || !coords) return;
    const next = !alertActive;
    setSavingAlert(true);
    setAlertActive(next); // optimistic
    try {
      if (next) await setNearbyAlert(coords, radiusM);
      else await clearNearbyAlert();
    } catch {
      setAlertActive(!next);
    } finally {
      setSavingAlert(false);
    }
  };

  const openProfile = (user: NearbyUser) => {
    navigation.navigate('UserProfile', { user });
  };

  const quickMessage = async (user: NearbyUser) => {
    try {
      const threadId = await createOrGetThread(user.id, null);
      navigation.navigate('Chat', { threadId });
    } catch {
      // fall back to opening their profile
      navigation.navigate('UserProfile', { user });
    }
  };

  if (!statusLoaded) {
    return <LoadingScreen />;
  }

  const isFocus = status === 'focus';
  // Co-presence users are also physically near, so they'd appear in the general
  // feed too — dedupe them out, since the "Here at {venue}" section owns them.
  const hereIds = new Set(hereUsers.map((u) => u.id));
  const generalNearby = nearby.filter((u) => !hereIds.has(u.id));
  const showHere = !isFocus && hereUsers.length > 0;
  const totalNearby =
    generalNearby.length + bleDevices.length + (showHere ? hereUsers.length : 0);

  const preset = RADIUS_PRESETS.find((p) => p.meters === radiusM);
  const presetId = preset?.id ?? 'here';
  const areaName = (() => {
    if (presetId === 'country') return areaNames?.country ?? preset?.label.toLowerCase();
    if (presetId === 'region') return areaNames?.region ?? preset?.label.toLowerCase();
    if (presetId === 'city') return areaNames?.city ?? preset?.label.toLowerCase();
    // here / walking → reuse city if known, otherwise generic
    return areaNames?.city ?? preset?.label.toLowerCase();
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.brand}>anor</Text>
          <Pressable
            onPress={() => navigation.navigate('Main', { screen: 'Threads' })}
            hitSlop={8}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <StatusBadge status={status} />

        <StatusSelector current={status} onChange={onChange} />

        {checkedInVenue && !isFocus ? (
          <View style={styles.checkedInChip}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.checkedInText} numberOfLines={1}>
              Checked in at {checkedInVenue}
            </Text>
          </View>
        ) : (
          <VenueEditor
            venue={venue}
            onChange={setVenue}
            disabled={!coords || isFocus}
          />
        )}

        <RadiusSelector current={radiusM} onChange={onChangeRadius} />

        {isFocus ? (
          <Text style={styles.feedNote}>
            Focus mode is on. The feed is paused.
          </Text>
        ) : totalNearby === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name={coords ? 'compass-outline' : 'location-outline'}
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {!coords
                ? 'Finding your location…'
                : venues.length > 0
                  ? "Quiet right now"
                  : 'Be the first one here'}
            </Text>
            <Text style={styles.emptyBody}>
              {!coords
                ? "Hang tight — we need your location to show who's around."
                : venues.length > 0
                  ? `No one's set a vibe near you yet — but there's plenty around ${areaName ?? 'you'}. Check out the places below, or get a heads-up the moment someone shows up.`
                  : `You're early in ${areaName ?? 'this area'}. Set your vibe so you're visible, widen your radius, or get pinged when someone arrives.`}
            </Text>

            {coords && (
              <Pressable
                onPress={onToggleAlert}
                disabled={savingAlert}
                style={({ pressed }) => [
                  styles.alertBtn,
                  alertActive && styles.alertBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={alertActive ? 'notifications' : 'notifications-outline'}
                  size={16}
                  color={alertActive ? colors.background : colors.primary}
                />
                <Text
                  style={[
                    styles.alertBtnText,
                    alertActive && styles.alertBtnTextActive,
                  ]}
                >
                  {alertActive
                    ? "We'll ping you — tap to cancel"
                    : 'Notify me when someone’s around'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.countRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.feedNote}>
              {totalNearby} {totalNearby === 1 ? 'person' : 'people'} within{' '}
              {areaName ?? 'range'}
            </Text>
          </View>
        )}

        <LocationBanner status={locStatus} onRetry={retryLoc} />
        <BleBanner status={bleStatus} onRetry={retryBle} />

        {showHere && (
          <View style={styles.hereSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, styles.hereTitle]}>
                Here{hereVenue ? ` at ${hereVenue}` : ''}
              </Text>
            </View>
            <View style={styles.grid}>
              {hereUsers.map((u) => (
                <NearbyCard
                  key={`here:${u.id}`}
                  user={u}
                  onPress={openProfile}
                  onMessage={quickMessage}
                  hideDistance
                />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.feed, isFocus && styles.feedDimmed]}>
          <View style={styles.grid}>
            {bleDevices.map((d) => (
              <MysteryCard key={`ble:${d.id}`} signal={d.signal} />
            ))}
            {generalNearby.map((u) => (
              <NearbyCard
                key={u.id}
                user={u}
                onPress={openProfile}
                onMessage={quickMessage}
              />
            ))}
          </View>
        </View>

        {!isFocus && venues.length > 0 && (
          <View style={styles.venuesSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
              <Text style={styles.sectionTitle}>Places nearby</Text>
            </View>
            <View style={styles.grid}>
              {venues.map((v) => (
                <VenueCard key={v.id} venue={v} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LocationBanner({
  status,
  onRetry,
}: {
  status: ReturnType<typeof useLocation>['status'];
  onRetry: () => void;
}) {
  if (status === 'tracking' || status === 'idle' || status === 'requesting') return null;

  const message =
    status === 'denied'
      ? 'Location permission denied. Tap to retry.'
      : 'Could not get your location. Tap to retry.';

  return (
    <Pressable
      onPress={onRetry}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.bannerText}>{message}</Text>
    </Pressable>
  );
}

function BleBanner({
  status,
  onRetry,
}: {
  status: ReturnType<typeof useBleNearby>['status'];
  onRetry: () => void;
}) {
  // On iOS, BLE proximity isn't part of the experience (GPS-only). Don't
  // surface an "Android-only" notice to every iOS user — just run quietly.
  if (Platform.OS !== 'android') return null;
  if (status === 'scanning' || status === 'idle' || status === 'requesting') return null;

  const message =
    status === 'denied'
      ? 'Bluetooth permission denied. Tap to retry.'
      : status === 'unsupported'
        ? 'Bluetooth proximity is unavailable on this device.'
        : "Couldn't start Bluetooth. Tap to retry.";

  const tappable = status === 'denied' || status === 'error';

  return (
    <Pressable
      onPress={tappable ? onRetry : undefined}
      style={({ pressed }) => [
        styles.banner,
        pressed && tappable && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.bannerText}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  brand: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heading: { ...typography.display, color: colors.secondary },
  feed: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  feedDimmed: { opacity: 0.35 },
  feedNote: { ...typography.caption },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  alertBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  alertBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  alertBtnTextActive: { color: colors.background },
  grid: {
    gap: spacing.md,
  },
  checkedInChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  checkedInText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    maxWidth: 240,
  },
  hereSection: { gap: spacing.sm, marginTop: spacing.md },
  hereTitle: { color: colors.primary },
  venuesSection: { gap: spacing.sm, marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  banner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { ...typography.caption, color: colors.textSecondary },
});
