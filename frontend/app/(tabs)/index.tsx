import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import { uploadTicket } from '../../services/api';
import { getDeviceId, getNickname } from '../../utils/deviceId';

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function UploadScreen() {
  const { showToast } = useToast();
  const [deviceId, setDeviceId] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getNickname().then((n) => setNickname(n ?? ''));
    }, []),
  );

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      setUploadState('idle');
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      setUploadState('idle');
    }
  }

  async function handleUpload() {
    if (!selectedUri || !deviceId) return;
    setUploadState('uploading');
    setUploadMsg('Uploading ticket…');
    try {
      const response = await uploadTicket(selectedUri, deviceId);
      setUploadState('processing');
      setUploadMsg(
        `Ticket uploaded! OCR in progress — draw date will be confirmed shortly.\n\nTicket ID: ${response.id.slice(0, 8)}…`,
      );
      showToast('Ticket uploaded — OCR processing started', 'info');
      setSelectedUri(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState('error');
      setUploadMsg(msg);
      showToast('Upload failed. Please try again.', 'error');
    }
  }

  function reset() {
    setSelectedUri(null);
    setUploadState('idle');
    setUploadMsg('');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Welcome header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {nickname ? `Welcome back, ${nickname}!` : 'Welcome!'}
        </Text>
        <Text style={styles.subheading}>
          Upload a photo of your lottery ticket to check your numbers.
        </Text>
      </View>

      {/* Image preview or placeholder */}
      {selectedUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity style={styles.clearBtn} onPress={reset}>
            <Text style={styles.clearBtnText}>✕ Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🎟️</Text>
          <Text style={styles.placeholderText}>No ticket selected</Text>
        </View>
      )}

      {/* Pick buttons */}
      <View style={styles.pickerRow}>
        <TouchableOpacity style={[styles.pickBtn, styles.cameraBtn]} onPress={pickFromCamera}>
          <Text style={styles.pickBtnText}>📷  Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, styles.galleryBtn]} onPress={pickFromGallery}>
          <Text style={styles.pickBtnText}>🖼️  Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Upload button */}
      {selectedUri && uploadState === 'idle' && (
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
          <Text style={styles.uploadBtnText}>Upload &amp; Check Numbers</Text>
        </TouchableOpacity>
      )}

      {/* Status message */}
      {uploadState === 'uploading' && (
        <View style={styles.statusBox}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.statusText}>{uploadMsg}</Text>
        </View>
      )}

      {uploadState === 'processing' && (
        <View style={[styles.statusBox, styles.statusInfo]}>
          <Text style={styles.statusText}>{uploadMsg}</Text>
          <Text style={styles.statusHint}>
            Check the History tab to see results once OCR completes.
          </Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Upload Another Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploadState === 'error' && (
        <View style={[styles.statusBox, styles.statusError]}>
          <Text style={styles.statusText}>⚠️ {uploadMsg}</Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      {uploadState === 'idle' && !selectedUri && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          {[
            '1. Take a clear photo of your 4D or TOTO ticket',
            '2. Upload — our AI reads the numbers via OCR',
            '3. Check History for your results after the draw',
          ].map((step) => (
            <Text key={step} style={styles.instructionStep}>
              {step}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  greeting: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  previewContainer: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  preview: {
    width: '100%',
    height: 260,
  },
  clearBtn: {
    backgroundColor: Colors.error,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },
  placeholder: {
    height: 180,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { fontSize: Typography.base, color: Colors.textSecondary },
  pickerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pickBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  cameraBtn: { backgroundColor: Colors.primary },
  galleryBtn: { backgroundColor: Colors.primaryLight },
  pickBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  uploadBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  uploadBtnText: { color: '#fff', fontWeight: '800', fontSize: Typography.lg },
  statusBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.infoBg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusInfo: { backgroundColor: Colors.infoBg },
  statusError: { backgroundColor: Colors.errorBg },
  statusText: {
    fontSize: Typography.sm,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusHint: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  newUploadBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  newUploadBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },
  instructions: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
  },
  instructionsTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  instructionStep: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
});
