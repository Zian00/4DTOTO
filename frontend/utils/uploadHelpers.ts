import type { TicketPreviewResponse } from '../services/api';
import type {
  DraftConfidence,
  FieldConfidence,
  GameType,
  OcrDraft,
  ReviewField,
} from '../types/upload';

export const BET_TYPES_4D = ['ORDINARY', 'IBET'] as const;
export const BET_TYPES_TOTO = [
  'ORDINARY',
  'SYSTEM_7',
  'SYSTEM_8',
  'SYSTEM_9',
  'SYSTEM_10',
  'SYSTEM_11',
  'SYSTEM_12',
] as const;

export const EMPTY_DRAFT_CONFIDENCE: DraftConfidence = {
  gameType: 'uncertain',
  betType: 'uncertain',
  purchaseDatetime: 'uncertain',
  numbersText: 'uncertain',
  drawDates: 'uncertain',
  bigAmount: 'uncertain',
  smallAmount: 'uncertain',
};

export function getBetTypeOptions(gameType: GameType): readonly string[] {
  return gameType === '4D' ? BET_TYPES_4D : BET_TYPES_TOTO;
}

export function normalizeBetType(gameType: GameType, betTypeRaw: string): string {
  const token = betTypeRaw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (!token) return 'ORDINARY';
  if (gameType === '4D') {
    return token === 'IBET' || token === 'I_BET' ? 'IBET' : 'ORDINARY';
  }
  if (token === 'STANDARD' || token === 'ORDINARY') return 'ORDINARY';
  const match = /^SYSTEM_?([7-9]|1[0-2])$/.exec(token);
  if (match) return `SYSTEM_${match[1]}`;
  return 'ORDINARY';
}

export function formatBetTypeLabel(betType: string): string {
  const token = betType.trim().toUpperCase();
  const match = /^SYSTEM_(\d+)$/.exec(token);
  if (match) return `SYSTEM ${match[1]}`;
  return token;
}

export function todayDmy(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function nowDmyHmAmPm(): string {
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

export function normalizeDateForEditor(raw: string | null): string {
  if (!raw) return todayDmy();
  const trimmed = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const dmy2Match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (dmy2Match) return `${dmy2Match[1]}/${dmy2Match[2]}/20${dmy2Match[3]}`;

  return todayDmy();
}

export function normalizeDateTimeForEditor(raw: string | null | undefined): string {
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

export function formatDateTimeForEditor(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const hour24 = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, '0');
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${dd}/${mm}/${yyyy} ${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
}

export function parseEditorDateTime(raw: string | null | undefined): Date | null {
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

export function formatNumbersForEditor(numbers: unknown, gameType: GameType): string {
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

export function parseNumbersForSubmit(text: string, gameType: GameType): string[][] {
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

function hasContent(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function buildDraftConfidence(
  response: TicketPreviewResponse,
  draft: OcrDraft,
): DraftConfidence {
  const hasDrawDates =
    (response.draw_date_options ?? []).some((d) => hasContent(d)) || hasContent(response.draw_date);

  const field = (ok: boolean): FieldConfidence => (ok ? 'auto' : 'uncertain');

  return {
    gameType: field(hasContent(response.game_type)),
    betType: field(hasContent(response.bet_type)),
    purchaseDatetime: field(hasContent(response.purchase_datetime)),
    numbersText: field(Boolean(draft.numbersText.trim())),
    drawDates: field(hasDrawDates),
    bigAmount: field(hasContent(response.big_amount)),
    smallAmount: field(hasContent(response.small_amount)),
  };
}

export function toDraft(response: TicketPreviewResponse): OcrDraft {
  const gameType: GameType = response.game_type === 'TOTO' ? 'TOTO' : '4D';
  const big = response.big_amount ?? '0.00';
  const small = response.small_amount ?? '1.00';
  const fallbackTotal = (Number.parseFloat(big) || 0) + (Number.parseFloat(small) || 0);
  const drawOptionsRaw = response.draw_date_options ?? [];
  const normalizedOptions = drawOptionsRaw.map((d) => normalizeDateForEditor(d));
  const uniqueDrawOptions = Array.from(new Set(normalizedOptions.filter(Boolean)));
  const primaryDrawDate = normalizeDateForEditor(response.draw_date);
  const drawDates = uniqueDrawOptions.length > 0 ? uniqueDrawOptions : [primaryDrawDate];

  const drawNumbers: string[] = [];
  const rawNumbers = response.draw_number_options ?? [];
  for (const n of rawNumbers) {
    const t = String(n ?? '').trim();
    if (t && !drawNumbers.includes(t)) drawNumbers.push(t);
  }
  const primaryDrawNumber = String(response.draw_number ?? '').trim();
  if (primaryDrawNumber && !drawNumbers.includes(primaryDrawNumber)) {
    drawNumbers.unshift(primaryDrawNumber);
  }

  return {
    gameType,
    drawDateOptions: drawDates,
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
