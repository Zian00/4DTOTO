import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { GameTag } from '../GameTag';
import { TotoBall } from '../TotoBall';
import type { PredictionResponse } from '../../services/api';

const MODEL_COLORS = ['#5b6af0', '#c0392b', '#16a085'] as const;
const MODEL_LIGHT_COLORS = ['#eef0fd', '#fdecea', '#e6f6f2'] as const;
const MODEL_METHOD_NOTES = [
  'Most frequent digit per position (thousands → units) across all draws.',
  'Digit frequency within the most recent 10 draws only.',
  'Digits scored with exponential decay (weight = 0.93^age); recent draws count more.',
] as const;

type Props = {
  prediction: PredictionResponse;
  modelIndex: number;
};

export function ModelCard({ prediction, modelIndex }: Props) {
  const toto = prediction.toto_prediction;
  const accent = MODEL_COLORS[modelIndex] ?? Colors.primary;
  const accentLight = MODEL_LIGHT_COLORS[modelIndex] ?? Colors.infoBg;

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.modelBadge, { backgroundColor: accent }]}>
            <Text style={styles.modelBadgeText}>M{modelIndex + 1}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.modelName}>{prediction.model}</Text>
            <Text style={styles.modelDesc}>{prediction.description}</Text>
          </View>
        </View>

        {/* Data points */}
        <View style={[styles.dataPill, { backgroundColor: accentLight }]}>
          <Text style={[styles.dataPillText, { color: accent }]}>
            📊 Based on {prediction.data_points} historical draw{prediction.data_points !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* 4D Block */}
        <View style={styles.gameBlock}>
          <View style={styles.gameBlockHeader}>
            <GameTag gameType="4D" size="md" />
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

        {/* TOTO Block */}
        <View style={styles.gameBlock}>
          <View style={styles.gameBlockHeader}>
            <GameTag gameType="TOTO" size="md" />
            <Text style={styles.gameBlockTitle}>System 12 Prediction</Text>
          </View>

          <Text style={styles.groupLabel}>Primary Numbers</Text>
          <View style={styles.ballsRow}>
            {toto.primary.map((n) => (
              <TotoBall key={n} number={n} variant="filled" color={accent} />
            ))}
          </View>

          <Text style={[styles.groupLabel, { marginTop: Spacing.md }]}>Supplementary Numbers</Text>
          <View style={styles.ballsRow}>
            {toto.supplementary.map((n) => (
              <TotoBall key={n} number={n} variant="outline" color={accent} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: { width: 5 },
  inner: { flex: 1, padding: Spacing.md, gap: Spacing.sm },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  modelBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelBadgeText: { color: '#fff', fontWeight: '900', fontSize: Typography.base },
  headerText: { flex: 1 },
  modelName: { fontSize: Typography.base, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  modelDesc: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 18 },

  dataPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dataPillText: { fontSize: Typography.xs, fontWeight: '700' },

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
  gameBlockTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.text },

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
  methodNote: { borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  methodNoteText: { fontSize: Typography.xs, fontWeight: '600', lineHeight: 17 },

  groupLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ballsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  formatTag: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  formatTagText: { fontSize: Typography.xs, fontWeight: '700' },
});
