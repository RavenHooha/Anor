import { useRef, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme';

const ACTION_WIDTH = 96;
const OPEN_THRESHOLD = 48; // drag past this to snap open / trigger

type Props = {
  children: ReactNode;
  onRemove: () => void;
};

// Swipe-left to reveal a Remove action. Built on the RN-core PanResponder +
// Animated so it ships over the air (no native gesture-handler dependency).
export default function SwipeableRow({ children, onRemove }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const snap = (toOpen: boolean) => {
    openRef.current = toOpen;
    Animated.spring(translateX, {
      toValue: toOpen ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // Only claim the gesture for a clear horizontal drag, so vertical list
      // scrolling and taps pass through untouched.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        let next = base + g.dx;
        if (next > 0) next = 0;
        if (next < -ACTION_WIDTH - 24) next = -ACTION_WIDTH - 24; // a little resistance
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        snap(base + g.dx < -OPEN_THRESHOLD);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer}>
        <Pressable
          onPress={() => {
            snap(false);
            onRemove();
          }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.background} />
          <Text style={styles.actionText}>Remove</Text>
        </Pressable>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    height: '100%',
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
});
