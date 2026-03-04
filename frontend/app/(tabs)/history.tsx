import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useIsWide } from '../../hooks/useIsWide';
import { listTickets, type TicketListItem } from '../../services/api';

const NOTIFIED_KEY = '@fourdtoto/notified_tickets';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: '4D', label: '4D' },
  { key: 'TOTO', label: 'TOTO' },
  { key: 'system', label: 'System' },
  { key: 'winning', label: 'Winners' },
] as const;

type Sort = 'newest' | 'oldest';
type Filter = (typeof FILTER_OPTIONS)[number]['key'];

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

function StatusChip({ status }: { status: TicketListItem['status'] }) {
  if (status === 'WON') {
    return (
      <View style={[styles.chip, styles.chipWon]}>
        <Text style={[styles.chipText, styles.chipTextWon]}>Won</Text>
      </View>
    );
  }
  if (status === 'LOST') {
    return (
      <View style={[styles.chip, styles.chipLost]}>
        <Text style={[styles.chipText, styles.chipTextLost]}>No Prize</Text>
      </View>
    );
  }
  return (
    <View style={[styles.chip, styles.chipPending]}>
      <Text style={[styles.chipText, styles.chipTextPending]}>Pending</Text>
    </View>
  );
}

function TicketCard({ item, onPress }: { item: TicketListItem; onPress: () => void }) {
  const isWon = item.status === 'WON';
  const accentColor = item.game_type === '4D' ? Colors.primary : Colors.accent;
  const drawDate = new Date(item.draw_date).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[styles.card, isWon && styles.cardWon]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        {/* Top row: game tag + draw number + status chip */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.gameTag, { backgroundColor: accentColor }]}>
              <Text style={styles.gameTagText}>{item.game_type}</Text>
            </View>
            {item.draw_number ? (
              <Text style={styles.drawNo}>#{item.draw_number}</Text>
            ) : null}
          </View>
          <StatusChip status={item.status} />
        </View>

        {/* Draw date */}
        <Text style={styles.drawDate}>{drawDate}</Text>

        {/* Price + bet type */}
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>${item.total_price}</Text>
          {item.bet_label ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{item.bet_label}</Text>
            </>
          ) : null}
        </View>

        {/* Prize banner for winners */}
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

export default function HistoryScreen() {
  const router = useRouter();
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

  const isWide = useIsWide();
  const pendingCount = tickets.filter((t) => t.status === 'PENDING').length;
  const wonCount = tickets.filter((t) => t.status === 'WON').length;

  return (
    <View style={styles.container}>
      {/* Summary stats */}
      {!loading && tickets.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{tickets.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, pendingCount > 0 && styles.summaryPending]}>
              {pendingCount}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, wonCount > 0 && styles.summaryWon]}>
              {wonCount}
            </Text>
            <Text style={styles.summaryLabel}>Won</Text>
          </View>
        </View>
      )}

      {/* Filter pills + sort toggle */}
      <View style={styles.controlBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {FILTER_OPTIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterPill, filter === key && styles.filterPillActive]}
              onPress={() => {
                if (filter !== key) setFilter(key);
              }}
            >
              <Text style={[styles.filterPillText, filter === key && styles.filterPillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSort((p) => (p === 'newest' ? 'oldest' : 'newest'))}
        >
          <Text style={styles.sortBtnText}>{sort === 'newest' ? '↓ New' : '↑ Old'}</Text>
        </TouchableOpacity>
      </View>

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

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryPending: { color: Colors.warning },
  summaryWon: { color: Colors.win },
  summaryLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  summarySep: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingRight: Spacing.sm,
  },
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  filterPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  sortBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    marginLeft: Spacing.xs,
    flexShrink: 0,
  },
  sortBtnText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.text,
  },

  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },

  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardWon: {
    borderColor: Colors.win,
    backgroundColor: '#f0fdf4',
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gameTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  gameTagText: { color: '#fff', fontWeight: '800', fontSize: Typography.xs },
  drawNo: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  drawDate: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },
  cardMeta: {
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
  prizeBannerText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.win,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textSecondary,
    alignSelf: 'center',
    paddingRight: 12,
    opacity: 0.4,
  },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  chipWon: { backgroundColor: Colors.winBg },
  chipLost: { backgroundColor: Colors.surfaceAlt },
  chipPending: { backgroundColor: Colors.warningBg },
  chipText: { fontSize: Typography.xs, fontWeight: '700' },
  chipTextWon: { color: Colors.win },
  chipTextLost: { color: Colors.textSecondary },
  chipTextPending: { color: Colors.warning },

  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 52, marginBottom: Spacing.xs },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Web wide layout */
  listWide: { paddingHorizontal: Spacing.md },
  columnWrapper: { gap: Spacing.sm, marginBottom: Spacing.sm },
  wideCardWrap: { flex: 1 },
});
