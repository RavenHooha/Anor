import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

type Props = { step: number; total: number };

export default function StepIndicator({ step, total }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { backgroundColor: i <= step ? colors.primary : colors.surfaceElevated },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  bar: { flex: 1, height: 3, borderRadius: 2 },
});
