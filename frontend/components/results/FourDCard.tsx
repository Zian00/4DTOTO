import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { formatDrawDate } from '../../utils/format';
import { GameTag } from '../GameTag';
import type { DrawResultResponse } from '../../services/api';

type Props = {
  result: DrawResultResponse;
  isLatest?: boolean;
};

export function FourDCard({ result, isLatest }: Props) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const starters = wn.starter as string[] | undefined;
  const consolations = wn.consolation as string[] | undefined;

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
            <GameTag gameType="4D" size="md" />
          </View>
        </View>

        <View style={styles.firstPrize}>
          <Text style={styles.firstPrizeLabel}>1st Prize</Text>
          <Text style={styles.firstPrizeNum}>{String(wn['1st'] ?? '—')}</Text>
        </View>

        <View style={styles.sidePrizesRow}>
          <View style={[styles.sidePrize, styles.secondPrize]}>
            <Text style={styles.sidePrizeLabel}>2nd Prize</Text>
            <Text style={styles.sidePrizeNum}>{String(wn['2nd'] ?? '—')}</Text>
          </View>
          <View style={[styles.sidePrize, styles.thirdPrize]}>
            <Text style={styles.sidePrizeLabel}>3rd Prize</Text>
            <Text style={styles.sidePrizeNum}>{String(wn['3rd'] ?? '—')}</Text>
          </View>
        </View>

        {starters && starters.length > 0 && (
          <View style={styles.extraGroup}>
            <View style={styles.extraGroupHeader}>
              <Text style={styles.extraGroupLabel}>Starter</Text>
              <Text style={styles.extraGroupCount}>{starters.length} numbers</Text>
            </View>
            <View style={styles.numGrid}>
              {starters.map((n, i) => (
                <View key={i} style={styles.numChip}>
                  <Text style={styles.numChipText}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {consolations && consolations.length > 0 && (
          <View style={styles.extraGroup}>
            <View style={styles.extraGroupHeader}>
              <Text style={styles.extraGroupLabel}>Consolation</Text>
              <Text style={styles.extraGroupCount}>{consolations.length} numbers</Text>
            </View>
            <View style={styles.numGrid}>
              {consolations.map((n, i) => (
                <View key={i} style={[styles.numChip, styles.numChipAlt]}>
                  <Text style={[styles.numChipText, styles.numChipAltText]}>{n}</Text>
                </View>
              ))}
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
  accent: { width: 5, backgroundColor: Colors.primary },
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

  firstPrize: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  firstPrizeLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: '#b45309',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  firstPrizeNum: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 4,
  },

  sidePrizesRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sidePrize: {
    flex: 1,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondPrize: { backgroundColor: '#f8fafc', borderColor: '#94a3b8' },
  thirdPrize: { backgroundColor: '#fdf6ec', borderColor: '#d4a264' },
  sidePrizeLabel: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  sidePrizeNum: { fontSize: Typography.xl, fontWeight: '800', color: Colors.text, letterSpacing: 1.5 },

  extraGroup: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  extraGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  extraGroupLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  extraGroupCount: { fontSize: Typography.xs, color: Colors.textSecondary },
  numGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  numChip: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  numChipAlt: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numChipText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.info,
    fontFamily: 'monospace',
  },
  numChipAltText: { color: Colors.textSecondary },
});
