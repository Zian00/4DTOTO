import { StyleSheet, Text, View } from 'react-native';

import { Colors, Typography } from '../../constants/theme';

type Props = {
  label: string;
  value: string;
};

export function InfoField({ label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  label: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    width: 110,
  },
  value: { fontSize: Typography.sm, color: Colors.text, flex: 1, textAlign: 'right' },
});
