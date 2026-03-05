import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '../../constants/theme';

type Props = {
  total: number;
  pendingCount: number;
  wonCount: number;
};

export function SummaryRow({ total, pendingCount, wonCount }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Text style={styles.value}>{total}</Text>
        <Text style={styles.label}>Total</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.item}>
        <Text style={[styles.value, pendingCount > 0 && styles.valuePending]}>
          {pendingCount}
        </Text>
        <Text style={styles.label}>Pending</Text>
      </View>
      <View style={styles.sep} />
      <View style={styles.item}>
        <Text style={[styles.value, wonCount > 0 && styles.valueWon]}>{wonCount}</Text>
        <Text style={styles.label}>Won</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  item: { flex: 1, alignItems: 'center' },
  value: { fontSize: Typography.lg, fontWeight: '800', color: Colors.text },
  valuePending: { color: Colors.warning },
  valueWon: { color: Colors.win },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 1 },
  sep: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
});
