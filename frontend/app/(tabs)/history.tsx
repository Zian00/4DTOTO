import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import { getApiBaseUrl, listTickets, type TicketListItem } from '../../services/api';

const NOTIFIED_KEY = '@fourdtoto/notified_tickets';

const SORTS = ['newest', 'winning'] as const;
const FILTERS = ['all', '4D', 'TOTO', 'system', 'winning'] as const;
type Sort = (typeof SORTS)[number];
type Filter = (typeof FILTERS)[number];

function StatusChip({ item }: { item: TicketListItem }) {
  let label: string = 'Pending';
  let bg: string = Colors.border;
  let fg: string = Colors.textSecondary;

  if (item.status === 'WON') {
    label = `Won${item.prize_tier ? ` (${item.prize_tier})` : ''}`;
    bg = Colors.winBg;
    fg = Colors.win;
  } else if (item.status === 'LOST') {
    label = 'No Prize';
    bg = Colors.surfaceAlt;
    fg = Colors.textSecondary;
  }

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function TicketCard({
  item,
  onPress,
}: {
  item: TicketListItem;
  onPress: () => void;
}) {
  const drawDate = new Date(item.draw_date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardRow}>
        {item.image_url ? (
          <Image source={{ uri: getApiBaseUrl() + item.image_url }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.badge, { backgroundColor: item.game_type === '4D' ? Colors.primary : Colors.accent }]}>
            <Text style={styles.badgeText}>{item.game_type}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            {item.image_url && (
              <View style={[styles.badgeSmall, { backgroundColor: item.game_type === '4D' ? Colors.primary : Colors.accent }]}>
                <Text style={styles.badgeSmallText}>{item.game_type}</Text>
              </View>
            )}
            <Text style={styles.cardDate}>Draw: {drawDate}</Text>
          </View>
          <Text style={styles.cardMeta}>Total: ${item.total_price}</Text>
          {item.bet_label && (
            <Text style={styles.cardBetType}>{item.bet_label}</Text>
          )}
        </View>
        <StatusChip item={item} />
      </View>
      {item.status === 'WON' && item.prize_tier && (
        <View style={styles.winBanner}>
          <Text style={styles.winBannerText}>Prize: {item.prize_tier}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('newest');
  const [filter, setFilter] = useState<Filter>('all');

  async function loadTickets(s: Sort = sort, f: Filter = filter) {
    setLoading(true);
    try {
      const items = await listTickets({
        sort: s,
        filter: f === 'all' ? undefined : f,
      });
      setTickets(items);
      await checkForNewResults(items);
    } catch {
      showToast('Could not load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function checkForNewResults(items: TicketListItem[]) {
    const stored = await AsyncStorage.getItem(NOTIFIED_KEY);
    const notifiedIds: string[] = stored ? JSON.parse(stored) : [];

    const newWins = items.filter(
      (t) => t.status === 'WON' && !notifiedIds.includes(t.id),
    );
    const newLosses = items.filter(
      (t) => t.status === 'LOST' && !notifiedIds.includes(t.id),
    );

    for (const t of newWins) {
      showToast(`You won! ${t.prize_tier ?? ''} on your ${t.game_type} ticket`, 'win');
      notifiedIds.push(t.id);
    }
    if (newWins.length === 0 && newLosses.length > 0) {
      showToast(`${newLosses.length} ticket(s) resolved with no prize.`, 'loss');
      newLosses.forEach((t) => notifiedIds.push(t.id));
    }

    if (newWins.length > 0 || newLosses.length > 0) {
      await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedIds));
    }
  }

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [sort, filter]),
  );

  function handleSortChange(s: Sort) {
    setSort(s);
    void loadTickets(s, filter);
  }

  function handleFilterChange(f: Filter) {
    setFilter(f);
    void loadTickets(sort, f);
  }

  return (
    <View style={styles.container}>
      <View style={styles.controlBar}>
        <Text style={styles.controlLabel}>Sort:</Text>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.pill, sort === s && styles.pillActive]}
            onPress={() => handleSortChange(s)}
          >
            <Text style={[styles.pillText, sort === s && styles.pillTextActive]}>
              {s === 'newest' ? 'Newest' : 'Winning'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controlBar}>
        <Text style={styles.controlLabel}>Filter:</Text>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => handleFilterChange(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'all' ? 'All' : f === 'system' ? 'System' : f === 'winning' ? 'Wins' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>No tickets</Text>
          <Text style={styles.emptyText}>Upload one from the Home tab.</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TicketCard item={item} onPress={() => router.push(`/ticket/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
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
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  controlLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginRight: 2,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeSmallText: { color: '#fff', fontWeight: '800', fontSize: Typography.xs },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  cardDate: { fontSize: Typography.base, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  cardBetType: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  chipText: { fontSize: Typography.xs, fontWeight: '700' },
  winBanner: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.winBg,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  winBannerText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.win },
  loader: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: { fontSize: 28, marginBottom: Spacing.md, color: Colors.textSecondary },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
