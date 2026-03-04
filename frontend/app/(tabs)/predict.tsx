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
const MODEL_LIGHT_COLORS = ['#eef0fd', '#fdecea', '#e6f6f2'] as const;
const MODEL_METHOD_NOTES = [
  'Most frequent digit per position (thousands → units) across all draws.',
  'Digit frequency within the most recent 10 draws only.',
  'Digits scored with exponential decay (weight = 0.93^age); recent draws count more.',
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
  const accentLight = MODEL_LIGHT_COLORS[modelIndex] ?? Colors.infoBg;

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.cardInner}>
        {/* Model header */}
        <View style={styles.cardHeader}>
          <View style={[styles.modelBadge, { backgroundColor: accent }]}>
            <Text style={styles.modelBadgeText}>M{modelIndex + 1}</Text>
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.modelName}>{prediction.model}</Text>
            <Text style={styles.modelDesc}>{prediction.description}</Text>
          </View>
        </View>

        {/* Data points pill */}
        <View style={[styles.dataPill, { backgroundColor: accentLight }]}>
          <Text style={[styles.dataPillText, { color: accent }]}>
            📊 Based on {prediction.data_points} historical draw{prediction.data_points !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── 4D Block ── */}
        <View style={styles.gameBlock}>
          <View style={styles.gameBlockHeader}>
            <View style={[styles.gameTag, { backgroundColor: Colors.primary }]}>
              <Text style={styles.gameTagText}>4D</Text>
            </View>
            <Text style={styles.gameBlockTitle}>Predicted Number</Text>
          </View>

          <View style={styles.fourDRow}>
            {prediction.four_d_prediction.split('').map((digit, i) => (
              <View key={i} style={[styles.digitBox, { backgroundColor: accent }]}>
                <Text style={styles.digitPos}>{['T', 'H', 'D', 'U'][i]}</Text>
                <Text style={styles.digit}>{digit}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.fourDFull}>{prediction.four_d_prediction}</Text>

          <View style={[styles.methodNote, { backgroundColor: accentLight }]}>
            <Text style={[styles.methodNoteText, { color: accent }]}>
              {MODEL_METHOD_NOTES[modelIndex]}
            </Text>
          </View>
        </View>

        {/* ── TOTO Block ── */}
        <View style={styles.gameBlock}>
          <View style={styles.gameBlockHeader}>
            <View style={[styles.gameTag, { backgroundColor: Colors.accent }]}>
              <Text style={styles.gameTagText}>TOTO</Text>
            </View>
            <Text style={styles.gameBlockTitle}>System 12 Prediction</Text>
          </View>

          <Text style={styles.groupLabel}>Primary Numbers</Text>
          <View style={styles.ballsRow}>
            {toto.primary.map((n) => (
              <View key={n} style={[styles.ball, { backgroundColor: accent, shadowColor: accent }]}>
                <Text style={styles.ballText}>{String(n).padStart(2, '0')}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.groupLabel, { marginTop: Spacing.md }]}>Supplementary Numbers</Text>
          <View style={styles.ballsRow}>
            {toto.supplementary.map((n) => (
              <View key={n} style={[styles.ballOutline, { borderColor: accent }]}>
                <Text style={[styles.ballOutlineText, { color: accent }]}>
                  {String(n).padStart(2, '0')}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.formatTag, { backgroundColor: accentLight }]}>
            <Text style={[styles.formatTagText, { color: accent }]}>{toto.format}</Text>
          </View>
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
      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>Frequency Analysis</Text>
        <Text style={styles.infoBannerText}>
          Numbers are predicted by counting how often each digit has appeared in past draws.
          {' '}Each model uses a different weighting strategy.
        </Text>
      </View>

      {predictions.map((p, i) => (
        <ModelCard key={p.model} prediction={p} modelIndex={i} />
      ))}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>⚠️ Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>{predictions[0].disclaimer}</Text>
      </View>
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
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },

  /* Info banner */
  infoBanner: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  infoBannerTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.info,
  },
  infoBannerText: {
    fontSize: Typography.sm,
    color: '#1e40af',
    lineHeight: 20,
  },

  /* Card shell */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: {
    width: 5,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  /* Card header */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  modelBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: Typography.base,
  },
  cardHeaderText: { flex: 1 },
  modelName: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  modelDesc: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  /* Data points pill */
  dataPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dataPillText: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },

  /* Game blocks */
  gameBlock: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  gameBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  gameTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  gameTagText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  gameBlockTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.text,
  },

  /* 4D */
  fourDRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  digitBox: {
    width: 58,
    height: 76,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  digitPos: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
  },
  digit: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'monospace',
    lineHeight: 32,
  },
  fourDFull: {
    textAlign: 'center',
    fontSize: Typography.xl,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 8,
    marginBottom: Spacing.xs,
  },
  methodNote: {
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  methodNoteText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* TOTO */
  groupLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ballsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ball: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  ballText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: Typography.sm,
  },
  ballOutline: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginTop: Spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  formatTagText: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },

  /* Disclaimer */
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
