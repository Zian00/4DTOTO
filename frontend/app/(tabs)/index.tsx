import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useToast } from '../../hooks/useToast';
import {
  confirmTicket,
  getApiBaseUrl,
  uploadTicket,
  type TicketPreviewResponse,
} from '../../services/api';
import { getNickname } from '../../utils/deviceId';

type UploadState = 'idle' | 'uploading' | 'review' | 'confirming' | 'done' | 'error';
type GameType = '4D' | 'TOTO';

type OcrDraft = {
  gameType: GameType;
  drawDatesText: string;
  drawDateOptions: string[];
  drawNumbersText: string;
  drawNumberOptions: string[];
  purchaseDatetime: string;
  betType: string;
  numbersText: string;
  bigAmount: string;
  smallAmount: string;
  totalPrice: string;
  rawText: string;
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

function parseDrawDatesForSubmit(text: string): string[] {
  const tokens = text
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const token of tokens) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

function parseDrawNumbersForSubmit(text: string): string[] {
  const tokens = text
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const token of tokens) {
    const match = token.match(/(\d{3,6})(?:\/\d{2,4})?/);
    if (!match) continue;
    out.push(match[1]);
  }
  return out;
}

function toggleDrawDateInText(text: string, value: string): string {
  const current = parseDrawDatesForSubmit(text);
  const exists = current.includes(value);
  const next = exists ? current.filter((d) => d !== value) : [...current, value];
  return next.join('\n');
}

function toggleDrawNumberInText(text: string, value: string): string {
  const current = parseDrawNumbersForSubmit(text);
  const exists = current.includes(value);
  const next = exists ? current.filter((d) => d !== value) : [...current, value];
  return next.join('\n');
}

function buildDateDrawPairs(drawDatesText: string, drawNumbersText: string): Array<{
  drawDate: string;
  drawNumber: string;
}> {
  const drawDates = parseDrawDatesForSubmit(drawDatesText);
  const drawNumbers = parseDrawNumbersForSubmit(drawNumbersText);
  return drawDates.map((drawDate, idx) => ({
    drawDate,
    drawNumber: drawNumbers[idx] ?? '',
  }));
}

