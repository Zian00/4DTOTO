import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
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

function FourDCard({ result }: { result: DrawResultResponse }) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const starters = wn.starter as string[] | undefined;
  const consolations = wn.consolation as string[] | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.gameTag, { backgroundColor: Colors.primary }]}>
          <Text style={styles.gameTagText}>4D</Text>
        </View>
        <View>
          <Text style={styles.drawDate}>{formatDrawDate(result.draw_date)}</Text>
          {wn.draw_no && (
            <Text style={styles.drawNo}>Draw #{String(wn.draw_no)}</Text>
          )}
        </View>
      </View>

      <View style={styles.prizesRow}>
        {(['1st', '2nd', '3rd'] as const).map((tier) => (
          <View key={tier} style={styles.prizeBox}>
            <Text style={styles.prizeLabel}>{tier}</Text>
            <Text style={styles.prizeNum}>{String(wn[tier] ?? '—')}</Text>
          </View>
        ))}
      </View>

      {starters && starters.length > 0 && (
        <View style={styles.extraSection}>
          <Text style={styles.extraLabel}>Starter</Text>
          <Text style={styles.extraNums}>{starters.join('  ')}</Text>
        </View>
      )}
      {consolations && consolations.length > 0 && (
        <View style={styles.extraSection}>
          <Text style={styles.extraLabel}>Consolation</Text>
          <Text style={styles.extraNums}>{consolations.join('  ')}</Text>
        </View>
      )}
    </View>
  );
}

function TotoCard({ result }: { result: DrawResultResponse }) {
  const wn = result.winning_numbers as Record<string, unknown>;
  const winning = wn.winning_numbers as number[] | undefined;
  const additional = wn.additional_number as number | undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.gameTag, { backgroundColor: Colors.accent }]}>
          <Text style={styles.gameTagText}>TOTO</Text>
        </View>
        <View>
          <Text style={styles.drawDate}>{formatDrawDate(result.draw_date)}</Text>
          {wn.draw_no && (
            <Text style={styles.drawNo}>Draw #{String(wn.draw_no)}</Text>
          )}
        </View>
      </View>

      {winning && (
        <View style={styles.totoBalls}>
          {winning.map((n, i) => (
            <View key={i} style={styles.ball}>
              <Text style={styles.ballText}>{n}</Text>
            </View>
          ))}
          {additional !== undefined && (
            <>
              <Text style={styles.plusSign}>+</Text>
              <View style={[styles.ball, styles.additionalBall]}>
                <Text style={styles.ballText}>{additional}</Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const { showToast } = useToast();
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
      showToast('Could not load results', 'error');
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
      {/* Game type selector */}
      <View style={styles.tabs}>
        {GAME_TYPES.map((gt) => (
          <TouchableOpacity
            key={gt}
            style={[styles.tab, gameType === gt && styles.tabActive]}
            onPress={() => handleGameTypeChange(gt)}
          >
            <Text style={[styles.tabText, gameType === gt && styles.tabTextActive]}>
              {gt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No results available yet.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            gameType === '4D' ? <FourDCard result={item} /> : <TotoCard result={item} />
          }
          contentContainerStyle={styles.list}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: Typography.base, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gameTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  gameTagText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  drawDate: { fontSize: Typography.base, fontWeight: '600', color: Colors.text },
  drawNo: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  prizesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  prizeBox: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prizeLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  prizeNum: { fontSize: Typography.xl, fontWeight: '800', color: Colors.text },
  extraSection: { marginTop: Spacing.xs },
  extraLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  extraNums: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  totoBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalBall: { backgroundColor: Colors.error },
  ballText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  plusSign: {
    fontSize: Typography.xl,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
});
