import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TicketUploadResponse {
  id: string;
  status: string;
  game_type: string | null;
  draw_date: string | null;
  bet_type: string | null;
  numbers: unknown;
}

export interface TicketListItem {
  id: string;
  game_type: string;
  draw_date: string;
  purchase_date: string;
  bet_type: string | null;
  status: string;
  image_path: string;
  is_winner: boolean | null;
  prize_tier: string | null;
}

export interface CombinationOut {
  id: string;
  combination: string;
  is_system_expanded: boolean;
}

export interface TicketResultOut {
  id: string;
  combination_id: string | null;
  is_winner: boolean;
  prize_tier: string | null;
  notified: boolean;
  checked_at: string;
}

export interface TicketDetail {
  id: string;
  device_id: string;
  image_path: string;
  game_type: string;
  draw_date: string;
  purchase_date: string;
  numbers: unknown;
  bet_type: string | null;
  raw_ocr_text: string | null;
  status: string;
  created_at: string;
  combinations: CombinationOut[];
  results: TicketResultOut[];
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export async function uploadTicket(
  imageUri: string,
  deviceId: string,
): Promise<TicketUploadResponse> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    formData.append('file', blob, 'ticket.jpg');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (formData as any).append('file', { uri: imageUri, type: 'image/jpeg', name: 'ticket.jpg' });
  }

  return request<TicketUploadResponse>('/api/tickets/upload', {
    method: 'POST',
    headers: { 'X-Device-ID': deviceId },
    body: formData,
  });
}

export async function listTickets(
  deviceId: string,
  params?: { sort?: string; filter?: string },
): Promise<TicketListItem[]> {
  const qs = new URLSearchParams({ device_id: deviceId, ...params }).toString();
  return request<TicketListItem[]>(`/api/tickets?${qs}`);
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return request<TicketDetail>(`/api/tickets/${id}`);
}

export async function deleteTicket(id: string): Promise<void> {
  await fetch(`${API_URL}/api/tickets/${id}`, { method: 'DELETE' });
}

// ── Results ───────────────────────────────────────────────────────────────────

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

// ── Predictions ───────────────────────────────────────────────────────────────

export async function getPredictions(): Promise<PredictionResponse> {
  return request<PredictionResponse>('/api/predictions');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Return a full URL for a ticket image stored on the backend. */
export function imageUrl(imagePath: string): string {
  // imagePath is like "./uploads/uuid.jpg" — strip the leading "./"
  const relative = imagePath.replace(/^\.\//, '');
  return `${API_URL}/${relative}`;
}
