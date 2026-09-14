"use client";

// 실시간 대결 연결 훅 — SSE 구독, 시계 보정, 진행 전송(스로틀), 나가기/재대결
import { useCallback, useEffect, useRef, useState } from "react";
import { PROGRESS_THROTTLE_MS, RoomView } from "./room";
import { RoomApiError, dropToken, loadToken, roomApi, saveToken } from "./roomClient";

export type RoomConnection = "idle" | "connecting" | "open" | "reconnecting" | "error";

export function useRoom(roomId: string | null) {
  const [view, setView] = useState<RoomView | null>(null);
  const [connection, setConnection] = useState<RoomConnection>("idle");
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0); // serverNow - clientNow
  const [, force] = useState(0); // 1초마다 리렌더 (타이머·카운트다운)
  const esRef = useRef<EventSource | null>(null);
  const tokenRef = useRef<string | null>(null);
  const idRef = useRef<string | null>(null);

  // 서버 기준 현재 시각
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const applyView = useCallback((v: RoomView) => {
    // 스냅샷의 now로 오프셋 보정 (한 방향 지연이 섞이므로 절반만 반영해 튐을 줄인다)
    const sample = v.now - Date.now();
    offsetRef.current = offsetRef.current === 0 ? sample : offsetRef.current + (sample - offsetRef.current) / 2;
    setView(v);
  }, []);

  // 연결: 토큰이 없으면 참가(join) 먼저
  useEffect(() => {
    if (!roomId) {
      setView(null);
      setConnection("idle");
      setError(null);
      return;
    }
    let cancelled = false;
    idRef.current = roomId;
    setError(null);
    setConnection("connecting");

    const open = (token: string) => {
      if (cancelled) return;
      tokenRef.current = token;
      const es = new EventSource(`/api/room/${roomId}/events?token=${encodeURIComponent(token)}`);
      esRef.current = es;
      es.addEventListener("open", () => setConnection("open"));
      es.addEventListener("state", (e) => applyView(JSON.parse((e as MessageEvent).data) as RoomView));
      es.addEventListener("ping", (e) => {
        const { now } = JSON.parse((e as MessageEvent).data) as { now: number };
        const sample = now - Date.now();
        offsetRef.current += (sample - offsetRef.current) / 2;
      });
      es.addEventListener("gone", () => {
        setError("대결이 만료됐어요");
        es.close();
      });
      // 서버가 maxDuration 전에 정상 종료하면 브라우저가 자동 재접속한다
      es.addEventListener("error", () => setConnection((c) => (c === "open" ? "reconnecting" : c)));
    };

    (async () => {
      let token = loadToken(roomId);
      if (!token) {
        try {
          const j = await roomApi.join(roomId);
          token = j.token;
          saveToken(roomId, token);
          applyView(j.view);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof RoomApiError ? e.message : "참가하지 못했어요");
            setConnection("error");
          }
          return;
        }
      }
      open(token);
    })();

    const tick = setInterval(() => force((n) => n + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [roomId, applyView]);

  // 진행 전송: 마지막 호출 기준 250ms 스로틀 + 항상 최신 보드로
  const pendingRef = useRef<{ values: number[]; mistakes: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    timerRef.current = null;
    const p = pendingRef.current;
    const id = idRef.current;
    const token = tokenRef.current;
    if (!p || !id || !token) return;
    pendingRef.current = null;
    try {
      applyView(await roomApi.progress(id, token, p.values, p.mistakes));
    } catch (e) {
      // 시작 전(425)·이미 끝남(409)은 조용히 무시. 그 외는 다음 전송에서 재시도
      if (!(e instanceof RoomApiError && (e.status === 425 || e.status === 409))) pendingRef.current = p;
    }
  }, [applyView]);

  const sendProgress = useCallback(
    (values: number[], mistakes: number, immediate = false) => {
      pendingRef.current = { values, mistakes };
      if (immediate) {
        if (timerRef.current) clearTimeout(timerRef.current);
        void flush();
        return;
      }
      if (!timerRef.current) timerRef.current = setTimeout(flush, PROGRESS_THROTTLE_MS);
    },
    [flush],
  );

  const leave = useCallback(async () => {
    const id = idRef.current;
    const token = tokenRef.current;
    if (!id || !token) return;
    try {
      await roomApi.leave(id, token);
    } catch {}
    dropToken(id);
  }, []);

  // 재대결 방을 만들거나(내가 먼저) 상대가 만든 방에 합류할 준비. 새 방 id를 돌려준다
  const rematch = useCallback(async (): Promise<string | null> => {
    const id = idRef.current;
    const token = tokenRef.current;
    if (!id || !token) return null;
    try {
      const r = await roomApi.rematch(id, token);
      if (r.token) saveToken(r.rematchId, r.token);
      return r.rematchId;
    } catch (e) {
      setError(e instanceof RoomApiError ? e.message : "재대결을 만들지 못했어요");
      return null;
    }
  }, []);

  return { view, connection, error, serverNow, sendProgress, leave, rematch, token: tokenRef.current };
}
