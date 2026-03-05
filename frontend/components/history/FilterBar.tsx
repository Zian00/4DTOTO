import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

export const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: '4D', label: '4D' },
  { key: 'TOTO', label: 'TOTO' },
  { key: 'system', label: 'System' },
  { key: 'winning', label: 'Winners' },
] as const;

export type Sort = 'newest' | 'oldest';
export type Filter = (typeof FILTER_OPTIONS)[number]['key'];

type Props = {
  filter: Filter;
  sort: Sort;
  onFilterChange: (filter: Filter) => void;
  onSortToggle: () => void;
};

export function FilterBar({ filter, sort, onFilterChange, onSortToggle }: Props) {
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {FILTER_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.pill, filter === key && styles.pillActive]}
            onPress={() => {
              if (filter !== key) onFilterChange(key);
            }}
          >
            <Text style={[styles.pillText, filter === key && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.sortBtn} onPress={onSortToggle}>
        <Text style={styles.sortBtnText}>{sort === 'newest' ? '↓ New' : '↑ Old'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingRight: Spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: Typography.xs, fontWeight: '600', color: Colors.textSecondary },
  pillTextActive: { color: '#fff' },
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
  sortBtnText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.text },
});
