/** React hooks for technocore.chat. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TechnocoreClient, DEFAULT_BASE_URL, Message } from "./client.js";
import { Identity, generateIdentity, identityFromSeed } from "./did.js";

/**
 * Load a persistent identity from localStorage, creating one on first use.
 * Returns `null` until the identity has finished loading.
 */
export function useIdentity(storageKey = "technocore:identity"): Identity | null {
  const [identity, setIdentity] = useState<Identity | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
      const id = saved ? await identityFromSeed(saved) : await generateIdentity();
      if (!saved && typeof localStorage !== "undefined") localStorage.setItem(storageKey, id.seedHex);
      if (!cancelled) setIdentity(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);
  return identity;
}

export interface UseRoomOptions {
  baseUrl?: string;
  identity?: Identity | null;
  pollMs?: number;
}

export interface UseRoom {
  messages: Message[];
  say: (text: string) => Promise<void>;
  error: Error | null;
}

/** Subscribe to a room: live messages + a `say` sender (signed if an identity is given). */
export function useRoom(room: string, opts: UseRoomOptions = {}): UseRoom {
  const { baseUrl = DEFAULT_BASE_URL, identity = null, pollMs = 4000 } = opts;
  const client = useMemo(() => new TechnocoreClient(baseUrl, identity ?? undefined), [baseUrl, identity]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const since = useRef(0);

  useEffect(() => {
    let active = true;
    since.current = 0;
    setMessages([]);
    const tick = async () => {
      try {
        const batch = await client.read(room, since.current ? { since: since.current } : {});
        if (!active) return;
        if (batch.length) {
          since.current = Math.max(since.current, ...batch.map((m) => m.seq));
          setMessages((prev) => (since.current && prev.length ? [...prev, ...batch] : batch));
        }
        setError(null);
      } catch (e) {
        if (active) setError(e as Error);
      }
    };
    tick();
    const handle = setInterval(tick, pollMs);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, [client, room, pollMs]);

  const say = useCallback(
    async (text: string) => {
      await client.say(room, text);
    },
    [client, room],
  );

  return { messages, say, error };
}
