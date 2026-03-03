import React, { useCallback, useState } from 'react';
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

export default function PredictScreen() {
  const { showToast } = useToast();
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await getPredictions();
      setPrediction(data);
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

  if (!prediction) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No prediction data available.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { toto_prediction: toto } = prediction;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Frequency Analysis</Text>
        <Text style={styles.headerSub}>
          {prediction.description}
        </Text>
        <Text style={styles.dataPoints}>
          Based on {prediction.data_points} historical draw{prediction.data_points !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* 4D Prediction */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, { backgroundColor: Colors.primary }]}>
            <Text style={styles.badgeText}>4D</Text>
          </View>
          <Text style={styles.sectionTitle}>Predicted Number</Text>
        </View>
        <View style={styles.fourDBox}>
          {prediction.four_d_prediction.split('').map((digit, i) => (
            <View key={i} style={styles.digitBox}>
              <Text style={styles.digit}>{digit}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.methodNote}>
          Most frequent digit per position (thousands → units) across all draws.
        </Text>
      </View>

      {/* TOTO Prediction */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
            <Text style={styles.badgeText}>TOTO</Text>
          </View>
          <Text style={styles.sectionTitle}>System 12 Prediction</Text>
        </View>

        <Text style={styles.groupLabel}>Primary Numbers</Text>
        <View style={styles.ballsRow}>
          {toto.primary.map((n) => (
            <View key={n} style={[styles.ball, { backgroundColor: Colors.primary }]}>
              <Text style={styles.ballText}>{n}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.groupLabel, { marginTop: Spacing.md }]}>Supplementary Numbers</Text>
        <View style={styles.ballsRow}>
          {toto.supplementary.map((n) => (
            <View key={n} style={[styles.ball, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.ballText}>{n}</Text>
            </View>
          ))}
        </View>

        <View style={styles.formatTag}>
          <Text style={styles.formatTagText}>{toto.format}</Text>
        </View>

        <Text style={styles.methodNote}>
          Top 12 most-frequent TOTO numbers (1–49) across all draws.
        </Text>
      </View>

      {/* Disclaimer — must be prominent */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>⚠️ Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>{prediction.disclaimer}</Text>
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
  header: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  dataPoints: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  fourDBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  digitBox: {
    width: 64,
    height: 80,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: Typography['3xl'],
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'monospace',
  },
  groupLabel: {
    fontSize: Typography.sm,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: Typography.base,
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
  methodNote: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 18,
    fontStyle: 'italic',
  },
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
