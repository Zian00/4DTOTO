import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Typography } from '../constants/theme';

type Status = 'PENDING' | 'WON' | 'LOST';
/** chip = compact (list rows), badge = larger (detail views) */
type Variant = 'chip' | 'badge';

type Props = { status: Status; variant?: Variant };

export function StatusChip({ status, variant = 'chip' }: Props) {
  const isChip = variant === 'chip';

  let bg: string;
  let fg: string;
  let label: string;

  switch (status) {
    case 'WON':
      bg = Colors.winBg;
      fg = Colors.win;
      label = isChip ? 'Won' : 'Winner';
      break;
    case 'LOST':
      bg = Colors.surfaceAlt;
      fg = Colors.textSecondary;
      label = 'No Prize';
      break;
    default: // PENDING
      bg = isChip ? Colors.warningBg : Colors.border;
      fg = isChip ? Colors.warning : Colors.textSecondary;
      label = 'Pending';
  }

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          paddingHorizontal: isChip ? 8 : 10,
          paddingVertical: isChip ? 3 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: fg, fontSize: isChip ? Typography.xs : Typography.sm },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.full },
  text: { fontWeight: '700' },
});
