import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useIsWide } from '../../hooks/useIsWide';
import { listResults, type DrawResultResponse } from '../../services/api';

const GAME_TYPES = ['4D', 'TOTO'] as const;
type GameType = (typeof GAME_TYPES)[number];

function formatDrawDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function FourDCard({ result, isLatest }: { result: DrawResultResponse; isLatest?: boolean }) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const starters = wn.starter as string[] | undefined;
  const consolations = wn.consolation as string[] | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardAccent4D} />

      <View style={styles.cardInner}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.drawDate}>{formatDrawDate(result.draw_date)}</Text>
            {wn.draw_no !== undefined && wn.draw_no !== null && (
              <Text style={styles.drawNo}>Draw #{String(wn.draw_no)}</Text>
            )}
          </View>
          <View style={styles.cardHeaderRight}>
            {isLatest && (
              <View style={styles.latestBadge}>
                <Text style={styles.latestBadgeText}>LATEST</Text>
              </View>
            )}
            <View style={[styles.gameTag, { backgroundColor: Colors.primary }]}>
              <Text style={styles.gameTagText}>4D</Text>
            </View>
          </View>
        </View>

        {/* 1st Prize — dominant */}
        <View style={styles.firstPrizeBox}>
          <Text style={styles.firstPrizeLabel}>1st Prize</Text>
          <Text style={styles.firstPrizeNum}>{String(wn['1st'] ?? '—')}</Text>
        </View>

        {/* 2nd + 3rd */}
        <View style={styles.sidePrizesRow}>
          <View style={[styles.sidePrizeBox, styles.secondPrizeBox]}>
            <Text style={styles.sidePrizeLabel}>2nd Prize</Text>
            <Text style={styles.sidePrizeNum}>{String(wn['2nd'] ?? '—')}</Text>
          </View>
          <View style={[styles.sidePrizeBox, styles.thirdPrizeBox]}>
            <Text style={styles.sidePrizeLabel}>3rd Prize</Text>
            <Text style={styles.sidePrizeNum}>{String(wn['3rd'] ?? '—')}</Text>
          </View>
        </View>

        {/* Starter */}
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

        {/* Consolation */}
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

function TotoCard({ result, isLatest }: { result: DrawResultResponse; isLatest?: boolean }) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const winning = wn.winning_numbers as number[] | undefined;
  const additional = wn.additional_number as number | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardAccentTOTO} />

      <View style={styles.cardInner}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.drawDate}>{formatDrawDate(result.draw_date)}</Text>
            {wn.draw_no !== undefined && wn.draw_no !== null && (
              <Text style={styles.drawNo}>Draw #{String(wn.draw_no)}</Text>
            )}
          </View>
          <View style={styles.cardHeaderRight}>
            {isLatest && (
              <View style={styles.latestBadge}>
                <Text style={styles.latestBadgeText}>LATEST</Text>
              </View>
            )}
            <View style={[styles.gameTag, { backgroundColor: Colors.accent }]}>
              <Text style={styles.gameTagText}>TOTO</Text>
            </View>
          </View>
        </View>

        {winning && (
          <View style={styles.totoSection}>
            <Text style={styles.totoSectionLabel}>Winning Numbers</Text>
            <View style={styles.totoBallsRow}>
              {winning.map((n, i) => (
                <View key={i} style={styles.ball}>
                  <Text style={styles.ballText}>{String(n).padStart(2, '0')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {additional !== undefined && (
          <View style={styles.additionalSection}>
            <Text style={styles.additionalLabel}>Additional Number</Text>
            <View style={styles.additionalRow}>
              <View style={[styles.ball, styles.additionalBall]}>
                <Text style={styles.ballText}>{String(additional).padStart(2, '0')}</Text>
              </View>
              <Text style={styles.additionalNote}>Not counted for Group 1 prize</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ResultsScreen() {
  const isWide = useIsWide();
  const [gameType, setGameType] = useState<GameType>('4D');
  const [results, setResults] = useState<DrawResultResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(gt: GameType, pg: number, append = false) {
    if (pg === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const data = await listResults({ game_type: gt, page: pg, limit: 20 });
      setTotal(data.total);
      if (append) {
        setResults((prev) => [...prev, ...data.items]);
      } else {
        setResults(data.items);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load results' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      void load(gameType, 1);
    }, [gameType]),
  );

  function handleGameTypeChange(gt: GameType) {
    setGameType(gt);
    setPage(1);
  }

  function handleLoadMore() {
    if (results.length >= total || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void load(gameType, nextPage, true);
  }

  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {GAME_TYPES.map((gt) => (
            <TouchableOpacity
              key={gt}
              style={[styles.segmentBtn, gameType === gt && styles.segmentBtnActive]}
              onPress={() => handleGameTypeChange(gt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, gameType === gt && styles.segmentTextActive]}>
                {gt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No results yet</Text>
          <Text style={styles.emptyText}>
            {gameType === '4D'
              ? '4D draw results will appear here after each draw.'
              : 'TOTO draw results will appear here after each draw.'}
          </Text>
        </View>
      ) : (
        <FlatList
          key={isWide ? 'wide' : 'narrow'}
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          renderItem={({ item, index }) => (
            <View style={isWide ? styles.wideCardWrap : null}>
              {gameType === '4D'
                ? <FourDCard result={item} isLatest={index === 0} />
                : <TotoCard result={item} isLatest={index === 0} />}
            </View>
          )}
          columnWrapperStyle={isWide ? styles.columnWrapper : undefined}
          contentContainerStyle={[styles.list, isWide && styles.listWide]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          onRefresh={() => { setPage(1); void load(gameType, 1); }}
          refreshing={loading}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ padding: 16 }} color={Colors.primary} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  /* Segmented control */
  segmentWrap: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },

  list: { padding: Spacing.md, gap: Spacing.md },

  /* Card shell */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent4D: {
    width: 5,
    backgroundColor: Colors.primary,
  },
  cardAccentTOTO: {
    width: 5,
    backgroundColor: Colors.accent,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.md,
  },

  /* Card header */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  drawDate: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },
  drawNo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  gameTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  gameTagText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  latestBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  latestBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 0.5,
  },

  /* 4D prizes */
  firstPrizeBox: {
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
  sidePrizesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sidePrizeBox: {
    flex: 1,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondPrizeBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#94a3b8',
  },
  thirdPrizeBox: {
    backgroundColor: '#fdf6ec',
    borderColor: '#d4a264',
  },
  sidePrizeLabel: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  sidePrizeNum: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1.5,
  },

  /* Starter / Consolation chips */
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
  extraGroupCount: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  numGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
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
  numChipAltText: {
    color: Colors.textSecondary,
  },

  /* TOTO balls */
  totoSection: {
    marginBottom: Spacing.sm,
  },
  totoSectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  totoBallsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ball: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  additionalBall: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  ballText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: Typography.sm,
  },
  additionalSection: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  additionalLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  additionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  additionalNote: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    flex: 1,
    flexWrap: 'wrap',
  },

  /* States */
  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Web wide */
  listWide: { paddingHorizontal: Spacing.md },
  columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
  wideCardWrap: { flex: 1 },
});
