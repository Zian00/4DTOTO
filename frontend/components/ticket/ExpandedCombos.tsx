import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { Section } from './Section';
import type { TicketDetail } from '../../services/api';

const PREVIEW_LIMIT = 12;

type Props = {
  ticket: TicketDetail;
};

function ComboRow({ index, combo }: { index: number; combo: string }) {
  const nums = combo.split(',');
  return (
    <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
      <Text style={styles.rowIndex}>{index + 1}</Text>
      <View style={styles.chips}>
        {nums.map((n, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{n.padStart(2, '0')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ExpandedCombos({ ticket }: Props) {
  const [showAll, setShowAll] = useState(false);
  const combos = ticket.toto_expanded_combinations;

  if (combos.length === 0) return null;

  const visible = showAll ? combos : combos.slice(0, PREVIEW_LIMIT);

  return (
    <Section title="Expanded Combinations">
      <View style={styles.headerRow}>
        <Text style={styles.count}>{combos.length} combinations</Text>
        <Text style={styles.systemTag}>{ticket.toto_ticket?.system_type ?? 'SYSTEM'}</Text>
      </View>

      <View style={styles.table}>
        {visible.map((c, i) => (
          <ComboRow key={c} index={i} combo={c} />
        ))}
      </View>

      {combos.length > PREVIEW_LIMIT && (
        <TouchableOpacity style={styles.action} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={styles.actionText}>
            {showAll ? 'Show less' : `Show all ${combos.length} combinations`}
          </Text>
        </TouchableOpacity>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  count: { fontSize: Typography.base, fontWeight: '700', color: Colors.text },
  systemTag: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.info,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  table: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  rowAlt: { backgroundColor: Colors.surfaceAlt },
  rowIndex: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  chips: { flexDirection: 'row', gap: 5, flex: 1 },
  chip: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: Typography.xs, color: Colors.info, fontWeight: '800' },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
});
