import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { GameTag } from '../GameTag';
import { StatusChip } from '../StatusChip';
import { InfoField } from './InfoField';
import { MetricTile } from './MetricTile';
import type { TicketDetail } from '../../services/api';

type Props = {
  ticket: TicketDetail;
};

export function TicketInfoCard({ ticket }: Props) {
  const isOutOfRange = ticket.status === 'NO_RESULT';
  const drawDateShort = new Date(ticket.draw_date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const drawDateLong = new Date(ticket.draw_date).toLocaleDateString('en-SG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const uploadedAt = new Date(ticket.purchase_datetime).toLocaleString('en-SG');
  const statusText =
    ticket.status === 'WON'
      ? 'Won'
      : ticket.status === 'LOST'
        ? 'No Prize'
        : ticket.status === 'NO_RESULT'
          ? 'No Result'
          : 'Pending';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <GameTag gameType={ticket.game_type} size="lg" />
        <StatusChip status={ticket.status} variant="badge" />
      </View>

      {ticket.prize_tier && (
        <View style={[styles.prizeStrip, isOutOfRange ? styles.prizeStripMuted : null]}>
          <Text style={[styles.prizeStripText, isOutOfRange ? styles.prizeStripTextMuted : null]}>
            {`Prize Tier: ${ticket.prize_tier}`}
          </Text>
        </View>
      )}

      <View style={styles.metricGrid}>
        <MetricTile label="Draw Date" value={drawDateShort} />
        <MetricTile label="Uploaded" value={uploadedAt} />
        <MetricTile label="Total Price" value={`$${ticket.total_price}`} />
        <MetricTile label="Draw No." value={ticket.draw_number ?? 'N/A'} />
      </View>

      <View style={styles.infoGrid}>
        <InfoField label="Full Draw Date" value={drawDateLong} />
        {ticket.bet_label && <InfoField label="Bet Type" value={ticket.bet_label} />}
        <InfoField label="Ticket Status" value={statusText} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prizeStrip: {
    backgroundColor: Colors.winBg,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  prizeStripText: { color: Colors.win, fontSize: Typography.sm, fontWeight: '700' },
  prizeStripMuted: { backgroundColor: Colors.border },
  prizeStripTextMuted: { color: Colors.textSecondary },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  infoGrid: { gap: Spacing.xs, marginTop: 2 },
});
