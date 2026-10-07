import type { CreateRoomInput, RoomInfo, RoomSummary } from '@pokerplan/shared';
import { API_URL } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'Cannot reach the PokerPlan server. Check your connection and try again.',
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new ApiError(
      res.status,
      body?.code ?? 'HTTP_ERROR',
      typeof body?.message === 'string' ? body.message : `Request failed (${res.status})`,
    );
  }
  return (await res.json()) as T;
}

export const api = {
  createRoom: (input: CreateRoomInput) =>
    request<RoomInfo>('/rooms', { method: 'POST', body: JSON.stringify(input) }),
  getRoom: (roomId: string) => request<RoomInfo>(`/rooms/${roomId}`),
  getSummary: (roomId: string) => request<RoomSummary>(`/rooms/${roomId}/summary`),
};

export const queryKeys = {
  room: (roomId: string) => ['room', roomId] as const,
  summary: (roomId: string) => ['room', roomId, 'summary'] as const,
};
