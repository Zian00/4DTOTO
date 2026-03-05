import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Toast from 'react-native-toast-message';

import { Colors, Spacing, Typography } from '../../constants/theme';
import { deleteTicket, getApiBaseUrl, getTicket, type TicketDetail } from '../../services/api';
import { TicketImageViewer } from '../../components/ticket/TicketImageViewer';
import { TicketInfoCard } from '../../components/ticket/TicketInfoCard';
import { FourDDetails } from '../../components/ticket/FourDDetails';
import { TotoDetails } from '../../components/ticket/TotoDetails';
import { ExpandedCombos } from '../../components/ticket/ExpandedCombos';
import { RawOcrSection } from '../../components/ticket/RawOcrSection';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  const imageUri = ticket.image_url ? getApiBaseUrl() + ticket.image_url : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(tabs)/history')}>
        <Text style={styles.backBtnText}>← Back to History</Text>
      </TouchableOpacity>

      {imageUri && <TicketImageViewer imageUri={imageUri} />}

      <TicketInfoCard ticket={ticket} />

      <FourDDetails ticket={ticket} />

      <TotoDetails ticket={ticket} />

      <ExpandedCombos ticket={ticket} />

      <RawOcrSection rawText={ticket.raw_ocr_text} />

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Ticket</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  backBtn: { marginBottom: Spacing.md },
  backBtnText: { color: Colors.primary, fontSize: Typography.base, fontWeight: '600' },
});
