"use client";

// 실시간 대결 — 브라우저 쪽 API 클라이언트와 토큰 보관
import type { Difficulty } from "./sudoku";
import type { RoomView } from "./room";

const tokenKey = (id: string) => `sudoku:room:${id}`;

export function saveToken(id: string, token: string) {
  try {
    localStorage.setItem(tokenKey(id), token);
  } catch {}
}
export function loadToken(id: string): string | null {
  try {
    return localStorage.getItem(tokenKey(id));
  } catch {
    return null;
  }
}
export function dropToken(id: string) {
  try {
    localStorage.removeItem(tokenKey(id));
  } catch {}
}

export class RoomApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new RoomApiError(res.status, body.error ?? "문제가 생겼어요");
  return body;
}

export const roomApi = {
  create: (difficulty: Difficulty) =>
    call<{ id: string; token: string; view: RoomView }>("/api/room", { method: "POST", body: JSON.stringify({ difficulty }) }),
  join: (id: string) => call<{ token: string; view: RoomView }>(`/api/room/${id}/join`, { method: "POST" }),
  snapshot: (id: string, token: string) => call<RoomView>(`/api/room/${id}?token=${encodeURIComponent(token)}`),
  progress: (id: string, token: string, values: number[], mistakes: number) =>
    call<RoomView>(`/api/room/${id}/progress`, { method: "POST", token, body: JSON.stringify({ values, mistakes }) }),
  leave: (id: string, token: string) => call<RoomView>(`/api/room/${id}/leave`, { method: "POST", token }),
  rematch: (id: string, token: string) => call<{ rematchId: string; token?: string }>(`/api/room/${id}/rematch`, { method: "POST", token }),
};

export const roomUrl = (id: string, origin = location.origin) => `${origin}/room/${id}`;
