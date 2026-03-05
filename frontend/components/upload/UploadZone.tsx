import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

type Props = {
  onCamera: () => void;
  onGallery: () => void;
};

const HOW_STEPS = [
  { n: '1', label: 'Scan your ticket', desc: 'Take a photo or pick from gallery' },
  { n: '2', label: 'AI reads the details', desc: 'Game type, draw date, and numbers are detected' },
  { n: '3', label: 'Review & confirm', desc: 'Fix any errors, then save to track results' },
];

export function UploadZone({ onCamera, onGallery }: Props) {
  return (
    <>
      <View style={styles.zone}>
        <Text style={styles.icon}>🎫</Text>
        <Text style={styles.title}>Scan your ticket</Text>
        <Text style={styles.sub}>Take a clear photo or pick from your gallery</Text>
        <View style={styles.btns}>
          <TouchableOpacity style={[styles.btn, styles.cameraBtn]} onPress={onCamera}>
            <Text style={styles.btnEmoji}>📷</Text>
            <Text style={styles.btnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.galleryBtn]} onPress={onGallery}>
            <Text style={styles.btnEmoji}>🖼</Text>
            <Text style={styles.btnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How it works</Text>
        {HOW_STEPS.map(({ n, label, desc }) => (
          <View key={n} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{n}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepLabel}>{label}</Text>
              <Text style={styles.stepDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  zone: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  icon: { fontSize: 48, marginBottom: 4 },
  title: { fontSize: Typography.xl, fontWeight: '700', color: Colors.text },
  sub: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  btns: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  cameraBtn: { backgroundColor: Colors.primary },
  galleryBtn: { backgroundColor: Colors.primaryLight },
  btnEmoji: { fontSize: 18 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },

  howItWorks: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  howTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: Typography.sm },
  stepBody: { flex: 1, gap: 2 },
  stepLabel: { fontSize: Typography.sm, fontWeight: '700', color: Colors.text },
  stepDesc: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 18 },
});
