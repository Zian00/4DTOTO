import { Platform } from 'react-native';
import Constants from 'expo-constants';

type ConstantsLike = {
  expoConfig?: { hostUri?: string };
  expoGoConfig?: { debuggerHost?: string };
  manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  manifest?: { debuggerHost?: string };
};

function hostFromDebugHost(debuggerHost?: string): string | null {
  if (!debuggerHost) return null;
  return debuggerHost.split(':')[0] || null;
}

function detectExpoHost(): string | null {
  const c = Constants as unknown as ConstantsLike;

  const hostFromExpoConfig = hostFromDebugHost(c.expoConfig?.hostUri);
  if (hostFromExpoConfig) return hostFromExpoConfig;

  const hostFromExpoGoConfig = hostFromDebugHost(c.expoGoConfig?.debuggerHost);
  if (hostFromExpoGoConfig) return hostFromExpoGoConfig;

  const hostFromManifest2 = hostFromDebugHost(c.manifest2?.extra?.expoGo?.debuggerHost);
  if (hostFromManifest2) return hostFromManifest2;

  const hostFromLegacyManifest = hostFromDebugHost(c.manifest?.debuggerHost);
  if (hostFromLegacyManifest) return hostFromLegacyManifest;

  return null;
}

function normalizeApiUrl(rawUrl: string): string {
  if (Platform.OS === 'web') return rawUrl;
  const host = detectExpoHost();
  if (!host) return rawUrl;
  return rawUrl
    .replace('://localhost', `://${host}`)
    .replace('://127.0.0.1', `://${host}`);
}

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const API_URL = normalizeApiUrl(RAW_API_URL);

export function getApiBaseUrl(): string {
  return API_URL;
}

/** Resolve a relative image path (e.g. "/uploads/foo.jpg") to a full URL. */
export function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  return `${API_URL}${imageUrl}`;
}

export interface TicketUploadResponse {
  id: string;
  purchase_group_id: string;
  status: 'PENDING' | 'WON' | 'LOST' | 'NO_RESULT';
  game_type: '4D' | 'TOTO';
  draw_date: string;
  purchase_datetime: string;
  total_price: number | string;
  bet_label: string | null;
  numbers: string[];
  raw_ocr_text?: string | null;
}

export interface TicketConfirmBatchResponse {
  purchase_group_id: string;
  created_count: number;
  ticket_ids: string[];
  pending_count: number;
  won_count: number;
  lost_count: number;
  message: string;
}

export interface TicketPreviewResponse {
  game_type: string | null;
  draw_date: string | null;
  draw_date_options?: string[];
  draw_number?: string | null;
  draw_number_options?: string[];
  purchase_datetime?: string | null;
  bet_type: string | null;
  numbers: unknown;
  big_amount?: string | null;
  small_amount?: string | null;
  total_price?: string | null;
  raw_ocr_text?: string | null;
}

export interface TicketConfirmPayload {
  game_type: string;
  draw_dates: string[];
  draw_numbers?: (string | null)[] | null;
  purchase_datetime?: string | null;
  bet_type?: string | null;
  numbers: string[][];
  big_amount?: string | null;
  small_amount?: string | null;
  raw_ocr_text?: string | null;
}

export interface TicketListItem {
  id: string;
  purchase_group_id: string;
  game_type: '4D' | 'TOTO';
  draw_date: string;
  draw_number?: string | null;
  purchase_datetime: string;
  total_price: number | string;
  bet_label: string | null;
  numbers: string[];
  status: 'PENDING' | 'WON' | 'LOST' | 'NO_RESULT';
  is_winner: boolean | null;
  prize_tier: string | null;
  image_url?: string | null;
}

export interface FourDTicketOut {
  number: string;
  bet_type: 'ORDINARY' | 'IBET';
  big_amount: number | string;
  small_amount: number | string;
}

export interface TotoTicketOut {
  is_system: boolean;
  system_type:
    | 'SYSTEM_7'
    | 'SYSTEM_8'
    | 'SYSTEM_9'
    | 'SYSTEM_10'
    | 'SYSTEM_11'
    | 'SYSTEM_12'
    | null;
}

