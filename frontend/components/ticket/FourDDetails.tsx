import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { InfoField } from './InfoField';
import { Section } from './Section';
import type { TicketDetail } from '../../services/api';

type Props = {
  ticket: TicketDetail;
};

export function FourDDetails({ ticket }: Props) {
  if (!ticket.four_d_ticket) return null;

  return (
    <Section title="4D Details">
      <View style={styles.numberCard}>
        <Text style={styles.numberLabel}>Ticket Number</Text>
        <Text style={styles.numberValue}>{ticket.four_d_ticket.number}</Text>
      </View>
      <InfoField label="Number" value={ticket.four_d_ticket.number} />
      <InfoField label="Bet" value={ticket.four_d_ticket.bet_type} />
      <InfoField label="Big" value={`$${ticket.four_d_ticket.big_amount}`} />
      <InfoField label="Small" value={`$${ticket.four_d_ticket.small_amount}`} />
    </Section>
  );
}

const styles = StyleSheet.create({
  numberCard: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.info,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: Spacing.sm,
  },
  numberLabel: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: '700',
    marginBottom: 2,
  },
  numberValue: {
    fontSize: Typography['2xl'],
    color: Colors.text,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
