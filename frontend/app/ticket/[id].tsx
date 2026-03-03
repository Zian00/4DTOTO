import React, { useEffect, useState } from 'react';
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
import { deleteTicket, getTicket, imageUrl, type TicketDetail } from '../../services/api';

function StatusBadge({ status, isWinner }: { status: string; isWinner?: boolean }) {
  let label = 'Pending';
  let bg = Colors.border;
  let fg = Colors.textSecondary;

  if (status === 'ocr_failed') { label = 'OCR Failed'; bg = Colors.errorBg; fg = Colors.error; }
  else if (status === 'processing') { label = 'Processing'; bg = Colors.infoBg; fg = Colors.info; }
  else if (status === 'checked') {
    if (isWinner) { label = 'Winner!'; bg = Colors.winBg; fg = Colors.win; }
    else { label = 'No Prize'; bg = Colors.surfaceAlt; fg = Colors.textSecondary; }
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

  const isWinner = ticket.results.some((r) => r.is_winner);
  const drawDate = new Date(ticket.draw_date).toLocaleDateString('en-SG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Ticket image */}
      <Image
        source={{ uri: imageUrl(ticket.image_path) }}
        style={styles.ticketImage}
        resizeMode="contain"
      />

      {/* Header info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={[styles.gameTag, {
            backgroundColor: ticket.game_type === '4D' ? Colors.primary : Colors.accent,
          }]}>
            <Text style={styles.gameTagText}>{ticket.game_type}</Text>
          </View>
          <StatusBadge status={ticket.status} isWinner={isWinner} />
        </View>

        <View style={styles.infoGrid}>
          <InfoField label="Draw Date" value={drawDate} />
          {ticket.bet_type && <InfoField label="Bet Type" value={ticket.bet_type} />}
          <InfoField
            label="Uploaded"
            value={new Date(ticket.purchase_date).toLocaleString('en-SG')}
          />
        </View>
      </View>

      {/* OCR raw numbers */}
      {Array.isArray(ticket.numbers) && (ticket.numbers as unknown[]).length > 0 && (
        <Section title="Extracted Numbers (OCR)">
          <View style={styles.ocrNums}>
            {(ticket.numbers as string[][]).map((numSet, i) => (
              <View key={i} style={styles.ocrSet}>
                {numSet.map((n, j) => (
                  <Text key={j} style={styles.ocrNum}>{n}</Text>
                ))}
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* OCR failed message */}
      {ticket.status === 'ocr_failed' && (
        <View style={styles.ocrFailedBox}>
          <Text style={styles.ocrFailedTitle}>⚠️ OCR Failed</Text>
          <Text style={styles.ocrFailedText}>
            Could not read this ticket. Please retake the photo with better lighting.
          </Text>
          {ticket.raw_ocr_text && (
            <Text style={styles.ocrRaw} numberOfLines={3}>
              Raw: {ticket.raw_ocr_text}
            </Text>
          )}
        </View>
      )}

      {/* Results */}
      {ticket.results.length > 0 && (
        <Section title="Results">
          {ticket.results.map((result) => {
            const combo = ticket.combinations.find((c) => c.id === result.combination_id);
            return (
              <View
                key={result.id}
                style={[styles.resultRow, result.is_winner && styles.resultRowWin]}
              >
                <View style={styles.resultLeft}>
                  {combo && (
                    <Text style={styles.comboText}>
                      {ticket.game_type === 'TOTO'
                        ? combo.combination.split(',').join('  ')
                        : combo.combination}
                    </Text>
                  )}
                  {combo?.is_system_expanded && (
                    <Text style={styles.systemTag}>System expanded</Text>
                  )}
                </View>
                <View style={styles.resultRight}>
                  {result.is_winner ? (
                    <View style={styles.winPill}>
                      <Text style={styles.winPillText}>🎉 {result.prize_tier}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noPrize}>No prize</Text>
                  )}
                </View>
              </View>
            );
          })}
        </Section>
      )}

      {/* Combinations (system bets with no results yet) */}
      {ticket.results.length === 0 && ticket.combinations.length > 0 && (
        <Section title={`Combinations (${ticket.combinations.length})`}>
          <Text style={styles.pendingNote}>
            Results will appear here after the draw is checked.
          </Text>
          {ticket.combinations.slice(0, 20).map((c) => (
            <View key={c.id} style={styles.comboRow}>
              <Text style={styles.comboText}>
                {ticket.game_type === 'TOTO'
                  ? c.combination.split(',').join('  ')
                  : c.combination}
              </Text>
              {c.is_system_expanded && (
                <Text style={styles.systemTag}>expanded</Text>
              )}
            </View>
          ))}
          {ticket.combinations.length > 20 && (
            <Text style={styles.moreText}>
              … and {ticket.combinations.length - 20} more combinations
            </Text>
          )}
        </Section>
      )}

      {/* Delete button */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Ticket</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  ticketImage: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
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
  ocrNums: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ocrSet: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ocrNum: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: 'monospace',
  },
  ocrFailedBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: Spacing.md,
  },
  ocrFailedTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: 6,
  },
  ocrFailedText: {
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  ocrRaw: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultRowWin: { backgroundColor: Colors.winBg, marginHorizontal: -Spacing.sm, paddingHorizontal: Spacing.sm },
  resultLeft: { flex: 1 },
  resultRight: {},
  comboRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  comboText: {
    fontSize: Typography.base,
    fontFamily: 'monospace',
    color: Colors.text,
    fontWeight: '600',
  },
  systemTag: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  winPill: {
    backgroundColor: Colors.win,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  winPillText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  noPrize: { fontSize: Typography.xs, color: Colors.textSecondary },
  pendingNote: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  moreText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: Spacing.sm,
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
