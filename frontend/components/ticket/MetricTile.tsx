import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Typography } from '../../constants/theme';

type Props = {
  label: string;
  value: string;
};

export function MetricTile({ label, value }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48.8%',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  label: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
  },
});
