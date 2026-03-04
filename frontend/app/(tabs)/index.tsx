import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import {
  confirmTicket,
  uploadTicket,
  type TicketPreviewResponse,
} from '../../services/api';
import { getNickname } from '../../utils/deviceId';

type UploadState = 'idle' | 'uploading' | 'review' | 'confirming' | 'done' | 'error';
type GameType = '4D' | 'TOTO';

type OcrDraft = {
  gameType: GameType;
  drawDateOptions: string[];
  purchaseDatetime: string;
  betType: string;
  numbersText: string;
  bigAmount: string;
  smallAmount: string;
  totalPrice: string;
  rawText: string;
};

type ReviewField =
  | 'gameType'
  | 'betType'
  | 'purchaseDatetime'
  | 'numbersText'
  | 'drawDates'
  | 'bigAmount'
  | 'smallAmount';

type FieldConfidence = 'auto' | 'uncertain';
type DraftConfidence = Record<ReviewField, FieldConfidence>;
type FieldErrors = Partial<Record<ReviewField, string>>;
type FieldTouched = Partial<Record<ReviewField, boolean>>;

const BET_TYPES_4D = ['ORDINARY', 'IBET'] as const;
const BET_TYPES_TOTO = [
  'STANDARD',
  'SYSTEM_7',
  'SYSTEM_8',
  'SYSTEM_9',
  'SYSTEM_10',
  'SYSTEM_11',
  'SYSTEM_12',
] as const;

const EMPTY_DRAFT_CONFIDENCE: DraftConfidence = {
  gameType: 'uncertain',
  betType: 'uncertain',
  purchaseDatetime: 'uncertain',
  numbersText: 'uncertain',
  drawDates: 'uncertain',
  bigAmount: 'uncertain',
  smallAmount: 'uncertain',
};