export interface NotificationOut {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListItem {
  id: string;
  ticket_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  game_type: '4D' | 'TOTO';
  draw_date: string;
}

export interface TicketDetail {
  id: string;
  purchase_group_id: string;
  game_type: '4D' | 'TOTO';
  purchase_datetime: string;
  draw_date: string;
  draw_number?: string | null;
  total_price: number | string;
  status: 'PENDING' | 'WON' | 'LOST' | 'NO_RESULT';
  created_at: string;
  updated_at: string;
  bet_label: string | null;
  prize_tier: string | null;
  numbers: string[];
  four_d_ticket: FourDTicketOut | null;
  toto_ticket: TotoTicketOut | null;
  toto_numbers: number[];
  toto_expanded_combinations: string[];
  notifications: NotificationOut[];
  image_url?: string | null;
  raw_ocr_text?: string | null;
}

export interface DrawResultResponse {
  id: string;
  game_type: string;
  draw_date: string;
  winning_numbers: Record<string, unknown>;
  scraped_at: string;
}

export interface PaginatedResults {
  items: DrawResultResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface TotoPrediction {
  primary: number[];
  supplementary: number[];
  format: string;
}

export interface PredictionResponse {
  model: string;
  description: string;
  four_d_prediction: string;
  toto_prediction: TotoPrediction;
  data_points: number;
  disclaimer: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network request failed';
    throw new Error(`Cannot reach API (${API_URL}). ${msg}`);
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(err.detail ?? `Request failed (${res.status}) at ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadTicket(imageUri: string): Promise<TicketPreviewResponse> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    formData.append('file', blob, 'ticket.jpg');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (formData as any).append('file', { uri: imageUri, type: 'image/jpeg', name: 'ticket.jpg' });
  }

  return request<TicketPreviewResponse>('/api/tickets/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function confirmTicket(
  imageUri: string,
  payload: TicketConfirmPayload,
): Promise<TicketConfirmBatchResponse> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    formData.append('file', blob, 'ticket.jpg');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (formData as any).append('file', { uri: imageUri, type: 'image/jpeg', name: 'ticket.jpg' });
  }

  formData.append('game_type', payload.game_type);
  formData.append('draw_dates_json', JSON.stringify(payload.draw_dates));
  if (payload.draw_numbers && payload.draw_numbers.length > 0) {
    formData.append('draw_numbers_json', JSON.stringify(payload.draw_numbers));
  }
  if (payload.purchase_datetime) formData.append('purchase_datetime', payload.purchase_datetime);
  formData.append('numbers_json', JSON.stringify(payload.numbers));
  if (payload.bet_type) formData.append('bet_type', payload.bet_type);
  if (payload.big_amount) formData.append('big_amount', payload.big_amount);
  if (payload.small_amount) formData.append('small_amount', payload.small_amount);
  if (payload.raw_ocr_text) formData.append('raw_ocr_text', payload.raw_ocr_text);

  return request<TicketConfirmBatchResponse>('/api/tickets/confirm', {
    method: 'POST',
    body: formData,
  });
}

export async function listTickets(params?: {
  sort?: string;
  filter?: string;
}): Promise<TicketListItem[]> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][]
  ).toString();
  return request<TicketListItem[]>(`/api/tickets${qs ? `?${qs}` : ''}`);
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${id}`);
}

export async function deleteTicket(id: string): Promise<void> {
  await fetch(`${API_URL}/api/tickets/${id}`, { method: 'DELETE' });
}

export async function listResults(params?: {
  game_type?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResults> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return request<PaginatedResults>(`/api/results${qs ? `?${qs}` : ''}`);
}

export async function getResult(
  gameType: string,
  drawDate: string,
): Promise<DrawResultResponse> {
  return request<DrawResultResponse>(`/api/results/${gameType}/${drawDate}`);
}

export async function getPredictions(): Promise<PredictionResponse[]> {
  return request<PredictionResponse[]>('/api/predictions');
}

export async function listNotifications(): Promise<NotificationListItem[]> {
  return request<NotificationListItem[]>('/api/notifications');
}

export async function markNotificationRead(id: string): Promise<NotificationListItem> {
  return request<NotificationListItem>(`/api/notifications/${id}/read`, { method: 'PATCH' });
}
