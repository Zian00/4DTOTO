import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
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
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [showAllCombos, setShowAllCombos] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [isRawExpanded, setIsRawExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTicket(id)
      .then(setTicket)
      .catch(() => Toast.show({ type: 'error', text1: 'Could not load ticket' }))
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
            Toast.show({ type: 'info', text1: 'Ticket deleted' });
            router.back();
          } catch {
            Toast.show({ type: 'error', text1: 'Could not delete ticket' });
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
  const drawDateShort = new Date(ticket.draw_date).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const uploadedAt = new Date(ticket.purchase_datetime).toLocaleString('en-SG');
  const statusText = ticket.status === 'WON'
    ? 'Won'
    : ticket.status === 'LOST'
      ? 'No Prize'
      : 'Pending';
  const imageUri = ticket.image_url ? getApiBaseUrl() + ticket.image_url : null;
  const rawCollapsedLines = 8;
  const comboPreviewLimit = 12;
  const notificationPreviewLimit = 4;
  const visibleCombos = showAllCombos
    ? ticket.toto_expanded_combinations
    : ticket.toto_expanded_combinations.slice(0, comboPreviewLimit);
  const visibleNotifications = showAllNotifications
    ? ticket.notifications
    : ticket.notifications.slice(0, notificationPreviewLimit);
  const rawText = ticket.raw_ocr_text ?? '';
  const explicitLineCount = rawText ? rawText.split(/\r?\n/).length : 0;
  const estimatedWrappedLines = rawText ? Math.ceil(rawText.length / 72) : 0;
  const estimatedLineCount = Math.max(explicitLineCount, estimatedWrappedLines);
  const canToggleRawText = estimatedLineCount > rawCollapsedLines;

  function zoomIn() {
    setImageZoom((prev) => Math.min(prev + 0.5, 3));
  }

  function zoomOut() {
    setImageZoom((prev) => Math.max(prev - 0.5, 1));
  }

  function resetZoom() {
    setImageZoom(1);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {imageUri && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            resetZoom();
            setIsImageViewerOpen(true);
          }}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.ticketImage}
            resizeMode="contain"
          />
          <Text style={styles.zoomHint}>Tap image to zoom</Text>
        </TouchableOpacity>
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

        {ticket.prize_tier && (
          <View style={styles.prizeStrip}>
            <Text style={styles.prizeStripText}>{`Prize Tier: ${ticket.prize_tier}`}</Text>
          </View>
        )}

        <View style={styles.metricGrid}>
          <MetricTile label="Draw Date" value={drawDateShort} />
          <MetricTile label="Uploaded" value={uploadedAt} />
          <MetricTile label="Total Price" value={`$${ticket.total_price}`} />
          <MetricTile label="Draw No." value={ticket.draw_number ?? 'N/A'} />
        </View>

        <View style={styles.infoGrid}>
          <InfoField label="Full Draw Date" value={drawDate} />
          {ticket.bet_label && <InfoField label="Bet Type" value={ticket.bet_label} />}
          <InfoField label="Ticket Status" value={statusText} />
        </View>
      </View>

      {ticket.four_d_ticket && (
        <Section title="4D Details">
          <View style={styles.keyNumberCard}>
            <Text style={styles.keyNumberLabel}>Ticket Number</Text>
            <Text style={styles.keyNumberValue}>{ticket.four_d_ticket.number}</Text>
          </View>
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
            value={ticket.toto_ticket?.is_system ? (ticket.toto_ticket.system_type ?? 'SYSTEM') : 'ORDINARY'}
          />
          <Text style={styles.sectionSubTitle}>Selected Numbers</Text>
          <View style={styles.numberRow}>
            {ticket.toto_numbers.map((n) => (
              <Text key={n} style={styles.numberPill}>{String(n).padStart(2, '0')}</Text>
            ))}
          </View>
        </Section>
      )}

      {ticket.toto_expanded_combinations.length > 0 && (
        <Section title="Expanded Combinations">
          <View style={styles.comboHeaderRow}>
            <Text style={styles.comboHeaderCount}>
              {ticket.toto_expanded_combinations.length} combinations
            </Text>
            <Text style={styles.comboHeaderSub}>
              {ticket.toto_ticket?.system_type ?? 'SYSTEM'}
            </Text>
          </View>
          <View style={styles.comboTable}>
            {visibleCombos.map((c, i) => (
              <ComboRow key={c} index={i} combo={c} />
            ))}
          </View>
          {ticket.toto_expanded_combinations.length > comboPreviewLimit && (
            <TouchableOpacity
              style={styles.inlineAction}
              onPress={() => setShowAllCombos((prev) => !prev)}
            >
              <Text style={styles.inlineActionText}>
                {showAllCombos
                  ? 'Show less'
                  : `Show all ${ticket.toto_expanded_combinations.length} combinations`}
              </Text>
            </TouchableOpacity>
          )}
        </Section>
      )}

      {ticket.notifications.length > 0 && (
        <Section title="Notifications">
          {visibleNotifications.map((n) => (
            <View key={n.id} style={styles.notificationRow}>
              <Text style={styles.notificationText}>{n.message}</Text>
              <Text style={styles.notificationDate}>
                {new Date(n.created_at).toLocaleString('en-SG')}
              </Text>
            </View>
          ))}
          {ticket.notifications.length > notificationPreviewLimit && (
            <TouchableOpacity
              style={styles.inlineAction}
              onPress={() => setShowAllNotifications((prev) => !prev)}
            >
              <Text style={styles.inlineActionText}>
                {showAllNotifications
                  ? 'Show fewer notifications'
                  : `Show all ${ticket.notifications.length} notifications`}
              </Text>
            </TouchableOpacity>
          )}
        </Section>
      )}

      {ticket.raw_ocr_text && (
        <Section title="Raw OCR Text">
          <Text style={styles.ocrText} numberOfLines={isRawExpanded ? undefined : rawCollapsedLines}>
            {ticket.raw_ocr_text}
          </Text>
          {canToggleRawText && (
            <TouchableOpacity
              style={styles.inlineAction}
              onPress={() => setIsRawExpanded((prev) => !prev)}
            >
              <Text style={styles.inlineActionText}>
                {isRawExpanded ? 'Show less OCR text' : 'Show full OCR text'}
              </Text>
            </TouchableOpacity>
          )}
        </Section>
      )}

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Ticket</Text>
      </TouchableOpacity>

      {imageUri && (
        <Modal
          animationType="fade"
          visible={isImageViewerOpen}
          transparent
          onRequestClose={() => setIsImageViewerOpen(false)}
        >
          <View style={styles.viewerBackdrop}>
            <View style={styles.viewerTopRow}>
              <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setIsImageViewerOpen(false)}>
                <Text style={styles.viewerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <Pressable style={styles.viewerImageWrap} onPress={() => setIsImageViewerOpen(false)}>
              <Image
                source={{ uri: imageUri }}
                style={[styles.viewerImage, { transform: [{ scale: imageZoom }] }]}
                resizeMode="contain"
              />
            </Pressable>
            <View style={styles.viewerControls}>
              <TouchableOpacity style={styles.viewerControlBtn} onPress={zoomOut}>
                <Text style={styles.viewerControlText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.viewerZoomText}>{`${imageZoom.toFixed(1)}x`}</Text>
              <TouchableOpacity style={styles.viewerControlBtn} onPress={zoomIn}>
                <Text style={styles.viewerControlText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewerResetBtn} onPress={resetZoom}>
                <Text style={styles.viewerResetText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

function ComboRow({ index, combo }: { index: number; combo: string }) {
  const nums = combo.split(',');
  return (
    <View style={[styles.comboRow, index % 2 === 1 && styles.comboRowAlt]}>
      <Text style={styles.comboIndex}>{index + 1}</Text>
      <View style={styles.comboChips}>
        {nums.map((n, i) => (
          <View key={i} style={styles.comboChip}>
            <Text style={styles.comboChipText}>{n.padStart(2, '0')}</Text>
          </View>
        ))}
      </View>
    </View>
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
  zoomHint: {
    marginTop: -8,
    marginBottom: Spacing.md,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
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
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  prizeStrip: {
    backgroundColor: Colors.winBg,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  prizeStripText: {
    color: Colors.win,
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metricTile: {
    width: '48.8%',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  metricLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
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
  infoGrid: {
    gap: Spacing.xs,
    marginTop: 2,
  },
  infoField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    width: 110,
  },
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
  keyNumberCard: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.info,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: Spacing.sm,
  },
  keyNumberLabel: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: '700',
    marginBottom: 2,
  },
  keyNumberValue: {
    fontSize: Typography['2xl'],
    color: Colors.text,
    fontWeight: '800',
    letterSpacing: 2,
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
    minWidth: 40,
    textAlign: 'center',
  },
  comboHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  comboHeaderCount: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },
  comboHeaderSub: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.info,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  comboTable: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  comboRowAlt: {
    backgroundColor: Colors.surfaceAlt,
  },
  comboIndex: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  comboChips: {
    flexDirection: 'row',
    gap: 5,
    flex: 1,
  },
  comboChip: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboChipText: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: '800',
  },
  inlineAction: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineActionText: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: '700',
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
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.95)',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: Spacing.md,
  },
  viewerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
  },
  viewerCloseBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  viewerImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  viewerImage: {
    width: '100%',
    height: '85%',
  },
  viewerControls: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  viewerControlBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerControlText: {
    color: '#fff',
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  viewerZoomText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'center',
  },
  viewerResetBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewerResetText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '700',
  },
});
