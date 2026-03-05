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
import { FourDCard } from '../../components/results/FourDCard';
import { TotoCard } from '../../components/results/TotoCard';

const GAME_TYPES = ['4D', 'TOTO'] as const;
type GameType = (typeof GAME_TYPES)[number];

export default function ResultsScreen() {
  const isWide = useIsWide();
  const [gameType, setGameType] = useState<GameType>('4D');
  const [results, setResults] = useState<DrawResultResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(gt: GameType, pg: number, append = false, isManualRefresh = false) {
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
      if (isManualRefresh && pg === 1 && data.items.length > 0) {
        Toast.show({ type: 'info', text1: 'Results updated' });
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
          onRefresh={() => { setPage(1); void load(gameType, 1, false, true); }}
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
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.full, alignItems: 'center' },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary, fontWeight: '800' },
  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: { padding: Spacing.md, gap: Spacing.md },
  listWide: { paddingHorizontal: Spacing.md },
  columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
  wideCardWrap: { flex: 1 },
});
