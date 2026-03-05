import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useIsWide } from '../../hooks/useIsWide';
import { getPredictions, type PredictionResponse } from '../../services/api';
import { ModelCard } from '../../components/predict/ModelCard';
import { DisclaimerBanner } from '../../components/predict/DisclaimerBanner';

function InfoBanner() {
  return (
    <View style={styles.infoBanner}>
      <Text style={styles.infoBannerTitle}>Frequency Analysis</Text>
      <Text style={styles.infoBannerText}>
        Numbers are predicted by counting how often each digit has appeared in past draws.
        {' '}Each model uses a different weighting strategy.
      </Text>
    </View>
  );
}

export default function PredictScreen() {
  const isWide = useIsWide();
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await getPredictions();
      setPredictions(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load predictions' });
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Analysing historical data…</Text>
      </View>
    );
  }

  if (!predictions.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔮</Text>
        <Text style={styles.emptyTitle}>No predictions available</Text>
        <Text style={styles.emptyText}>Make sure draw results have been loaded first.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InfoBanner />

      <View style={isWide ? styles.cardsGrid : styles.cardsStack}>
        {predictions.map((p, i) => (
          <View key={p.model} style={isWide ? styles.gridItem : null}>
            <ModelCard prediction={p} modelIndex={i} />
          </View>
        ))}
      </View>

      <DisclaimerBanner text={predictions[0].disclaimer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: { fontSize: Typography.base, color: Colors.textSecondary },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  infoBanner: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  infoBannerTitle: { fontSize: Typography.base, fontWeight: '800', color: Colors.info },
  infoBannerText: { fontSize: Typography.sm, color: '#1e40af', lineHeight: 20 },
  cardsStack: { gap: Spacing.md },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  gridItem: { flex: 1, minWidth: 300 },
});
