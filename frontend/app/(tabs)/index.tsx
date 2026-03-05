import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useIsWide } from '../../hooks/useIsWide';
import { confirmTicket, uploadTicket } from '../../services/api';
import { getNickname } from '../../utils/deviceId';
import type {
  DraftConfidence,
  FieldErrors,
  FieldTouched,
  OcrDraft,
  ReviewField,
  UploadState,
} from '../../types/upload';
import {
  EMPTY_DRAFT_CONFIDENCE,
  buildDraftConfidence,
  formatBetTypeLabel,
  getBetTypeOptions,
  normalizeBetType,
  parseNumbersForSubmit,
  toDraft,
} from '../../utils/uploadHelpers';
import { ImagePreviewBar } from '../../components/upload/ImagePreviewBar';
import { ReviewForm } from '../../components/upload/ReviewForm';
import { UploadZone } from '../../components/upload/UploadZone';

export default function UploadScreen() {
  const isWide = useIsWide();
  const [nickname, setNickname] = useState('');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMsg, setUploadMsg] = useState('');
  const [draft, setDraft] = useState<OcrDraft | null>(null);
  const [draftConfidence, setDraftConfidence] = useState<DraftConfidence>(EMPTY_DRAFT_CONFIDENCE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldTouched, setFieldTouched] = useState<FieldTouched>({});

  const parsedNumberRows = useMemo(
    () => (draft ? parseNumbersForSubmit(draft.numbersText, draft.gameType) : []),
    [draft?.numbersText, draft?.gameType],
  );

  const numberPreviewRows = useMemo(
    () =>
      parsedNumberRows.map((row, idx) => {
        if (!draft) return { key: `row-${idx}`, text: row.join(' '), isValid: false };
        let isValid = false;
        if (draft.gameType === '4D') {
          isValid = /^\d{4}$/.test(row[0] ?? '');
        } else {
          const normalizedBetType = normalizeBetType(draft.gameType, draft.betType);
          const inRange = row.length >= 6 && row.length <= 12;
          if (!inRange) {
            isValid = false;
          } else if (normalizedBetType === 'ORDINARY') {
            isValid = row.length === 6;
          } else {
            const systemMatch = /^SYSTEM_(\d+)$/.exec(normalizedBetType);
            const expected = systemMatch ? Number.parseInt(systemMatch[1], 10) : 6;
            isValid = row.length === expected;
          }
        }
        return {
          key: `${row.join('-')}-${idx}`,
          text: draft.gameType === '4D' ? String(row[0] ?? '') : row.join(' '),
          isValid,
        };
      }),
    [parsedNumberRows, draft],
  );

  const parsedValidNumberCount = numberPreviewRows.filter((r) => r.isValid).length;
  const parsedInvalidNumberCount = numberPreviewRows.length - parsedValidNumberCount;

  const confirmSummary = useMemo(() => {
    if (!draft) return '';
    const numberPart =
      draft.gameType === '4D' ? `${parsedValidNumberCount} numbers` : `${parsedValidNumberCount} sets`;
    const drawDatesPart = `${draft.drawDateOptions.length} draw dates`;
    if (draft.gameType !== '4D') return `${numberPart} | ${drawDatesPart}`;
    const total = Number.parseFloat(draft.totalPrice);
    const totalPart = Number.isFinite(total) ? `$${total.toFixed(2)}` : '$0.00';
    return `${numberPart} | ${drawDatesPart} | ${totalPart}`;
  }, [draft, parsedValidNumberCount]);

  useFocusEffect(
    useCallback(() => {
      getNickname().then((n) => setNickname(n ?? ''));
    }, []),
  );

  function clearImageState() {
    setUploadState('idle');
    setUploadMsg('');
    setDraft(null);
    setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
    setFieldErrors({});
    setFieldTouched({});
  }

  function markFieldTouched(field: ReviewField) {
    setFieldTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function clearFieldError(field: ReviewField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateDraft(updater: (prev: OcrDraft) => OcrDraft) {
    setDraft((prev) => (prev ? updater(prev) : prev));
  }

  function reset() {
    setSelectedUri(null);
    clearImageState();
  }

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
      clearImageState();
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
      clearImageState();
    }
  }

  async function handleUpload() {
    if (!selectedUri) return;
    setUploadState('uploading');
    setUploadMsg('Uploading and reading ticket...');
    try {
      const response = await uploadTicket(selectedUri);
      const nextDraft = toDraft(response);
      setDraft(nextDraft);
      setDraftConfidence(buildDraftConfidence(response, nextDraft));
      setFieldErrors({});
      setFieldTouched({});
      setUploadState('review');
      setUploadMsg(
        nextDraft.numbersText.trim()
          ? 'OCR complete. Review and confirm before continuing.'
          : 'OCR could not detect numbers clearly. Fill in details manually and confirm.',
      );
      Toast.show({ type: 'info', text1: 'OCR complete. Please review ticket details.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState('error');
      setUploadMsg(msg);
      Toast.show({ type: 'error', text1: 'Upload failed. Please try again.' });
    }
  }

  async function handleConfirm() {
    if (!draft || !selectedUri) return;
    const nextErrors: FieldErrors = {};

    const drawDates = draft.drawDateOptions.filter(Boolean);
    if (drawDates.length === 0) nextErrors.drawDates = 'Add at least one draw date.';

    const purchaseDatetime = draft.purchaseDatetime.trim().toUpperCase();
    if (purchaseDatetime && !/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+(AM|PM)$/.test(purchaseDatetime)) {
      nextErrors.purchaseDatetime = 'Use DD/MM/YYYY HH:MM AM/PM.';
    }

    const normalizedBetType = normalizeBetType(draft.gameType, draft.betType);
    if (!getBetTypeOptions(draft.gameType).includes(normalizedBetType)) {
      nextErrors.betType = 'Select a valid bet type.';
    }

    const parsedRows = parseNumbersForSubmit(draft.numbersText, draft.gameType);
    let submitNumbers: string[][] = [];
    if (parsedRows.length === 0) {
      nextErrors.numbersText = 'Please enter at least one number set.';
    } else if (draft.gameType === '4D') {
      const invalidRows = parsedRows.filter((row) => !/^\d{4}$/.test(row[0] ?? ''));
      if (invalidRows.length > 0) {
        nextErrors.numbersText = 'Every 4D row must be exactly 4 digits.';
      } else {
        submitNumbers = parsedRows;
      }
    } else {
      const badRow = parsedRows.find((row) => row.length < 6 || row.length > 12);
      if (badRow) {
        nextErrors.numbersText = 'Each TOTO set must contain 6 to 12 numbers.';
      } else {
        if (normalizedBetType === 'ORDINARY') {
          const mismatchRow = parsedRows.find((row) => row.length !== 6);
          if (mismatchRow) nextErrors.betType = 'ORDINARY requires exactly 6 numbers per set.';
        } else {
          const systemMatch = /^SYSTEM_(\d+)$/.exec(normalizedBetType);
          if (systemMatch) {
            const expected = Number.parseInt(systemMatch[1], 10);
            const mismatchRow = parsedRows.find((row) => row.length !== expected);
            if (mismatchRow) {
              nextErrors.betType = `${formatBetTypeLabel(normalizedBetType)} requires exactly ${expected} numbers per set.`;
            }
          }
        }
        submitNumbers = parsedRows;
      }
    }

    if (draft.gameType === '4D') {
      const decimalPattern = /^\d+(\.\d{1,2})?$/;
      if (draft.bigAmount.trim() && !decimalPattern.test(draft.bigAmount.trim())) {
        nextErrors.bigAmount = 'Use numeric value with up to 2 decimal places.';
      }
      if (draft.smallAmount.trim() && !decimalPattern.test(draft.smallAmount.trim())) {
        nextErrors.smallAmount = 'Use numeric value with up to 2 decimal places.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      Toast.show({ type: 'error', text1: 'Please fix highlighted fields before confirming.' });
      return;
    }

    setFieldErrors({});
    setUploadState('confirming');
    setUploadMsg('Confirming ticket and starting result checks...');

    try {
      const drawNumbers = draft.drawNumberOptions.slice(0, drawDates.length);
      const response = await confirmTicket(selectedUri, {
        game_type: draft.gameType,
        draw_dates: drawDates,
        draw_numbers: drawNumbers.length > 0 ? drawNumbers : null,
        purchase_datetime: purchaseDatetime || null,
        bet_type: normalizedBetType,
        numbers: submitNumbers,
        big_amount: draft.gameType === '4D' ? draft.bigAmount.trim() || null : null,
        small_amount: draft.gameType === '4D' ? draft.smallAmount.trim() || null : null,
        raw_ocr_text: draft.rawText || null,
      });

      const msg =
        `${response.created_count} ticket entries created. ` +
        `${response.won_count} won, ${response.lost_count} lost, ${response.pending_count} pending.`;
      setDraft(null);
      setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
      setFieldErrors({});
      setFieldTouched({});
      setSelectedUri(null);
      setUploadState('done');
      setUploadMsg(msg);
      Toast.show({ type: 'success', text1: 'Ticket confirmed.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setUploadState('error');
      setUploadMsg(msg);
      Toast.show({ type: 'error', text1: 'Could not confirm ticket.' });
    }
  }

  const isUploading = uploadState === 'uploading' || uploadState === 'confirming';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{nickname ? `Hi, ${nickname} 👋` : 'Welcome 👋'}</Text>
        <Text style={styles.subheading}>Scan your lottery ticket to start tracking results.</Text>
      </View>

      {!selectedUri && <UploadZone onCamera={pickFromCamera} onGallery={pickFromGallery} />}

      {selectedUri && uploadState !== 'review' && (
        <ImagePreviewBar
          uri={selectedUri}
          isUploading={isUploading}
          uploadMsg={uploadMsg}
          onCamera={pickFromCamera}
          onGallery={pickFromGallery}
          onClear={reset}
          onUpload={handleUpload}
        />
      )}

      {uploadState === 'review' && draft && (
        <ReviewForm
          draft={draft}
          draftConfidence={draftConfidence}
          fieldErrors={fieldErrors}
          fieldTouched={fieldTouched}
          numberPreviewRows={numberPreviewRows}
          parsedInvalidNumberCount={parsedInvalidNumberCount}
          confirmSummary={confirmSummary}
          isConfirming={false}
          onUpdateDraft={updateDraft}
          onMarkFieldTouched={markFieldTouched}
          onClearFieldError={clearFieldError}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}

      {uploadState === 'done' && (
        <View style={[styles.statusBox, styles.statusSuccess]}>
          <Text style={styles.statusIcon}>✅</Text>
          <Text style={styles.statusSuccessTitle}>Ticket Saved!</Text>
          <Text style={styles.statusText}>{uploadMsg}</Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Upload Another Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploadState === 'error' && (
        <View style={[styles.statusBox, styles.statusError]}>
          <Text style={styles.statusIcon}>⚠️</Text>
          <Text style={styles.statusText}>{uploadMsg}</Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  contentWide: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: { marginBottom: Spacing.lg },
  greeting: { fontSize: Typography.xl, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subheading: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: 22 },

  statusBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusSuccess: { backgroundColor: Colors.successBg },
  statusError: { backgroundColor: Colors.errorBg },
  statusIcon: { fontSize: 36 },
  statusSuccessTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.success },
  statusText: { fontSize: Typography.sm, color: Colors.text, textAlign: 'center', lineHeight: 20 },
  newUploadBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  newUploadBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },
});
