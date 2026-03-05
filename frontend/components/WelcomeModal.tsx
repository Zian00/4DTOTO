import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../constants/theme';

type Props = {
  nameInput: string;
  onChangeName: (text: string) => void;
  onSave: () => void;
  onSkip: () => void;
};

export function WelcomeModal({ nameInput, onChangeName, onSave, onSkip }: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.inner}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to 4D/TOTO!</Text>
          <Text style={styles.subtitle}>Enter a nickname to personalise your experience.</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. John"
            placeholderTextColor={Colors.textSecondary}
            value={nameInput}
            onChangeText={onChangeName}
            maxLength={30}
            autoFocus
            onSubmitEditing={onSave}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.btn} onPress={onSave}>
            <Text style={styles.btnText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography['2xl'],
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
    color: Colors.text,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  btnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
  skipBtn: { paddingVertical: Spacing.sm },
  skipText: { color: Colors.textSecondary, fontSize: Typography.sm },
});
