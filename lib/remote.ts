"use client";

/* The link between the big screen and the remote controller(s), over a
   Supabase Realtime Broadcast channel. Nothing is stored: the screen keeps the
   game (and saves it in its browser), controllers send it commands, and the
   screen answers with a snapshot of what it shows.

   The channel's name comes from a secret key, so only someone who knows the key
   can reach the screen: the screen gets it once from its URL (?key=…), the
   controller asks for it. Both remember it on the device. */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { Action, GameKind, GameState } from "./game";

/** What the big screen is showing */
export type View = "logo" | "homologation" | "intro" | "matches" | "bracket" | "champion" | "game" | "stats" | "final" | "board";

export interface Screen {
  view: View;
  /** the Tab leaderboard is laid over the current screen */
  overlay: boolean;
  /** homologation: 0 its opener, 1 the scores, 2 the leaderboard */
  homol?: 0 | 1 | 2;
}

export type Command =
  | { type: "hello" }
  | { type: "action"; action: Action }
  /** the next step of the show (see lib/flow.ts) */
  // `from`: what the screen showed when it was pressed; a screen showing something else ignores it
  | { type: "next"; from?: View; homol?: 0 | 1 | 2 }
  | { type: "prev"; from?: View; homol?: 0 | 1 | 2 }
  /** straight back to the logo */
  | { type: "home" }
  /** jump to a stage's title card (corrections; the show order is automatic) */
  | { type: "stage"; game: GameKind | "homologation" }
  | { type: "overlay"; open: boolean }
  /** jump to a match from the line-up / bracket */
  | { type: "openMatch"; id: string }
  | { type: "cupReset" };

export interface Snapshot {
  state: GameState;
  screen: Screen;
  /** the screen's clock when sent (controllers show timers from it) */
  sentAt: number;
  /** this screen page (a second one on the same key has another) */
  screenId?: string;
}

/** The game without the boards of matches that aren't open (the controller never shows those). */
export const compact = (s: GameState): GameState => ({
  ...s,
  matches: s.matches.map((m) => ({
    ...m,
    games: Object.fromEntries(
      Object.entries(m.games).map(([g, slot]) => [
        g,
        { ...slot, teams: slot.teams.map((t) => ({ ...t, shapes: {}, grid: [] })) as unknown as typeof slot.teams },
      ]),
    ) as typeof m.games,
  })),
});

/* ─── key ───────────────────────────────────────────────────────────── */

const KEY_STORE = "trsyp3-remote-key";

export const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
};

export const saveKey = (key: string | null) => {
  try {
    if (key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch {}
};

/** cyrb53: a short, stable hash, so the key itself never travels as the channel name */
const hash = (str: string) => {
  let h1 = 0xdeadbeef ^ 53;
  let h2 = 0x41c6ce57 ^ 53;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/* ─── channel ───────────────────────────────────────────────────────── */

let client: SupabaseClient | null = null;
const supabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  client ??= createClient(url, anon, { realtime: { params: { eventsPerSecond: 40 } } });
  return client;
};

export type LinkStatus = "off" | "connecting" | "live";

/**
 * Joins the channel for `key`. The screen listens for commands; a controller
 * listens for snapshots. Returns a sender and the connection status.
 */
export function useLink<In>(key: string | null, role: "screen" | "control", onMessage: (msg: In) => void) {
  const [status, setStatus] = useState<LinkStatus>("off");
  const channel = useRef<RealtimeChannel | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    const sb = supabase();
    if (!key || !sb) return;
    const ch = sb.channel(`trsyp3-${hash(key)}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: role === "screen" ? "cmd" : "snap" }, ({ payload }) => handler.current(payload as In));
    ch.subscribe((s) => {
      setStatus(s === "SUBSCRIBED" ? "live" : s === "CLOSED" ? "off" : "connecting");
      if (s === "SUBSCRIBED" && role === "control") void ch.send({ type: "broadcast", event: "cmd", payload: { type: "hello" } });
    });
    channel.current = ch;
    const t = setTimeout(() => setStatus((v) => (v === "off" ? "connecting" : v)), 0);
    return () => {
      clearTimeout(t);
      channel.current = null;
      void sb.removeChannel(ch);
    };
  }, [key, role]);

  const send = useCallback(
    (payload: unknown) => {
      void channel.current?.send({ type: "broadcast", event: role === "screen" ? "snap" : "cmd", payload });
    },
    [role],
  );
  return { send, status };
}

/* ─── on-screen hooks for remote commands that a screen component carries out ── */

export const screenBus = typeof window === "undefined" ? null : new EventTarget();
