import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Toast from 'react-native-toast-message';

import { Colors, Spacing, Typography } from '../../constants/theme';
import { useIsWide } from '../../hooks/useIsWide';
import { listTickets, type TicketListItem } from '../../services/api';
import { SummaryRow } from '../../components/history/SummaryRow';
import { FilterBar, type Filter, type Sort } from '../../components/history/FilterBar';
import { TicketCard } from '../../components/history/TicketCard';

const NOTIFIED_KEY = '@fourdtoto/notified_tickets';

function toEpoch(value: string): number {
  return new Date(value).getTime();
}

function sortTickets(items: TicketListItem[], sort: Sort): TicketListItem[] {
  return [...items].sort((a, b) =>
    sort === 'oldest'
      ? toEpoch(a.purchase_datetime) - toEpoch(b.purchase_datetime)
      : toEpoch(b.purchase_datetime) - toEpoch(a.purchase_datetime),
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const isWide = useIsWide();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('newest');
  const [filter, setFilter] = useState<Filter>('all');

  async function loadTickets(s: Sort = sort, f: Filter = filter) {
    setLoading(true);
    try {
      const items = await listTickets({
        sort: 'newest',
        filter: f === 'all' ? undefined : f,
      });
      const sorted = sortTickets(items, s);
      setTickets(sorted);
      await checkForNewResults(sorted);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load tickets' });
    } finally {
      setLoading(false);
    }
  }

  async function checkForNewResults(items: TicketListItem[]) {
    const stored = await AsyncStorage.getItem(NOTIFIED_KEY);
    const notifiedIds: string[] = stored ? JSON.parse(stored) : [];
    const newWins = items.filter((t) => t.status === 'WON' && !notifiedIds.includes(t.id));
    const newLosses = items.filter((t) => t.status === 'LOST' && !notifiedIds.includes(t.id));
    for (const t of newWins) {
      Toast.show({
        type: 'success',
        text1: `You won${t.prize_tier ? ` (${t.prize_tier})` : ''} on your ${t.game_type} ticket`,
      });
      notifiedIds.push(t.id);
    }
    if (newWins.length === 0 && newLosses.length > 0) {
      Toast.show({ type: 'info', text1: `${newLosses.length} ticket(s) resolved with no prize.` });
      newLosses.forEach((t) => notifiedIds.push(t.id));
    }
    if (newWins.length > 0 || newLosses.length > 0) {
      await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedIds));
    }
  }

  useFocusEffect(
    useCallback(() => {
      void loadTickets(sort, filter);
    }, [sort, filter]),
  );

  const pendingCount = tickets.filter((t) => t.status === 'PENDING').length;
  const wonCount = tickets.filter((t) => t.status === 'WON').length;

  return (
    <View style={styles.container}>
      {!loading && tickets.length > 0 && (
        <SummaryRow total={tickets.length} pendingCount={pendingCount} wonCount={wonCount} />
      )}

      <FilterBar
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortToggle={() => setSort((p) => (p === 'newest' ? 'oldest' : 'newest'))}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎫</Text>
          <Text style={styles.emptyTitle}>
            {filter === 'all' ? 'No tickets yet' : 'No tickets match this filter'}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Upload a ticket from the Upload tab to get started.'
              : 'Try selecting a different filter above.'}
          </Text>
        </View>
      ) : (
        <FlatList
          key={isWide ? 'wide' : 'narrow'}
          data={tickets}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          renderItem={({ item }) => (
            <View style={isWide ? styles.wideCardWrap : null}>
              <TicketCard item={item} onPress={() => router.push(`/ticket/${item.id}`)} />
            </View>
          )}
          columnWrapperStyle={isWide ? styles.columnWrapper : undefined}
          contentContainerStyle={[styles.list, isWide && styles.listWide]}
          showsVerticalScrollIndicator={false}
          onRefresh={() => loadTickets()}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  listWide: { paddingHorizontal: Spacing.md },
  columnWrapper: { gap: Spacing.sm, marginBottom: Spacing.sm },
  wideCardWrap: { flex: 1 },
});
