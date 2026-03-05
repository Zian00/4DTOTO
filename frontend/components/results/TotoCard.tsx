import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { formatDrawDate } from '../../utils/format';
import { GameTag } from '../GameTag';
import { TotoBall } from '../TotoBall';
import type { DrawResultResponse } from '../../services/api';

type Props = {
  result: DrawResultResponse;
  isLatest?: boolean;
};

export function TotoCard({ result, isLatest }: Props) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const winning = wn.winning_numbers as number[] | undefined;
  const additional = wn.additional_number as number | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <Text style={styles.drawDate}>{formatDrawDate(result.draw_date)}</Text>
            {wn.draw_no !== undefined && wn.draw_no !== null && (
              <Text style={styles.drawNo}>Draw #{String(wn.draw_no)}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {isLatest ? (
              <View style={styles.latestBadge}>
                <Text style={styles.latestText}>LATEST</Text>
              </View>
            ) : null}
            <GameTag gameType="TOTO" size="md" />
          </View>
        </View>

        {winning && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Winning Numbers</Text>
            <View style={styles.ballsRow}>
              {winning.map((n, i) => (
                <TotoBall key={i} number={n} variant="filled" color={Colors.primary} />
              ))}
            </View>
          </View>
        )}

        {additional !== undefined && (
          <View style={styles.additionalSection}>
            <Text style={styles.sectionLabel}>Additional Number</Text>
            <View style={styles.additionalRow}>
              <TotoBall number={additional} variant="filled" color={Colors.error} />
              <Text style={styles.additionalNote}>Not counted for Group 1 prize</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: { width: 5, backgroundColor: Colors.accent },
  inner: { flex: 1, padding: Spacing.md },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  drawDate: { fontSize: Typography.base, fontWeight: '700', color: Colors.text },
  drawNo: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  latestBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  latestText: {
    fontSize: Typography.xs,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 0.5,
  },

  section: { marginBottom: Spacing.sm },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  ballsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  additionalSection: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  additionalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  additionalNote: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    flex: 1,
    flexWrap: 'wrap',
  },
});
