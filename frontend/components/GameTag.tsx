import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Typography } from '../constants/theme';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  gameType: '4D' | 'TOTO';
  size?: Size;
};

const SIZE_CONFIG: Record<Size, { paddingHorizontal: number; paddingVertical: number; fontSize: number }> = {
  sm: { paddingHorizontal: 8, paddingVertical: 2, fontSize: Typography.xs },
  md: { paddingHorizontal: 10, paddingVertical: 4, fontSize: Typography.sm },
  lg: { paddingHorizontal: 12, paddingVertical: 5, fontSize: Typography.base },
};

export function GameTag({ gameType, size = 'md' }: Props) {
  const bg = gameType === '4D' ? Colors.primary : Colors.accent;
  const { paddingHorizontal, paddingVertical, fontSize } = SIZE_CONFIG[size];
  return (
    <View style={[styles.tag, { backgroundColor: bg, paddingHorizontal, paddingVertical }]}>
      <Text style={[styles.text, { fontSize }]}>{gameType}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: Radius.sm },
  text: { color: '#fff', fontWeight: '800' },
});