function normalizeBetType(gameType: GameType, betTypeRaw: string): string {
  const token = betTypeRaw.trim().toUpperCase();
  if (!token) return gameType === '4D' ? 'ORDINARY' : 'STANDARD';
  if (gameType === '4D') {
    return token === 'IBET' || token === 'I-BET' ? 'IBET' : 'ORDINARY';
  }
  return token;
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
  const drawNumberOptionsRaw = response.draw_number_options ?? [];
  const drawNumberPrimary = response.draw_number ? String(response.draw_number).trim() : '';
  const drawNumbers = Array.from(
    new Set(
      [
        ...drawNumberOptionsRaw.map((v) => String(v).trim()),
        drawNumberPrimary,
      ].filter(Boolean),
    ),
  );
  return {
    gameType,
    drawDatesText: drawDates.join('\n'),
    drawDateOptions: drawDates,
    drawNumbersText: drawNumbers.join('\n'),
    drawNumberOptions: drawNumbers,
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
  const mappingPairs = draft
    ? buildDateDrawPairs(draft.drawDatesText, draft.drawNumbersText)
    : [];

  useEffect(() => {
    if (__DEV__) {
      console.log('[API][base]', getApiBaseUrl());
    }
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
      setUploadMsg('');
      setDraft(null);
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
    }
  }

  async function handleUpload() {
    if (!selectedUri) return;

    setUploadState('uploading');
    setUploadMsg('Uploading and reading ticket...');

    try {
      const response = await uploadTicket(selectedUri);
      if (__DEV__) {
        console.log('[OCR][preview raw]', response.raw_ocr_text ?? '<empty>');
      }
      const nextDraft = toDraft(response);
      setDraft(nextDraft);
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

    const drawDates = parseDrawDatesForSubmit(draft.drawDatesText);
    if (drawDates.length === 0) {
      Alert.alert('Invalid draw dates', 'Enter at least one draw date in DD/MM/YYYY format.');
      return;
    }
    const drawNumbers = parseDrawNumbersForSubmit(draft.drawNumbersText);
    if (drawNumbers.length > drawDates.length) {
      Alert.alert(
        'Invalid draw numbers',
        'Draw numbers cannot exceed the number of draw dates.',
      );
      return;
    }
    const purchaseDatetime = draft.purchaseDatetime.trim().toUpperCase();
    if (
      purchaseDatetime &&
      !/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+(AM|PM)$/.test(purchaseDatetime)
    ) {
      Alert.alert('Invalid purchase date', 'Purchase date must be DD/MM/YYYY HH:MM AM/PM.');
      return;
    }

    const parsedRows = parseNumbersForSubmit(draft.numbersText, draft.gameType);
    if (parsedRows.length === 0) {
      Alert.alert('Missing numbers', 'Please enter at least one number set.');
      return;
    }

    let submitNumbers: string[][] = [];
    if (draft.gameType === '4D') {
      const validRows = parsedRows.filter((row) => /^\d{4}$/.test(row[0] ?? ''));
      if (validRows.length === 0) {
        Alert.alert('Invalid 4D numbers', 'Enter one or more valid 4-digit numbers.');
        return;
      }
      submitNumbers = validRows;
    } else {
      const badRow = parsedRows.find((row) => row.length < 6);
      if (badRow) {
        Alert.alert('Invalid TOTO numbers', 'Each TOTO set must contain at least 6 numbers.');
        return;
      }
      submitNumbers = parsedRows;
    }

    if (draft.gameType === '4D') {
      const decimalPattern = /^\d+(\.\d{1,2})?$/;
      if (draft.bigAmount.trim() && !decimalPattern.test(draft.bigAmount.trim())) {
        Alert.alert('Invalid Big Amount', 'Use numeric value with up to 2 decimal places.');
        return;
      }
      if (draft.smallAmount.trim() && !decimalPattern.test(draft.smallAmount.trim())) {
        Alert.alert('Invalid Small Amount', 'Use numeric value with up to 2 decimal places.');
        return;
      }
    }

    setUploadState('confirming');
    setUploadMsg('Confirming ticket and starting result checks...');

    try {
      if (__DEV__) {
        console.log('[OCR][confirm raw]', draft.rawText || '<empty>');
      }
      const response = await confirmTicket(selectedUri, {
        game_type: draft.gameType,
        draw_dates: drawDates,
        draw_numbers: drawNumbers,
        purchase_datetime: purchaseDatetime || null,
        bet_type: normalizeBetType(draft.gameType, draft.betType),
        numbers: submitNumbers,
        big_amount: draft.gameType === '4D' ? draft.bigAmount.trim() || null : null,
        small_amount: draft.gameType === '4D' ? draft.smallAmount.trim() || null : null,
        raw_ocr_text: draft.rawText || null,
      });

      setDraft(null);
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

  function reset() {
    setSelectedUri(null);
    setUploadState('idle');
    setUploadMsg('');
    setDraft(null);
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

          <View style={styles.gameRow}>
            {(['4D', 'TOTO'] as const).map((gt) => (
              <TouchableOpacity
                key={gt}
                style={[styles.gameBtn, draft.gameType === gt && styles.gameBtnActive]}
                onPress={() => setDraft((prev) => (prev ? { ...prev, gameType: gt } : prev))}
              >
                <Text style={[styles.gameBtnText, draft.gameType === gt && styles.gameBtnTextActive]}>
                  {gt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Draw Dates (DD/MM/YYYY, one per line)</Text>
          <TextInput
            style={[styles.input, styles.drawDatesInput]}
            value={draft.drawDatesText}
            onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, drawDatesText: text } : prev))}
            autoCapitalize="none"
            multiline
            placeholder="03/03/2026\n04/03/2026"
            placeholderTextColor={Colors.textSecondary}
          />
          {draft.drawDateOptions.length > 1 && (
            <View style={styles.dateOptionsRow}>
              {draft.drawDateOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dateOptionBtn,
                    parseDrawDatesForSubmit(draft.drawDatesText).includes(opt)
                      && styles.dateOptionBtnActive,
                  ]}
                  onPress={() => setDraft((prev) => {
                    if (!prev) return prev;
                    return { ...prev, drawDatesText: toggleDrawDateInText(prev.drawDatesText, opt) };
                  })}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      parseDrawDatesForSubmit(draft.drawDatesText).includes(opt)
                        && styles.dateOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.inputLabel}>Draw Numbers (optional, one per line)</Text>
          <TextInput
            style={[styles.input, styles.drawNumbersInput]}
            value={draft.drawNumbersText}
            onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, drawNumbersText: text } : prev))}
            autoCapitalize="none"
            multiline
            placeholder="5447\n5448"
            placeholderTextColor={Colors.textSecondary}
          />
          {draft.drawNumberOptions.length > 1 && (
            <View style={styles.dateOptionsRow}>
              {draft.drawNumberOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dateOptionBtn,
                    parseDrawNumbersForSubmit(draft.drawNumbersText).includes(opt)
                      && styles.dateOptionBtnActive,
                  ]}
                  onPress={() => setDraft((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      drawNumbersText: toggleDrawNumberInText(prev.drawNumbersText, opt),
                    };
                  })}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      parseDrawNumbersForSubmit(draft.drawNumbersText).includes(opt)
                        && styles.dateOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.mappingBox}>
            <Text style={styles.mappingTitle}>Date and Draw Number Mapping</Text>
            {mappingPairs.length > 0 ? (
              mappingPairs.map((pair) => (
                <View key={`${pair.drawDate}-${pair.drawNumber || 'empty'}`} style={styles.mappingRow}>
                  <Text style={styles.mappingDate}>{pair.drawDate}</Text>
                  <Text style={styles.mappingArrow}>{'->'}</Text>
                  <Text style={styles.mappingNumber}>
                    {pair.drawNumber || '(no draw number)'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.mappingEmpty}>
                Add at least one draw date to preview mapping.
              </Text>
            )}
          </View>

          <Text style={styles.inputLabel}>Purchase Date (DD/MM/YYYY HH:MM AM/PM)</Text>
          <TextInput
            style={styles.input}
            value={draft.purchaseDatetime}
            onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, purchaseDatetime: text } : prev))}
            autoCapitalize="characters"
            placeholder="21/02/2026 01:28 PM"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.inputLabel}>Bet Type</Text>
          <TextInput
            style={styles.input}
            value={draft.betType}
            onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, betType: text } : prev))}
            autoCapitalize="none"
            placeholder={draft.gameType === 'TOTO' ? 'STANDARD or SYSTEM_7..SYSTEM_12' : 'ORDINARY or IBET'}
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.inputLabel}>
            Numbers ({draft.gameType === '4D' ? 'one 4-digit number per line' : 'one set per line, space-separated'})
          </Text>
          <TextInput
            style={[styles.input, styles.numbersInput]}
            value={draft.numbersText}
            onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, numbersText: text } : prev))}
            multiline
            autoCapitalize="none"
            placeholder={draft.gameType === '4D' ? '1234\n5678' : '1 7 12 23 34 45\n2 8 14 21 33 47'}
            placeholderTextColor={Colors.textSecondary}
          />

          {draft.gameType === '4D' && (
            <View style={styles.amountRow}>
              <View style={styles.amountCol}>
                <Text style={styles.inputLabel}>Big Amount</Text>
                <TextInput
                  style={styles.input}
                  value={draft.bigAmount}
                  onChangeText={(text) => setDraft((prev) => {
                    if (!prev) return prev;
                    const nextBig = text;
                    const total = ((Number.parseFloat(nextBig) || 0) + (Number.parseFloat(prev.smallAmount) || 0)).toFixed(2);
                    return { ...prev, bigAmount: nextBig, totalPrice: total };
                  })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.inputLabel}>Small Amount</Text>
                <TextInput
                  style={styles.input}
                  value={draft.smallAmount}
                  onChangeText={(text) => setDraft((prev) => {
                    if (!prev) return prev;
                    const nextSmall = text;
                    const total = ((Number.parseFloat(prev.bigAmount) || 0) + (Number.parseFloat(nextSmall) || 0)).toFixed(2);
                    return { ...prev, smallAmount: nextSmall, totalPrice: total };
                  })}
                  keyboardType="decimal-pad"
                  placeholder="1.00"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>
          )}

          <View style={styles.totalPriceBox}>
            <Text style={styles.totalPriceLabel}>Estimated Total Price</Text>
            <Text style={styles.totalPriceValue}>${draft.totalPrice}</Text>
          </View>

          {draft.rawText ? (
            <View style={styles.rawBox}>
              <Text style={styles.rawTitle}>OCR Raw Text</Text>
              <Text style={styles.rawText} numberOfLines={4}>{draft.rawText}</Text>
            </View>
          ) : null}

          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm and Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  drawDatesInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  drawNumbersInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  dateOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dateOptionBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateOptionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateOptionText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  dateOptionTextActive: {
    color: '#fff',
  },
  mappingBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  mappingTitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mappingDate: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '600',
    minWidth: 100,
  },
  mappingArrow: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginHorizontal: 8,
  },
  mappingNumber: {
    fontSize: Typography.sm,
    color: Colors.text,
    fontWeight: '700',
  },
  mappingEmpty: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
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
  totalPriceBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  totalPriceLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalPriceValue: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: '700',
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
