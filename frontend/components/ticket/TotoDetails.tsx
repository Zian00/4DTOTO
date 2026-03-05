import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { InfoField } from './InfoField';
import { Section } from './Section';
import type { TicketDetail } from '../../services/api';

type Props = {
  ticket: TicketDetail;
};

export function TotoDetails({ ticket }: Props) {
  if (ticket.game_type !== 'TOTO') return null;

  return (
    <Section title="TOTO Details">
      <InfoField
        label="System"
        value={
          ticket.toto_ticket?.is_system
            ? (ticket.toto_ticket.system_type ?? 'SYSTEM')
            : 'ORDINARY'
        }
      />
      <Text style={styles.subTitle}>Selected Numbers</Text>
      <View style={styles.numberRow}>
        {ticket.toto_numbers.map((n) => (
          <Text key={n} style={styles.pill}>{String(n).padStart(2, '0')}</Text>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  subTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  numberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  pill: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
});