function todayDmy(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeDateForEditor(raw: string | null): string {
  if (!raw) return todayDmy();
  const trimmed = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const dmy2Match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (dmy2Match) {
    return `${dmy2Match[1]}/${dmy2Match[2]}/20${dmy2Match[3]}`;
  }
  return todayDmy();
}

function nowDmyHmAmPm(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const hour24 = now.getHours();
  const minute = String(now.getMinutes()).padStart(2, '0');
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${dd}/${mm}/${yyyy} ${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
}

function normalizeDateTimeForEditor(raw: string | null | undefined): string {
  if (!raw) return nowDmyHmAmPm();
  const trimmed = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+(AM|PM)$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const isoLike = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (isoLike) {
    const year = isoLike[1];
    const month = isoLike[2];
    const day = isoLike[3];
    const hour24 = Number.parseInt(isoLike[4], 10);
    const minute = isoLike[5];
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${day}/${month}/${year} ${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
  }
  return nowDmyHmAmPm();
}

function formatDateTimeForEditor(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, '0');
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${dd}/${mm}/${yyyy} ${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
}

function parseEditorDateTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const token = raw.trim().toUpperCase();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+(AM|PM)$/.exec(token);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const year = Number.parseInt(match[3], 10);
  let hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const ampm = match[6];

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = new Date(year, month, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatNumbersForEditor(numbers: unknown, gameType: GameType): string {
  if (!Array.isArray(numbers)) return '';

  if (gameType === '4D') {
    const tokens: string[] = [];
    for (const row of numbers) {
      if (!Array.isArray(row)) continue;
      for (const value of row) {
        const token = String(value).trim();
        if (token) tokens.push(token);
      }
    }
    return tokens.join('\n');
  }

  const lines: string[] = [];
  for (const row of numbers) {
    if (!Array.isArray(row)) continue;
    const line = row.map((v) => String(v).trim()).filter(Boolean).join(' ');
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

function parseNumbersForSubmit(text: string, gameType: GameType): string[][] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (gameType === '4D') {
    const output: string[][] = [];
    for (const line of lines) {
      const token = line.replace(/[^0-9]/g, '');
      if (token) output.push([token]);
    }
    return output;
  }

  const output: string[][] = [];
  for (const line of lines) {
    const tokens = line
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) output.push(tokens);
  }
  return output;
}

function getBetTypeOptions(gameType: GameType): readonly string[] {
  return gameType === '4D' ? BET_TYPES_4D : BET_TYPES_TOTO;
}

function normalizeBetType(gameType: GameType, betTypeRaw: string): string {
  const token = betTypeRaw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!token) return gameType === '4D' ? 'ORDINARY' : 'STANDARD';
  if (gameType === '4D') {
    return token === 'IBET' || token === 'I_BET' ? 'IBET' : 'ORDINARY';
  }
  if (token === 'STANDARD') return 'STANDARD';
  const match = /^SYSTEM_?([7-9]|1[0-2])$/.exec(token);
  if (match) return `SYSTEM_${match[1]}`;
  return 'STANDARD';
}

function hasContent(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function buildDraftConfidence(response: TicketPreviewResponse, draft: OcrDraft): DraftConfidence {
  const hasDrawDates = (response.draw_date_options ?? []).some((d) => hasContent(d))
    || hasContent(response.draw_date);

  return {
    gameType: hasContent(response.game_type) ? 'auto' : 'uncertain',
    betType: hasContent(response.bet_type) ? 'auto' : 'uncertain',
    purchaseDatetime: hasContent(response.purchase_datetime) ? 'auto' : 'uncertain',
    numbersText: draft.numbersText.trim() ? 'auto' : 'uncertain',
    drawDates: hasDrawDates ? 'auto' : 'uncertain',
    bigAmount: hasContent(response.big_amount) ? 'auto' : 'uncertain',
    smallAmount: hasContent(response.small_amount) ? 'auto' : 'uncertain',
  };
}

function toDraft(response: TicketPreviewResponse): OcrDraft {
  const gameType: GameType = response.game_type === 'TOTO' ? 'TOTO' : '4D';
  const big = response.big_amount ?? '0.00';
  const small = response.small_amount ?? '1.00';
  const fallbackTotal = (Number.parseFloat(big) || 0) + (Number.parseFloat(small) || 0);
  const drawOptionsRaw = response.draw_date_options ?? [];
  const normalizedOptions = drawOptionsRaw.map((d) => normalizeDateForEditor(d));
  const uniqueDrawOptions = Array.from(new Set(normalizedOptions.filter(Boolean)));
  const primaryDrawDate = normalizeDateForEditor(response.draw_date);
  const drawDates = uniqueDrawOptions.length > 0 ? uniqueDrawOptions : [primaryDrawDate];
  return {
    gameType,
    drawDateOptions: drawDates,
    purchaseDatetime: normalizeDateTimeForEditor(response.purchase_datetime),
    betType: normalizeBetType(gameType, response.bet_type ?? ''),
    numbersText: formatNumbersForEditor(response.numbers, gameType),
    bigAmount: big,
    smallAmount: small,
    totalPrice: response.total_price ?? fallbackTotal.toFixed(2),
    rawText: response.raw_ocr_text ?? '',
  };
}

export default function UploadScreen() {
  const { showToast } = useToast();
  const [nickname, setNickname] = useState('');
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMsg, setUploadMsg] = useState('');
  const [draft, setDraft] = useState<OcrDraft | null>(null);
  const [draftConfidence, setDraftConfidence] = useState<DraftConfidence>(EMPTY_DRAFT_CONFIDENCE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldTouched, setFieldTouched] = useState<FieldTouched>({});
  const [isRawExpanded, setIsRawExpanded] = useState(false);
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
          } else if (normalizedBetType === 'STANDARD') {
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
  const parsedValidNumberCount = numberPreviewRows.filter((row) => row.isValid).length;
  const parsedInvalidNumberCount = numberPreviewRows.length - parsedValidNumberCount;
  const confirmSummary = useMemo(() => {
    if (!draft) return '';
    const numberPart = draft.gameType === '4D'
      ? `${parsedValidNumberCount} numbers`
      : `${parsedValidNumberCount} sets`;
    const drawDatesPart = `${draft.drawDateOptions.length} draw dates`;
    if (draft.gameType !== '4D') return `${numberPart} | ${drawDatesPart}`;
    const total = Number.parseFloat(draft.totalPrice);
    const totalPart = Number.isFinite(total) ? `$${total.toFixed(2)}` : '$0.00';
    return `${numberPart} | ${drawDatesPart} | ${totalPart}`;
  }, [draft, parsedValidNumberCount]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());
  const [showPurchasePicker, setShowPurchasePicker] = useState(false);
  const [purchasePickerValue, setPurchasePickerValue] = useState(new Date());
  const [androidPurchaseMode, setAndroidPurchaseMode] = useState<'date' | 'time'>('date');

  function clearFieldError(field: ReviewField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function markFieldTouched(field: ReviewField) {
    setFieldTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  function getFieldSignal(field: ReviewField): {
    showAuto: boolean;
    showNeedsReview: boolean;
    error?: string;
  } {
    const touched = Boolean(fieldTouched[field]);
    const confidence = draftConfidence[field];
    return {
      showAuto: confidence === 'auto' && !touched,
      showNeedsReview: confidence === 'uncertain' && !touched,
      error: fieldErrors[field],
    };
  }


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
      setUploadMsg('');
      setDraft(null);
      setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
      setFieldErrors({});
      setFieldTouched({});
      setIsRawExpanded(false);
      setShowDatePicker(false);
      setShowPurchasePicker(false);
      setAndroidPurchaseMode('date');
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
      setUploadMsg('');
      setDraft(null);
      setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
      setFieldErrors({});
      setFieldTouched({});
      setIsRawExpanded(false);
      setShowDatePicker(false);
      setShowPurchasePicker(false);
      setAndroidPurchaseMode('date');
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
      setIsRawExpanded(false);
      setUploadState('review');

      if (nextDraft.numbersText.trim()) {
        setUploadMsg('OCR complete. Review and confirm before continuing.');
      } else {
        setUploadMsg('OCR could not detect numbers clearly. Fill in details manually and confirm.');
      }

      showToast('OCR complete. Please review ticket details.', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState('error');
      setUploadMsg(msg);
      showToast('Upload failed. Please try again.', 'error');
    }
  }

  async function handleConfirm() {
    if (!draft || !selectedUri) return;
    const nextErrors: FieldErrors = {};

    const drawDates = draft.drawDateOptions.filter(Boolean);
    if (drawDates.length === 0) {
      nextErrors.drawDates = 'Add at least one draw date.';
    }

    const purchaseDatetime = draft.purchaseDatetime.trim().toUpperCase();
    if (
      purchaseDatetime
      && !/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+(AM|PM)$/.test(purchaseDatetime)
    ) {
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
        if (normalizedBetType === 'STANDARD') {
          const mismatchRow = parsedRows.find((row) => row.length !== 6);
          if (mismatchRow) {
            nextErrors.betType = 'STANDARD requires exactly 6 numbers per set.';
          }
        } else {
          const systemMatch = /^SYSTEM_(\d+)$/.exec(normalizedBetType);
          if (systemMatch) {
            const expected = Number.parseInt(systemMatch[1], 10);
            const mismatchRow = parsedRows.find((row) => row.length !== expected);
            if (mismatchRow) {
              nextErrors.betType = `${normalizedBetType} requires exactly ${expected} numbers per set.`;
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
      showToast('Please fix highlighted fields before confirming.', 'error');
      return;
    }

    setFieldErrors({});

    setUploadState('confirming');
    setUploadMsg('Confirming ticket and starting result checks...');

    try {
      const response = await confirmTicket(selectedUri, {
        game_type: draft.gameType,
        draw_dates: drawDates,
        purchase_datetime: purchaseDatetime || null,
        bet_type: normalizedBetType,
        numbers: submitNumbers,
        big_amount: draft.gameType === '4D' ? draft.bigAmount.trim() || null : null,
        small_amount: draft.gameType === '4D' ? draft.smallAmount.trim() || null : null,
        raw_ocr_text: draft.rawText || null,
      });

      setDraft(null);
      setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
      setFieldErrors({});
      setFieldTouched({});
      setIsRawExpanded(false);
      setShowDatePicker(false);
      setShowPurchasePicker(false);
      setAndroidPurchaseMode('date');
      setSelectedUri(null);
      setUploadState('done');
      setUploadMsg(
        `${response.created_count} ticket entries created. `
        + `${response.won_count} won, ${response.lost_count} lost, ${response.pending_count} pending.`
      );

      showToast('Ticket confirmed.', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setUploadState('error');
      setUploadMsg(msg);
      showToast('Could not confirm ticket.', 'error');
    }
  }

  function openDatePicker() {
    setPickerValue(new Date());
    setShowDatePicker(true);
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const dd = String(selected.getDate()).padStart(2, '0');
    const mm = String(selected.getMonth() + 1).padStart(2, '0');
    const yyyy = String(selected.getFullYear());
    const dateStr = `${dd}/${mm}/${yyyy}`;
    if (Platform.OS === 'ios') setShowDatePicker(false);
    if (draft?.drawDateOptions.includes(dateStr)) {
      showToast(`${dateStr} is already in the list.`, 'info');
      return;
    }
    markFieldTouched('drawDates');
    clearFieldError('drawDates');
    setDraft((prev) => prev ? { ...prev, drawDateOptions: [...prev.drawDateOptions, dateStr] } : prev);
  }

  function openPurchasePicker() {
    const current = parseEditorDateTime(draft?.purchaseDatetime);
    setPurchasePickerValue(current ?? new Date());
    setAndroidPurchaseMode('date');
    setShowPurchasePicker(true);
  }

  function applyPurchaseDateTime(next: Date) {
    markFieldTouched('purchaseDatetime');
    clearFieldError('purchaseDatetime');
    const formatted = formatDateTimeForEditor(next);
    setDraft((prev) => (prev ? { ...prev, purchaseDatetime: formatted } : prev));
  }

  function onPurchaseDateTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (!selected) {
      if (event.type === 'dismissed' && Platform.OS === 'android') {
        setShowPurchasePicker(false);
        setAndroidPurchaseMode('date');
      }
      return;
    }

    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowPurchasePicker(false);
        setAndroidPurchaseMode('date');
        return;
      }

      if (androidPurchaseMode === 'date') {
        const next = new Date(purchasePickerValue);
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        setPurchasePickerValue(next);
        setAndroidPurchaseMode('time');
        return;
      }

      const next = new Date(purchasePickerValue);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setPurchasePickerValue(next);
      applyPurchaseDateTime(next);
      setAndroidPurchaseMode('date');
      setShowPurchasePicker(false);
      return;
    }

    setPurchasePickerValue(selected);
  }

  function confirmPurchasePickerIOS() {
    applyPurchaseDateTime(purchasePickerValue);
    setShowPurchasePicker(false);
  }

  function reset() {
    setSelectedUri(null);
    setUploadState('idle');
    setUploadMsg('');
    setDraft(null);
    setDraftConfidence(EMPTY_DRAFT_CONFIDENCE);
    setFieldErrors({});
    setFieldTouched({});
    setIsRawExpanded(false);
    setShowDatePicker(false);
    setShowPurchasePicker(false);
    setAndroidPurchaseMode('date');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {nickname ? `Welcome back, ${nickname}!` : 'Welcome!'}
        </Text>
        <Text style={styles.subheading}>
          Upload your ticket, review detected details, then confirm to continue.
        </Text>
      </View>

      {selectedUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedUri }} style={styles.preview} resizeMode="contain" />
          <TouchableOpacity style={styles.clearBtn} onPress={reset}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No ticket selected</Text>
        </View>
      )}

      <View style={styles.pickerRow}>
        <TouchableOpacity style={[styles.pickBtn, styles.cameraBtn]} onPress={pickFromCamera}>
          <Text style={styles.pickBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, styles.galleryBtn]} onPress={pickFromGallery}>
          <Text style={styles.pickBtnText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {selectedUri && uploadState === 'idle' && (
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
          <Text style={styles.uploadBtnText}>Upload and Read Ticket</Text>
        </TouchableOpacity>
      )}

      {(uploadState === 'uploading' || uploadState === 'confirming') && (
        <View style={styles.statusBox}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.statusText}>{uploadMsg}</Text>
        </View>
      )}

      {uploadState === 'review' && draft && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Review OCR Output</Text>
          <Text style={styles.reviewHint}>Edit any field before confirming.</Text>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Ticket Identity</Text>

            <Text style={styles.inputLabel}>Game Type</Text>
            <View style={[styles.gameRow, getFieldSignal('gameType').showNeedsReview && styles.fieldNeedsReview]}>
              {(['4D', 'TOTO'] as const).map((gt) => (
                <TouchableOpacity
                  key={gt}
                  style={[styles.gameBtn, draft.gameType === gt && styles.gameBtnActive]}
                  onPress={() => {
                    markFieldTouched('gameType');
                    markFieldTouched('betType');
                    clearFieldError('gameType');
                    clearFieldError('betType');
                    setDraft((prev) => (prev ? {
                      ...prev,
                      gameType: gt,
                      betType: normalizeBetType(gt, prev.betType),
                    } : prev));
                  }}
                >
                  <Text style={[styles.gameBtnText, draft.gameType === gt && styles.gameBtnTextActive]}>
                    {gt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {getFieldSignal('gameType').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
            {getFieldSignal('gameType').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
            {getFieldSignal('gameType').error && (
              <Text style={styles.fieldErrorText}>{getFieldSignal('gameType').error}</Text>
            )}

            <Text style={styles.inputLabel}>Bet Type</Text>
            <View
              style={[
                styles.optionRow,
                getFieldSignal('betType').showNeedsReview && styles.fieldNeedsReview,
                getFieldSignal('betType').error && styles.fieldErrorBorder,
              ]}
            >
              {getBetTypeOptions(draft.gameType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.optionBtn, draft.betType === type && styles.optionBtnActive]}
                  onPress={() => {
                    markFieldTouched('betType');
                    clearFieldError('betType');
                    setDraft((prev) => (prev ? { ...prev, betType: type } : prev));
                  }}
                >
                  <Text style={[styles.optionBtnText, draft.betType === type && styles.optionBtnTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {getFieldSignal('betType').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
            {getFieldSignal('betType').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
            {getFieldSignal('betType').error && (
              <Text style={styles.fieldErrorText}>{getFieldSignal('betType').error}</Text>
            )}

            <Text style={styles.inputLabel}>Purchase Date &amp; Time</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateTimeBtn,
                getFieldSignal('purchaseDatetime').showNeedsReview && styles.fieldNeedsReview,
                getFieldSignal('purchaseDatetime').error && styles.fieldErrorBorder,
              ]}
              onPress={openPurchasePicker}
            >
              <Text style={styles.dateTimeBtnText}>{draft.purchaseDatetime}</Text>
              <Text style={styles.dateTimeBtnAction}>Change</Text>
            </TouchableOpacity>
            {getFieldSignal('purchaseDatetime').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
            {getFieldSignal('purchaseDatetime').showNeedsReview && (
              <Text style={styles.fieldMetaWarn}>Needs review</Text>
            )}
            {getFieldSignal('purchaseDatetime').error && (
              <Text style={styles.fieldErrorText}>{getFieldSignal('purchaseDatetime').error}</Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Your Numbers</Text>
            <Text style={styles.inputLabel}>
              Numbers ({draft.gameType === '4D' ? 'one 4-digit number per line' : 'one set per line, space-separated'})
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.numbersInput,
                getFieldSignal('numbersText').showNeedsReview && styles.fieldNeedsReview,
                getFieldSignal('numbersText').error && styles.fieldErrorBorder,
              ]}
              value={draft.numbersText}
              onChangeText={(text) => {
                markFieldTouched('numbersText');
                clearFieldError('numbersText');
                setDraft((prev) => (prev ? { ...prev, numbersText: text } : prev));
              }}
              multiline
              autoCapitalize="none"
              placeholder={draft.gameType === '4D' ? '1234\n5678' : '1 7 12 23 34 45\n2 8 14 21 33 47'}
              placeholderTextColor={Colors.textSecondary}
            />
            {numberPreviewRows.length > 0 && (
              <View style={styles.dateChipsContainer}>
                {numberPreviewRows.map((row) => (
                  <View key={row.key} style={[styles.dateChip, !row.isValid && styles.previewChipInvalid]}>
                    <Text style={styles.dateChipText}>{row.text}</Text>
                  </View>
                ))}
              </View>
            )}
            {parsedInvalidNumberCount > 0 && (
              <Text style={styles.fieldErrorText}>
                {draft.gameType === '4D'
                  ? 'Invalid rows detected: use exactly 4 digits per line.'
                  : (() => {
                    const betType = normalizeBetType(draft.gameType, draft.betType);
                    if (betType === 'STANDARD') {
                      return 'Invalid rows detected: STANDARD needs exactly 6 numbers per set.';
                    }
                    const systemMatch = /^SYSTEM_(\d+)$/.exec(betType);
                    if (systemMatch) {
                      return `Invalid rows detected: ${betType} needs exactly ${systemMatch[1]} numbers per set.`;
                    }
                    return 'Invalid rows detected: each set needs 6 to 12 numbers.';
                  })()}
              </Text>
            )}
            {getFieldSignal('numbersText').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
            {getFieldSignal('numbersText').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
            {getFieldSignal('numbersText').error && (
              <Text style={styles.fieldErrorText}>{getFieldSignal('numbersText').error}</Text>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Draw Info</Text>

            <Text style={styles.inputLabel}>Draw Dates</Text>
            <View
              style={[
                styles.dateChipsContainer,
                getFieldSignal('drawDates').showNeedsReview && styles.fieldNeedsReview,
                getFieldSignal('drawDates').error && styles.fieldErrorBorder,
              ]}
            >
              {draft.drawDateOptions.map((opt) => (
                <View key={opt} style={styles.dateChip}>
                  <Text style={styles.dateChipText}>{opt}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      markFieldTouched('drawDates');
                      clearFieldError('drawDates');
                      setDraft((prev) =>
                        prev
                          ? { ...prev, drawDateOptions: prev.drawDateOptions.filter((d) => d !== opt) }
                          : prev,
                      );
                    }}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={styles.dateChipRemove}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addDateBtn} onPress={openDatePicker}>
                <Text style={styles.addDateBtnText}>+ Add Date</Text>
              </TouchableOpacity>
            </View>
            {getFieldSignal('drawDates').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
            {getFieldSignal('drawDates').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
            {getFieldSignal('drawDates').error && (
              <Text style={styles.fieldErrorText}>{getFieldSignal('drawDates').error}</Text>
            )}
          </View>

          {draft.gameType === '4D' && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Money</Text>
              <View style={styles.amountRow}>
                <View style={styles.amountCol}>
                  <Text style={styles.inputLabel}>Big ($)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      getFieldSignal('bigAmount').showNeedsReview && styles.fieldNeedsReview,
                      getFieldSignal('bigAmount').error && styles.fieldErrorBorder,
                    ]}
                    value={draft.bigAmount}
                    onChangeText={(text) => {
                      markFieldTouched('bigAmount');
                      clearFieldError('bigAmount');
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const total = ((Number.parseFloat(text) || 0) + (Number.parseFloat(prev.smallAmount) || 0)).toFixed(2);
                        return { ...prev, bigAmount: text, totalPrice: total };
                      });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  {getFieldSignal('bigAmount').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
                  {getFieldSignal('bigAmount').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
                  {getFieldSignal('bigAmount').error && (
                    <Text style={styles.fieldErrorText}>{getFieldSignal('bigAmount').error}</Text>
                  )}
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.inputLabel}>Small ($)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      getFieldSignal('smallAmount').showNeedsReview && styles.fieldNeedsReview,
                      getFieldSignal('smallAmount').error && styles.fieldErrorBorder,
                    ]}
                    value={draft.smallAmount}
                    onChangeText={(text) => {
                      markFieldTouched('smallAmount');
                      clearFieldError('smallAmount');
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const total = ((Number.parseFloat(prev.bigAmount) || 0) + (Number.parseFloat(text) || 0)).toFixed(2);
                        return { ...prev, smallAmount: text, totalPrice: total };
                      });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="1.00"
                    placeholderTextColor={Colors.textSecondary}
                  />
                  {getFieldSignal('smallAmount').showAuto && <Text style={styles.fieldMetaAuto}>Auto-detected</Text>}
                  {getFieldSignal('smallAmount').showNeedsReview && <Text style={styles.fieldMetaWarn}>Needs review</Text>}
                  {getFieldSignal('smallAmount').error && (
                    <Text style={styles.fieldErrorText}>{getFieldSignal('smallAmount').error}</Text>
                  )}
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.inputLabel}>Price ($)</Text>
                  <View style={[styles.input, styles.totalInline]}>
                    <Text style={styles.totalInlineText}>{draft.totalPrice}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Reference</Text>
            {draft.rawText ? (
              <View style={styles.rawBox}>
                <Text style={styles.rawTitle}>OCR Raw Text</Text>
                <Text style={styles.rawText} numberOfLines={isRawExpanded ? undefined : 4}>
                  {draft.rawText}
                </Text>
                {(draft.rawText.length > 200 || draft.rawText.split('\n').length > 4) && (
                  <TouchableOpacity onPress={() => setIsRawExpanded((prev) => !prev)}>
                    <Text style={styles.rawToggleText}>{isRawExpanded ? 'Show less' : 'Show more'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.mappingEmpty}>OCR raw text unavailable.</Text>
            )}
          </View>

          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm and Continue</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.confirmSummary}>{confirmSummary}</Text>
        </View>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerBox}>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={(_, d) => d && setPickerValue(d)}
              />
              <TouchableOpacity
                style={styles.pickerDoneBtn}
                onPress={() => onDateChange({ type: 'set', nativeEvent: { timestamp: pickerValue.getTime() } } as DateTimePickerEvent, pickerValue)}
              >
                <Text style={styles.pickerDoneBtnText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.pickerCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {showPurchasePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerBox}>
              <DateTimePicker
                value={purchasePickerValue}
                mode="datetime"
                display="spinner"
                onChange={onPurchaseDateTimeChange}
              />
              <TouchableOpacity
                style={styles.pickerDoneBtn}
                onPress={confirmPurchasePickerIOS}
              >
                <Text style={styles.pickerDoneBtnText}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => setShowPurchasePicker(false)}
              >
                <Text style={styles.pickerCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {showPurchasePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={purchasePickerValue}
          mode={androidPurchaseMode}
          display="default"
          onChange={onPurchaseDateTimeChange}
        />
      )}
      {uploadState === 'done' && (
        <View style={[styles.statusBox, styles.statusInfo]}>
          <Text style={styles.statusText}>{uploadMsg}</Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Upload Another Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploadState === 'error' && (
        <View style={[styles.statusBox, styles.statusError]}>
          <Text style={styles.statusText}>{uploadMsg}</Text>
          <TouchableOpacity style={styles.newUploadBtn} onPress={reset}>
            <Text style={styles.newUploadBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploadState === 'idle' && !selectedUri && (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How it works</Text>
          {[
            '1. Capture or choose a clear ticket image',
            '2. OCR extracts game type, draw date, and numbers',
            '3. Review, edit, and confirm before checks start',
          ].map((step) => (
            <Text key={step} style={styles.instructionStep}>{step}</Text>
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
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  reviewTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewHint: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sectionBlock: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  gameRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gameBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  gameBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gameBtnText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  gameBtnTextActive: {
    color: '#fff',
  },
  inputLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  fieldMetaAuto: {
    fontSize: Typography.xs,
    color: Colors.info,
    fontWeight: '600',
  },
  fieldMetaWarn: {
    fontSize: Typography.xs,
    color: Colors.warning,
    fontWeight: '600',
  },
  fieldErrorText: {
    fontSize: Typography.xs,
    color: Colors.error,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: Typography.base,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  fieldNeedsReview: {
    borderColor: Colors.warning,
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  fieldErrorBorder: {
    borderColor: Colors.error,
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceAlt,
  },
  optionBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  optionBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  optionBtnTextActive: {
    color: '#fff',
  },
  dateTimeBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimeBtnText: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: '600',
  },
  dateTimeBtnAction: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  dateChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  previewChipInvalid: {
    backgroundColor: Colors.error,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  dateChipText: {
    fontSize: Typography.sm,
    color: '#fff',
    fontWeight: '700',
  },
  dateChipRemove: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    fontWeight: '400',
  },
  addDateBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addDateBtnText: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: 32,
    paddingTop: 8,
    paddingHorizontal: Spacing.md,
  },
  pickerDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  pickerDoneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.base,
  },
  pickerCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  pickerCancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: Typography.base,
  },
  mappingEmpty: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  fieldHint: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  numbersInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  amountCol: {
    flex: 1,
  },
  rawBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  totalInline: {
    justifyContent: 'center',
  },
  totalInlineText: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: '700',
    paddingVertical: 2,
  },
  rawTitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  rawText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rawToggleText: {
    fontSize: Typography.xs,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 8,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  confirmSummary: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
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

