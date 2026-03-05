import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing, Typography } from '../../constants/theme';
import { Section } from './Section';
import type { TicketDetail } from '../../services/api';

const PREVIEW_LIMIT = 4;

type Props = {
  ticket: TicketDetail;
};

export function NotificationsList({ ticket }: Props) {
  const [showAll, setShowAll] = useState(false);
  const notifs = ticket.notifications;

  if (notifs.length === 0) return null;

  const visible = showAll ? notifs : notifs.slice(0, PREVIEW_LIMIT);

  return (
    <Section title="Notifications">
      {visible.map((n) => (
        <View key={n.id} style={styles.row}>
          <Text style={styles.message}>{n.message}</Text>
          <Text style={styles.date}>{new Date(n.created_at).toLocaleString('en-SG')}</Text>
        </View>
      ))}

      {notifs.length > PREVIEW_LIMIT && (
        <TouchableOpacity style={styles.action} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={styles.actionText}>
            {showAll ? 'Show fewer notifications' : `Show all ${notifs.length} notifications`}
          </Text>
        </TouchableOpacity>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  message: { fontSize: Typography.sm, color: Colors.text },
  date: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
});
