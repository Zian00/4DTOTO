import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { formatDrawDate } from '../../utils/format';
import { GameTag } from '../GameTag';
import { StatusChip } from '../StatusChip';
import type { TicketListItem } from '../../services/api';

type Props = {
  item: TicketListItem;
  onPress: () => void;
};

export function TicketCard({ item, onPress }: Props) {
  const isWon = item.status === 'WON';
  const accentColor = item.game_type === '4D' ? Colors.primary : Colors.accent;
  const drawDate = formatDrawDate(item.draw_date);

  return (
    <TouchableOpacity
      style={[styles.card, isWon && styles.cardWon]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <GameTag gameType={item.game_type} size="sm" />
            {item.draw_number ? (
              <Text style={styles.drawNo}>#{item.draw_number}</Text>
            ) : null}
          </View>
          <StatusChip status={item.status} variant="chip" />
        </View>

        <Text style={styles.drawDate}>{drawDate}</Text>

        <View style={styles.meta}>
          <Text style={styles.metaText}>${item.total_price}</Text>
          {item.bet_label ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{item.bet_label}</Text>
            </>
          ) : null}
        </View>

        {isWon && item.prize_tier ? (
          <View style={styles.prizeBanner}>
            <Text style={styles.prizeBannerText}>🏆 {item.prize_tier}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardWon: { borderColor: Colors.win, backgroundColor: '#f0fdf4' },
  cardAccent: { width: 4 },
  cardBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  drawNo: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  drawDate: { fontSize: Typography.base, fontWeight: '700', color: Colors.text },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 1,
  },
  metaText: { fontSize: Typography.xs, color: Colors.textSecondary },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: Colors.textSecondary,
    opacity: 0.4,
  },
  prizeBanner: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.winBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prizeBannerText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.win },
  chevron: {
    fontSize: 22,
    color: Colors.textSecondary,
    alignSelf: 'center',
    paddingRight: 12,
    opacity: 0.4,
  },
});
