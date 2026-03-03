import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ToastContainer, useToastState } from '../components/Toast';
import { ToastContext } from '../hooks/useToast';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';
import { getNickname, setNickname } from '../utils/deviceId';

export default function RootLayout() {
  const { toast, showToast, fadeAnim } = useToastState();
  const [showWelcome, setShowWelcome] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getNickname().then((name) => {
      if (!name) setShowWelcome(true);
    });
  }, []);

  function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Please enter a name');
      return;
    }
    setNickname(trimmed);
    setShowWelcome(false);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      <StatusBar style="light" />

      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ticket/[id]"
          options={{
            title: 'Ticket Detail',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: '#fff',
          }}
        />
      </Stack>

      <ToastContainer toast={toast} fadeAnim={fadeAnim} />

      {/* First-launch welcome modal */}
      <Modal visible={showWelcome} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Welcome to 4D/TOTO!</Text>
            <Text style={styles.modalSubtitle}>
              Enter a nickname to personalise your experience.
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="e.g. John"
              placeholderTextColor={Colors.textSecondary}
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={30}
              autoFocus
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleSaveName}>
              <Text style={styles.modalBtnText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowWelcome(false)}
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: Typography['2xl'],
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
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
  modalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: Typography.base,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
});
