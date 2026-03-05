import { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import Toast from 'react-native-toast-message';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import type {
  DraftConfidence,
  FieldErrors,
  FieldTouched,
  NumberPreviewRow,
  OcrDraft,
  ReviewField,
} from '../../types/upload';
import {
  formatBetTypeLabel,
  formatDateTimeForEditor,
  getBetTypeOptions,
  normalizeBetType,
  parseEditorDateTime,
} from '../../utils/uploadHelpers';

type Props = {
  draft: OcrDraft;
  draftConfidence: DraftConfidence;
  fieldErrors: FieldErrors;
  fieldTouched: FieldTouched;
  numberPreviewRows: NumberPreviewRow[];
  parsedInvalidNumberCount: number;
  confirmSummary: string;
  isConfirming: boolean;
  onUpdateDraft: (updater: (prev: OcrDraft) => OcrDraft) => void;
  onMarkFieldTouched: (field: ReviewField) => void;
  onClearFieldError: (field: ReviewField) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function WarnBadge() {
  return (
    <View style={styles.badgeWarn}>
      <Text style={styles.badgeWarnText}>! Review</Text>
    </View>
  );
}

export function ReviewForm({
  draft,
  draftConfidence,
  fieldErrors,
  fieldTouched,
  numberPreviewRows,
  parsedInvalidNumberCount,
  confirmSummary,
  isConfirming,
  onUpdateDraft,
  onMarkFieldTouched,
  onClearFieldError,
  onConfirm,
  onCancel,
}: Props) {
  const [isRawExpanded, setIsRawExpanded] = useState(false);

  // Draw date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());

  // Purchase datetime picker state
  const [showPurchasePicker, setShowPurchasePicker] = useState(false);
  const [purchasePickerValue, setPurchasePickerValue] = useState(new Date());
  const [androidPurchaseMode, setAndroidPurchaseMode] = useState<'date' | 'time'>('date');

  function getFieldSignal(field: ReviewField): {
    showNeedsReview: boolean;
    error?: string;
  } {
    const touched = Boolean(fieldTouched[field]);
    return {
      showNeedsReview: draftConfidence[field] === 'uncertain' && !touched,
      error: fieldErrors[field],
    };
  }

  // ── Draw date picker ──────────────────────────────
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
    if (draft.drawDateOptions.includes(dateStr)) {
      Toast.show({ type: 'info', text1: `${dateStr} is already in the list.` });
      return;
    }
    onMarkFieldTouched('drawDates');
    onClearFieldError('drawDates');
    onUpdateDraft((prev) => ({ ...prev, drawDateOptions: [...prev.drawDateOptions, dateStr] }));
  }

  // ── Purchase datetime picker ──────────────────────
  function openPurchasePicker() {
    const current = parseEditorDateTime(draft.purchaseDatetime);
    setPurchasePickerValue(current ?? new Date());
    setAndroidPurchaseMode('date');
    setShowPurchasePicker(true);
  }

  function applyPurchaseDateTime(next: Date) {
    onMarkFieldTouched('purchaseDatetime');
    onClearFieldError('purchaseDatetime');
    onUpdateDraft((prev) => ({ ...prev, purchaseDatetime: formatDateTimeForEditor(next) }));
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

  const betType = normalizeBetType(draft.gameType, draft.betType);
  const validEnteredNumbers = numberPreviewRows.filter((row) => row.isValid).map((row) => row.text);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Review Detected Details</Text>
          <Text style={styles.hint}>Tap any field to correct OCR errors before saving.</Text>
        </View>

        {/* ── Ticket Identity ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎫  Ticket Identity</Text>

          {/* Game Type */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Game Type</Text>
            </View>
            <View style={[styles.gameRow, getFieldSignal('gameType').showNeedsReview && styles.fieldWarn]}>
              {(['4D', 'TOTO'] as const).map((gt) => (
                <TouchableOpacity
                  key={gt}
                  style={[styles.gameBtn, draft.gameType === gt && styles.gameBtnActive]}
                  onPress={() => {
                    onMarkFieldTouched('gameType');
                    onMarkFieldTouched('betType');
                    onClearFieldError('gameType');
                    onClearFieldError('betType');
                    onUpdateDraft((prev) => ({
                      ...prev,
                      gameType: gt,
                      betType: normalizeBetType(gt, prev.betType),
                    }));
                  }}
                >
                  <Text style={[styles.gameBtnText, draft.gameType === gt && styles.gameBtnTextActive]}>
                    {gt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {getFieldSignal('gameType').error && (
              <Text style={styles.errorText}>{getFieldSignal('gameType').error}</Text>
            )}
          </View>

          {/* Bet Type */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bet Type</Text>
            </View>
            <View
              style={[
                styles.optionRow,
                getFieldSignal('betType').showNeedsReview && styles.fieldWarn,
                getFieldSignal('betType').error && styles.fieldError,
              ]}
            >
              {getBetTypeOptions(draft.gameType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.optionBtn, draft.betType === type && styles.optionBtnActive]}
                  onPress={() => {
                    onMarkFieldTouched('betType');
                    onClearFieldError('betType');
                    onUpdateDraft((prev) => ({ ...prev, betType: type }));
                  }}
                >
                  <Text style={[styles.optionBtnText, draft.betType === type && styles.optionBtnTextActive]}>
                    {formatBetTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {getFieldSignal('betType').error && (
              <Text style={styles.errorText}>{getFieldSignal('betType').error}</Text>
            )}
          </View>

          {/* Purchase Datetime */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Purchase Date & Time</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateTimeBtn,
                getFieldSignal('purchaseDatetime').showNeedsReview && styles.fieldWarn,
                getFieldSignal('purchaseDatetime').error && styles.fieldError,
              ]}
              onPress={openPurchasePicker}
            >
              <Text style={styles.dateTimeBtnText}>{draft.purchaseDatetime}</Text>
              <Text style={styles.dateTimeBtnAction}>Change</Text>
            </TouchableOpacity>
            {getFieldSignal('purchaseDatetime').error && (
              <Text style={styles.errorText}>{getFieldSignal('purchaseDatetime').error}</Text>
            )}
          </View>
        </View>

        {/* ── Your Numbers ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔢  Your Numbers</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {draft.gameType === '4D'
                  ? 'One 4-digit number per line'
                  : 'One set per line, space-separated'}
              </Text>
              <WarnBadge />
            </View>
            <TextInput
              style={[
                styles.input,
                styles.numbersInput,
                getFieldSignal('numbersText').showNeedsReview && styles.fieldWarn,
                getFieldSignal('numbersText').error && styles.fieldError,
              ]}
              value={draft.numbersText}
              onChangeText={(text) => {
                onMarkFieldTouched('numbersText');
                onClearFieldError('numbersText');
                onUpdateDraft((prev) => ({ ...prev, numbersText: text }));
              }}
              multiline
              autoCapitalize="none"
              placeholder={draft.gameType === '4D' ? '1234\n5678' : '1 7 12 23 34 45\n2 8 14 21 33 47'}
              placeholderTextColor={Colors.textSecondary}
            />
            {numberPreviewRows.length > 0 && (
              <View style={styles.chips}>
                {numberPreviewRows.map((row) => (
                  <View key={row.key} style={[styles.chip, !row.isValid && styles.chipInvalid]}>
                    <Text style={styles.chipText}>{row.text}</Text>
                  </View>
                ))}
              </View>
            )}
            {parsedInvalidNumberCount > 0 && (
              <Text style={styles.errorText}>
                {draft.gameType === '4D'
                  ? 'Invalid rows detected: use exactly 4 digits per line.'
                  : betType === 'ORDINARY'
                    ? 'Invalid rows detected: ORDINARY needs exactly 6 numbers per set.'
                    : (() => {
                        const m = /^SYSTEM_(\d+)$/.exec(betType);
                        return m
                          ? `Invalid rows detected: ${formatBetTypeLabel(betType)} needs exactly ${m[1]} numbers per set.`
                          : 'Invalid rows detected: each set needs 6 to 12 numbers.';
                      })()}
              </Text>
            )}
            {getFieldSignal('numbersText').error && (
              <Text style={styles.errorText}>{getFieldSignal('numbersText').error}</Text>
            )}
          </View>
        </View>

        {/* ── Draw Dates ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅  Draw Dates</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Select all applicable draw dates</Text>
              <WarnBadge />
            </View>
            <View
              style={[
                styles.chips,
                getFieldSignal('drawDates').showNeedsReview && styles.fieldWarn,
                getFieldSignal('drawDates').error && styles.fieldError,
              ]}
            >
              {draft.drawDateOptions.map((opt) => (
                <View key={opt} style={styles.chip}>
                  <Text style={styles.chipText}>{opt}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      onMarkFieldTouched('drawDates');
                      onClearFieldError('drawDates');
                      onUpdateDraft((prev) => ({
                        ...prev,
                        drawDateOptions: prev.drawDateOptions.filter((d) => d !== opt),
                        drawNumberByDate: Object.fromEntries(
                          Object.entries(prev.drawNumberByDate).filter(([key]) => key !== opt),
                        ),
                      }));
                    }}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={styles.chipRemove}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addDateBtn} onPress={openDatePicker}>
                <Text style={styles.addDateBtnText}>+ Add Date</Text>
              </TouchableOpacity>
            </View>
            {draft.drawDateOptions.length > 0 && (
              <View style={styles.mappingBox}>
                <Text style={styles.mappingTitle}>Mapping Preview (Draw Date -&gt; Numbers)</Text>
                {draft.drawDateOptions.map((dateOpt) => (
                  <View key={`map-${dateOpt}`} style={styles.mappingRow}>
                    <View style={styles.mappingDateCol}>
                      <Text style={styles.mappingDateLabel}>Draw Date</Text>
                      <Text style={styles.mappingDate}>{dateOpt}</Text>
                    </View>
                    <View style={styles.mappingNumbersCol}>
                      <Text style={styles.mappingDateLabel}>Numbers</Text>
                      {validEnteredNumbers.length > 0 ? (
                        <View style={styles.mappingNumbers}>
                          {validEnteredNumbers.map((num, idx) => (
                            <View key={`${dateOpt}-${num}-${idx}`} style={styles.mappingChip}>
                              <Text style={styles.mappingChipText}>{num}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.mappingEmpty}>No valid numbers entered yet.</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
            {getFieldSignal('drawDates').error && (
              <Text style={styles.errorText}>{getFieldSignal('drawDates').error}</Text>
            )}
          </View>
        </View>

        {/* ── Bet Amounts (4D only) ── */}
        {draft.gameType === '4D' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰  Bet Amounts</Text>
            <View style={styles.amountRow}>
              <View style={styles.amountCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Big ($)</Text>
                  <WarnBadge />
                </View>
                <TextInput
                  style={[
                    styles.input,
                    getFieldSignal('bigAmount').showNeedsReview && styles.fieldWarn,
                    getFieldSignal('bigAmount').error && styles.fieldError,
                  ]}
                  value={draft.bigAmount}
                  onChangeText={(text) => {
                    onMarkFieldTouched('bigAmount');
                    onClearFieldError('bigAmount');
                    onUpdateDraft((prev) => {
                      const total = (
                        (Number.parseFloat(text) || 0) + (Number.parseFloat(prev.smallAmount) || 0)
                      ).toFixed(2);
                      return { ...prev, bigAmount: text, totalPrice: total };
                    });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textSecondary}
                />
                {getFieldSignal('bigAmount').error && (
                  <Text style={styles.errorText}>{getFieldSignal('bigAmount').error}</Text>
                )}
              </View>
              <View style={styles.amountCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Small ($)</Text>
                  <WarnBadge />
                </View>
                <TextInput
                  style={[
                    styles.input,
                    getFieldSignal('smallAmount').showNeedsReview && styles.fieldWarn,
                    getFieldSignal('smallAmount').error && styles.fieldError,
                  ]}
                  value={draft.smallAmount}
                  onChangeText={(text) => {
                    onMarkFieldTouched('smallAmount');
                    onClearFieldError('smallAmount');
                    onUpdateDraft((prev) => {
                      const total = (
                        (Number.parseFloat(prev.bigAmount) || 0) + (Number.parseFloat(text) || 0)
                      ).toFixed(2);
                      return { ...prev, smallAmount: text, totalPrice: total };
                    });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="1.00"
                  placeholderTextColor={Colors.textSecondary}
                />
                {getFieldSignal('smallAmount').error && (
                  <Text style={styles.errorText}>{getFieldSignal('smallAmount').error}</Text>
                )}
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.label}>Total ($)</Text>
              <Text style={styles.totalValue}>${draft.totalPrice}</Text>
            </View>
          </View>
        )}

        {/* ── Raw OCR Text ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄  Raw OCR Text</Text>
          {draft.rawText ? (
            <View style={styles.rawBox}>
              <Text style={styles.rawText} numberOfLines={isRawExpanded ? undefined : 4}>
                {draft.rawText}
              </Text>
              {(draft.rawText.length > 200 || draft.rawText.split('\n').length > 4) && (
                <TouchableOpacity onPress={() => setIsRawExpanded((prev) => !prev)}>
                  <Text style={styles.rawToggle}>
                    {isRawExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>OCR raw text unavailable.</Text>
          )}
        </View>

        {/* ── Actions ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={isConfirming}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} disabled={isConfirming}>
            <Text style={styles.confirmBtnText}>Confirm & Save</Text>
          </TouchableOpacity>
        </View>
        {confirmSummary ? <Text style={styles.confirmSummary}>{confirmSummary}</Text> : null}
      </View>

      {/* ── Draw date pickers ── */}
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
                onPress={() =>
                  onDateChange(
                    { type: 'set', nativeEvent: { timestamp: pickerValue.getTime() } } as DateTimePickerEvent,
                    pickerValue,
                  )
                }
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
        <DateTimePicker value={pickerValue} mode="date" display="default" onChange={onDateChange} />
      )}

      {/* ── Purchase datetime pickers ── */}
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
              <TouchableOpacity style={styles.pickerDoneBtn} onPress={confirmPurchasePickerIOS}>
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
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: { gap: 2 },
  title: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  hint: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 4 },

  section: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
  },
  sectionTitle: { fontSize: Typography.sm, color: Colors.text, fontWeight: '700', marginBottom: 2 },

  fieldGroup: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  errorText: { fontSize: Typography.xs, color: Colors.error, fontWeight: '600' },

  fieldWarn: { borderColor: Colors.warning, borderWidth: 1.5, borderRadius: Radius.md },
  fieldError: { borderColor: Colors.error, borderWidth: 1.5, borderRadius: Radius.md },

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
  numbersInput: { minHeight: 120, textAlignVertical: 'top', fontFamily: 'monospace' },

  gameRow: { flexDirection: 'row', gap: Spacing.sm },
  gameBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  gameBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gameBtnText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '700' },
  gameBtnTextActive: { color: '#fff' },

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
  optionBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  optionBtnText: { color: Colors.textSecondary, fontSize: Typography.sm, fontWeight: '700' },
  optionBtnTextActive: { color: '#fff' },

  dateTimeBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateTimeBtnText: { color: Colors.text, fontSize: Typography.base, fontWeight: '600' },
  dateTimeBtnAction: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  chipInvalid: { backgroundColor: Colors.error },
  chipText: { fontSize: Typography.sm, color: '#fff', fontWeight: '700' },
  chipRemove: { fontSize: 18, color: 'rgba(255,255,255,0.8)', lineHeight: 20, fontWeight: '400' },
  addDateBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addDateBtnText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '700' },
  mappingBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  mappingTitle: { fontSize: Typography.sm, color: Colors.text, fontWeight: '700' },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
  },
  mappingDateCol: { width: 112, gap: 2 },
  mappingNumbersCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    gap: Spacing.xs,
  },
  mappingDateLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mappingDate: { fontSize: Typography.lg, color: Colors.text, fontWeight: '800' },
  mappingNumbers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  mappingChip: {
    borderRadius: Radius.full,
    backgroundColor: Colors.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mappingChipText: { fontSize: Typography.sm, color: Colors.info, fontWeight: '800' },
  mappingEmpty: { fontSize: Typography.xs, color: Colors.textSecondary },

  amountRow: { flexDirection: 'row', gap: Spacing.sm },
  amountCol: { flex: 1 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 2,
  },
  totalValue: { fontSize: Typography.base, fontWeight: '800', color: Colors.text },

  rawBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  rawText: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 18 },
  rawToggle: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: Typography.xs, color: Colors.textSecondary },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Typography.sm },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },
  confirmSummary: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right' },

  badgeWarn: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeWarnText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: '700' },

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
  pickerDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  pickerCancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  pickerCancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: Typography.base },
});
