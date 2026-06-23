import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme';

const ACTION_WIDTH = 96;

type Props = {
  children: ReactNode;
  onRemove: () => void;
};

// Swipe-left to reveal a Remove action, via react-native-gesture-handler's
// ReanimatedSwipeable (runs on the UI thread — smooth, native-grade gesture).
export default function SwipeableRow({ children, onRemove }: Props) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={styles.container}
      renderRightActions={(_progress, drag) => (
        <RightAction
          drag={drag}
          onPress={() => {
            ref.current?.close();
            onRemove();
          }}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function RightAction({
  drag,
  onPress,
}: {
  drag: SharedValue<number>;
  onPress: () => void;
}) {
  // Keep the action pinned to the row's right edge as it's dragged open.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + ACTION_WIDTH }],
  }));

  return (
    <Reanimated.View style={[styles.actionWrap, style]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="trash-outline" size={20} color={colors.background} />
        <Text style={styles.actionText}>Remove</Text>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.lg },
  actionWrap: { width: ACTION_WIDTH },
  action: {
    flex: 1,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.lg,
  },
  actionText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
});
