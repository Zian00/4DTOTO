import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNotifications } from '../context/NotificationContext';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

const TYPE_DOT: Record<string, { icon: string; color: string; bg: string }> = {
  WON:    { icon: '✓', color: Colors.success, bg: Colors.successBg },
  LOST:   { icon: '✗', color: Colors.error,   bg: Colors.errorBg   },
  default:{ icon: 'i', color: Colors.info,    bg: Colors.infoBg    },
};

function dotConfig(message: string) {
  if (/won/i.test(message)) return TYPE_DOT.WON;
  if (/no prize|lost/i.test(message)) return TYPE_DOT.LOST;
  return TYPE_DOT.default;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NotificationInbox({ open, onClose }: Props) {
  const { entries, markRead } = useNotifications();

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptyHint}>
                Notifications appear here when your tickets are checked against draw results.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {entries.map((e) => {
                const cfg = dotConfig(e.message);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.item, e.is_read && styles.itemRead]}
                    onPress={() => { if (!e.is_read) void markRead(e.id); }}
                    activeOpacity={e.is_read ? 1 : 0.6}
                  >
                    <View style={[styles.dot, { backgroundColor: e.is_read ? Colors.border : cfg.bg }]}>
                      <Text style={[styles.dotText, { color: e.is_read ? Colors.textSecondary : cfg.color }]}>
                        {cfg.icon}
                      </Text>
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={[styles.itemMessage, e.is_read && styles.textRead]}>
                        {e.message}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {e.game_type} · {e.draw_date} · {new Date(e.created_at).toLocaleString('en-SG')}
                      </Text>
                    </View>
                    {!e.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  emptyHint: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: { padding: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: 2,
    backgroundColor: Colors.infoBg,
  },
  itemRead: {
    backgroundColor: Colors.surfaceAlt,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotText: { fontSize: Typography.sm, fontWeight: '800' },
  itemBody: { flex: 1 },
  itemMessage: { fontSize: Typography.sm, color: Colors.text, lineHeight: 18, fontWeight: '600' },
  textRead: { color: Colors.textSecondary, fontWeight: '400' },
  itemMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 3 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
    flexShrink: 0,
  },
});
