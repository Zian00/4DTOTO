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

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import { getPredictions, type PredictionResponse } from '../../services/api';

const MODEL_COLORS = ['#5b6af0', '#c0392b', '#16a085'] as const;
const MODEL_METHOD_NOTES = [
  'Most frequent digit per position (thousands → units) across all draws.',
  'Digit frequency within the most recent 10 draws only.',
  `Digits scored with exponential decay (weight = 0.93^age); recent draws count more.`,
] as const;

function ModelCard({
  prediction,
  modelIndex,
}: {
  prediction: PredictionResponse;
  modelIndex: number;
}) {
  const toto = prediction.toto_prediction;
  const accent = MODEL_COLORS[modelIndex] ?? Colors.primary;

  return (
    <View style={styles.card}>
      {/* Model header */}
      <View style={styles.cardHeader}>
        <View style={[styles.modelNumBadge, { backgroundColor: accent }]}>
          <Text style={styles.modelNumText}>Model {modelIndex + 1}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.modelName}>{prediction.model}</Text>
          <Text style={styles.modelDesc}>{prediction.description}</Text>
        </View>
      </View>
      <Text style={styles.dataPoints}>
        Based on {prediction.data_points} historical draw
        {prediction.data_points !== 1 ? 's' : ''}
      </Text>

      {/* 4D Prediction */}
      <View style={styles.gameBlock}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, { backgroundColor: Colors.primary }]}>
            <Text style={styles.badgeText}>4D</Text>
          </View>
          <Text style={styles.sectionTitle}>Predicted Number</Text>
        </View>
        <View style={styles.fourDBox}>
          {prediction.four_d_prediction.split('').map((digit, i) => (
            <View key={i} style={[styles.digitBox, { backgroundColor: accent }]}>
              <Text style={styles.digit}>{digit}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.methodNote}>{MODEL_METHOD_NOTES[modelIndex]}</Text>
      </View>

      {/* TOTO Prediction */}
      <View style={styles.gameBlock}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
            <Text style={styles.badgeText}>TOTO</Text>
          </View>
          <Text style={styles.sectionTitle}>System 12 Prediction</Text>
        </View>

        <Text style={styles.groupLabel}>Primary Numbers</Text>
        <View style={styles.ballsRow}>
          {toto.primary.map((n) => (
            <View key={n} style={[styles.ball, { backgroundColor: accent }]}>
              <Text style={styles.ballText}>{n}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.groupLabel, { marginTop: Spacing.md }]}>Supplementary Numbers</Text>
        <View style={styles.ballsRow}>
          {toto.supplementary.map((n) => (
            <View key={n} style={[styles.ballOutline, { borderColor: accent }]}>
              <Text style={[styles.ballOutlineText, { color: accent }]}>{n}</Text>
            </View>
          ))}
        </View>

        <View style={styles.formatTag}>
          <Text style={styles.formatTagText}>{toto.format}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PredictScreen() {
  const { showToast } = useToast();
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await getPredictions();
      setPredictions(data);
    } catch {
      showToast('Could not load predictions', 'error');
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
        <Text style={styles.emptyText}>No prediction data available.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {predictions.map((p, i) => (
        <ModelCard key={p.model} prediction={p} modelIndex={i} />
      ))}

      {/* Single disclaimer at the bottom */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>⚠️ Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>{predictions[0].disclaimer}</Text>
      </View>
    </ScrollView>
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
    gap: Spacing.md,
  },
  loadingText: { fontSize: Typography.base, color: Colors.textSecondary },
  emptyText: { fontSize: Typography.base, color: Colors.textSecondary },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  cardHeaderText: { flex: 1 },
  modelNumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  modelNumText: { color: '#fff', fontWeight: '800', fontSize: Typography.xs },
  modelName: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  modelDesc: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  dataPoints: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },

  // Game sections inside a card
  gameBlock: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },

  // 4D
  fourDBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  digitBox: {
    width: 56,
    height: 72,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: Typography['2xl'],
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'monospace',
  },
  methodNote: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  // TOTO
  groupLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ballsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  ballOutline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ballOutlineText: {
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  formatTag: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  formatTagText: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: '700',
  },

  // Disclaimer
  disclaimer: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderLeftWidth: 4,
  },
  disclaimerTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.warning,
    marginBottom: Spacing.sm,
  },
  disclaimerText: {
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 22,
  },
});
