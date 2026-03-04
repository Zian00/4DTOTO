import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import { deleteTicket, getApiBaseUrl, getTicket, type TicketDetail } from '../../services/api';

function StatusBadge({ status }: { status: 'PENDING' | 'WON' | 'LOST' }) {
  let label: string = 'Pending';
  let bg: string = Colors.border;
  let fg: string = Colors.textSecondary;

  if (status === 'WON') {
    label = 'Winner';
    bg = Colors.winBg;
    fg = Colors.win;
  } else if (status === 'LOST') {
    label = 'No Prize';
    bg = Colors.surfaceAlt;
    fg = Colors.textSecondary;
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getTicket(id)
      .then(setTicket)
      .catch(() => showToast('Could not load ticket', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!ticket) return;
    Alert.alert('Delete Ticket', 'Are you sure you want to delete this ticket?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTicket(ticket.id);
            showToast('Ticket deleted', 'info');
            router.back();
          } catch {
            showToast('Could not delete ticket', 'error');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Ticket not found.</Text>
      </View>
    );
  }

  const drawDate = new Date(ticket.draw_date).toLocaleDateString('en-SG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {ticket.image_url && (
        <Image
          source={{ uri: getApiBaseUrl() + ticket.image_url }}
          style={styles.ticketImage}
          resizeMode="contain"
        />
      )}

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={[styles.gameTag, {
            backgroundColor: ticket.game_type === '4D' ? Colors.primary : Colors.accent,
          }]}>
            <Text style={styles.gameTagText}>{ticket.game_type}</Text>
          </View>
          <StatusBadge status={ticket.status} />
        </View>

        <View style={styles.infoGrid}>
          <InfoField label="Draw Date" value={drawDate} />
          {ticket.bet_label && <InfoField label="Bet Type" value={ticket.bet_label} />}
          <InfoField label="Total Price" value={`$${ticket.total_price}`} />
          <InfoField
            label="Uploaded"
            value={new Date(ticket.purchase_datetime).toLocaleString('en-SG')}
          />
        </View>
      </View>

      {ticket.four_d_ticket && (
        <Section title="4D Details">
          <InfoField label="Number" value={ticket.four_d_ticket.number} />
          <InfoField label="Bet" value={ticket.four_d_ticket.bet_type} />
          <InfoField label="Big" value={`$${ticket.four_d_ticket.big_amount}`} />
          <InfoField label="Small" value={`$${ticket.four_d_ticket.small_amount}`} />
        </Section>
      )}

      {ticket.game_type === 'TOTO' && (
        <Section title="TOTO Details">
          <InfoField
            label="System"
            value={ticket.toto_ticket?.is_system ? (ticket.toto_ticket.system_type ?? 'SYSTEM') : 'STANDARD'}
          />
          <Text style={styles.sectionSubTitle}>Selected Numbers</Text>
          <View style={styles.numberRow}>
            {ticket.toto_numbers.map((n) => (
              <Text key={n} style={styles.numberPill}>{n}</Text>
            ))}
          </View>
        </Section>
      )}

      {ticket.toto_expanded_combinations.length > 0 && (
        <Section title={`Expanded Combinations (${ticket.toto_expanded_combinations.length})`}>
          {ticket.toto_expanded_combinations.slice(0, 30).map((c) => (
            <Text key={c} style={styles.comboText}>{c}</Text>
          ))}
          {ticket.toto_expanded_combinations.length > 30 && (
            <Text style={styles.moreText}>
              ...and {ticket.toto_expanded_combinations.length - 30} more
            </Text>
          )}
        </Section>
      )}

      {ticket.notifications.length > 0 && (
        <Section title="Notifications">
          {ticket.notifications.map((n) => (
            <View key={n.id} style={styles.notificationRow}>
              <Text style={styles.notificationText}>{n.message}</Text>
              <Text style={styles.notificationDate}>
                {new Date(n.created_at).toLocaleString('en-SG')}
              </Text>
            </View>
          ))}
        </Section>
      )}

      {ticket.raw_ocr_text && (
        <Section title="Raw OCR Text">
          <Text style={styles.ocrText}>{ticket.raw_ocr_text}</Text>
        </Section>
      )}

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Ticket</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoField}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  ticketImage: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    marginBottom: Spacing.md,
  },
  ocrText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gameTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  gameTagText: { color: '#fff', fontWeight: '800', fontSize: Typography.base },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusBadgeText: { fontSize: Typography.sm, fontWeight: '700' },
  infoGrid: { gap: Spacing.xs },
  infoField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: Typography.sm, color: Colors.text, flex: 1, textAlign: 'right' },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionSubTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  numberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  numberPill: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
  },
  comboText: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontFamily: 'monospace',
    paddingVertical: 3,
  },
  moreText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  notificationRow: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notificationText: {
    fontSize: Typography.sm,
    color: Colors.text,
  },
  notificationDate: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
});
