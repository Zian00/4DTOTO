import { StyleSheet, Text, View } from 'react-native';

import { Colors, Typography } from '../constants/theme';

type Props = {
  number: number;
  variant?: 'filled' | 'outline';
  color?: string;
  size?: number;
};

export function TotoBall({
  number,
  variant = 'filled',
  color = Colors.primary,
  size = 44,
}: Props) {
  const borderRadius = size / 2;
  const numStr = String(number).padStart(2, '0');

  if (variant === 'outline') {
    return (
      <View style={[styles.outline, { width: size, height: size, borderRadius, borderColor: color }]}>
        <Text style={[styles.outlineText, { color }]}>{numStr}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.filled,
        { width: size, height: size, borderRadius, backgroundColor: color, shadowColor: color },
      ]}
    >
      <Text style={styles.filledText}>{numStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filled: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  filledText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: Typography.sm,
  },
  outline: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlineText: {
    fontWeight: '800',
    fontSize: Typography.sm,
  },
});
