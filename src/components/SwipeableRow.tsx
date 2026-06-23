import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme';

const ACTION_WIDTH = 96;
const OPEN_X = -ACTION_WIDTH;
const THRESHOLD = -ACTION_WIDTH / 2;
const SPRING = { damping: 18, stiffness: 220 };

type Props = {
  children: ReactNode;
  onRemove: () => void;
};

// Swipe-left to reveal a Remove action. Built on GestureDetector + Gesture.Pan
// with explicit activation offsets: it claims the touch only on a clear
// horizontal drag, and yields to vertical scrolling so the list still scrolls.
export default function SwipeableRow({ children, onRemove }: Props) {
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]) // activate once dragged ~12px horizontally
    .failOffsetY([-10, 10]) // bail to the scroll view on vertical movement
    .onStart(() => {
      startX.value = tx.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      // clamp between fully-open (with a little resistance) and closed
      tx.value = Math.min(0, Math.max(OPEN_X - 16, next));
    })
    .onEnd(() => {
      tx.value = withSpring(tx.value < THRESHOLD ? OPEN_X : 0, SPRING);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const close = () => {
    tx.value = withSpring(0, SPRING);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer}>
        <Pressable
          onPress={() => {
            close();
            onRemove();
          }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.background} />
          <Text style={styles.actionText}>Remove</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={rowStyle}>{children}</Reanimated.View>
      </GestureDetector>
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
