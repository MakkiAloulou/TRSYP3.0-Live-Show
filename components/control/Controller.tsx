"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import logo from "@/public/trsyp-logo.png";
import {
  cumulative,
  cupMatch,
  cupWinner,
  clockText,
  elapsedMs,
  formatTime,
  GAME_INFO,
  HOMOL_MAX,
  SHAPE_COLORS,
  SHAPES,
  toCell,
  type Diag,
  leagueMatches,
  nextMatchId,
  slotCarry,
  slotStatus,
  type Action,
  CUP_LABEL,
  canOpen,
  CUP_ROUNDS,
  cupGame,
  cupSlot,
  cupStarted,
  GLITCH_CARDS,
  GREEN_FREEZE_SECS,
  type CupRound,
  type GameKind,
  type GameState,
  type Match,
  type StatField,
  type TeamId,
  type TeamState,
  type TeamStats,
  type TimerState,
} from "@/lib/game";
import { readKey, saveKey, useLink, type Command, type Snapshot, type View } from "@/lib/remote";
import { nextCupMatch, nextStep, STAGES, stageTitle } from "@/lib/flow";
import ColorGrid, { DIAG_LINE, HALVES } from "../ColorGrid";
import Branch from "../Branch";
import FitText from "../FitText";
import ShapesBoard from "../ShapesBoard";
import { limitText, MAX_ACCURACY, onTime, parseClock, PHASE_FIELDS, PHASE_NAMES, phaseScore, phaseTimes, runTime, scoreFor, TIME_FIELDS, timerPhaseTimes } from "@/lib/scoring";

/* The remote controller: everything the operator does, as buttons, while the
   big screen shows only the competition. It sends commands to the screen and
   draws itself from the snapshot the screen sends back. */

type Send = (c: Command) => void;
type Act = (a: Action) => void;

/* Stats are typed into a private draft on the remote (kept on this device),
   and reach the screen only when the operator presses Show. */
type Draft = [Partial<TeamStats>, Partial<TeamStats>];
const DRAFT_STORE = "trsyp3-stats-drafts";
const draftKey = (s: GameState) => (s.current ? `${s.current}:${s.game}` : null);
const loadDrafts = (): Record<string, Draft> => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORE) ?? "{}");
  } catch {
    return {};
  }
};
const saveDrafts = (d: Record<string, Draft>) => {
  try {
    localStorage.setItem(DRAFT_STORE, JSON.stringify(d));
  } catch {}
};

/* Homologation scores are typed into a private draft too, and reach the
   screen when it shows them. */
const HOMOL_STORE = "trsyp3-homol-draft";
const loadHomol = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(HOMOL_STORE) ?? "{}");
  } catch {
    return {};
  }
};

interface HomolDraft {
  draft: Record<string, string>;
  onScore: (id: string, value: string) => void;
  send: () => void;
}

interface StatsDraft {
  draft: Draft;
  onField: (team: TeamId, field: StatField, value: string) => void;
  /** send the draft to the screen */
  send: () => void;
}

const VIEW_LABEL: Record<View, string> = {
  logo: "Logo",
  homologation: "Homologation",
  intro: "Game title",
  matches: "Line-up",
  bracket: "Champions Cup",
  champion: "Champion",
  game: "Live match",
  stats: "Stats",
  final: "Game Stats",
  board: "Leaderboard",
};

export default function Controller() {
  const [key, setKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setKey(readKey());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [offset, setOffset] = useState(0);
  // when each screen page on this key last answered (two would both follow every command)
  const [screens, setScreens] = useState<Record<string, number>>({});
  const { send, status } = useLink<Snapshot>(key, "control", (s) => {
    setSnap(s);
    setSeenAt(Date.now());
    setOffset(Date.now() - s.sentAt);
    if (s.screenId) setScreens((m) => ({ ...m, [s.screenId!]: Date.now() }));
  });

  // the screen sends a heartbeat every 4 s; quiet for 10 s = not there
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const online = status === "live" && now - seenAt < 10000;
  const screenCount = Object.values(screens).filter((t) => now - t < 10000).length;

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [homolDraft, setHomolDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const t = setTimeout(() => {
      setDrafts(loadDrafts());
      setHomolDraft(loadHomol());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <Shell />;
  if (!key)
    return (
      <Shell>
        <KeyGate
          onKey={(k) => {
            saveKey(k);
            setKey(k);
          }}
        />
      </Shell>
    );

  const cmd: Send = (c) => send(c);
  const act: Act = (a) => send({ type: "action", action: a });
  /** Clears every result on the screen, sends it to the logo, and drops this phone's unsent drafts. */
  const startOver = () => {
    act({ type: "startOver" });
    cmd({ type: "home" });
    setDrafts({});
    setHomolDraft({});
    try {
      localStorage.removeItem(DRAFT_STORE);
      localStorage.removeItem(HOMOL_STORE);
    } catch {}
  };
  const view = snap?.screen.view;
  const overlay = !!snap?.screen.overlay;
  const inMatch = view === "game" || view === "stats" || view === "final" || view === "board";
  const step = snap ? nextStep(snap.state, snap.screen.view, snap.screen.homol ?? 0) : null;

  const dk = snap ? draftKey(snap.state) : null;
  const stats: StatsDraft | null =
    snap && dk
      ? {
          draft: drafts[dk] ?? [{}, {}],
          onField: (team, field, value) =>
            setDrafts((d) => {
              const cur: Draft = [...(d[dk] ?? [{}, {}])] as Draft;
              cur[team] = { ...cur[team], [field]: value };
              const all = { ...d, [dk]: cur };
              saveDrafts(all);
              return all;
            }),
          send: () => {
            const out = toSend(snap.state, drafts[dk] ?? [{}, {}]);
            ([0, 1] as TeamId[]).forEach((team) => Object.keys(out[team]).length && act({ type: "setStats", team, stats: out[team] }));
          },
        }
      : null;
  // from the live match, Next sends the stats first, so they arrive with the wipe
  const homol: HomolDraft | null = snap
    ? {
        draft: homolDraft,
        onScore: (id, value) =>
          setHomolDraft((d) => {
            const all = { ...d, [id]: value };
            try {
              localStorage.setItem(HOMOL_STORE, JSON.stringify(all));
            } catch {}
            return all;
          }),
        send: () => act({ type: "setHomologation", scores: { ...snap.state.homologation, ...homolDraft } }),
      }
    : null;
  const onNext = () => {
    if (view === "game") stats?.send();
    // revealing the homologation scores: they go to the screen with that step
    if (view === "homologation" && (snap?.screen.homol ?? 0) === 0) homol?.send();
    cmd({ type: "next", from: view, homol: snap?.screen.homol ?? 0 });
  };

  return (
    <Shell
      header={
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#010008]/85 px-4 pb-3 pt-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Image src={logo} alt="TRSYP 3.0" className="h-6 w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} priority />
            <span className="flex-1" />
            <StatusPill status={online ? "live" : status === "live" ? "waiting" : "connecting"} />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-dim)]">
              {snap ? (
                <>
                  On screen: <span className="text-white">{overlay ? "Leaderboard" : VIEW_LABEL[snap.screen.view]}</span>
                  {!overlay && snap.screen.view !== "logo" && (
                    <span className="text-[var(--text-faint)]"> · {snap.state.mode === "cup" ? "Champions Cup" : stageTitle(snap.state.game)}</span>
                  )}
                </>
              ) : (
                "Waiting for the screen…"
              )}
            </div>
            {snap &&
              (inMatch ? (
                <Confirm className="ctl-btn min-h-8 rounded-[10px] px-3 text-[12px]" label="Logo" onConfirm={() => cmd({ type: "home" })} />
              ) : (
                <button className="ctl-btn min-h-8 rounded-[10px] px-3 text-[12px]" disabled={view === "logo"} onClick={() => cmd({ type: "home" })}>
                  Logo
                </button>
              ))}
            <button
              className="ctl-btn min-h-8 rounded-[10px] px-3 text-[12px] text-[var(--text-dim)]"
              aria-label="Change the screen key"
              onClick={() => {
                saveKey(null);
                setKey(null);
                setSnap(null);
              }}
            >
              Key
            </button>
          </div>
          {screenCount > 1 && (
            <div className="mt-2.5 rounded-xl border border-[rgba(242,85,107,0.55)] bg-[rgba(242,85,107,0.1)] px-3 py-2 text-[13px] leading-snug text-[var(--cell-red)]" role="alert">
              {screenCount} screens are open with this key and {screenCount === 2 ? "both" : "all"} follow your commands. Close the extra one (another tab, another PC, or an OBS browser source).
            </div>
          )}
        </header>
      }
      footer={
        snap && (
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#010008]/90 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
            <div className="mx-auto grid max-w-[960px] grid-cols-[1fr_2.4fr_1fr] gap-2">
              <button className="ctl-btn px-2" disabled={view === "logo" || overlay} onClick={() => cmd({ type: "prev", from: view, homol: snap?.screen.homol ?? 0 })}>
                <Chevron dir="left" /> Back
              </button>
              <button
                className="ctl-btn ctl-btn--green min-h-14 flex-col gap-0 px-3 leading-tight"
                disabled={overlay || step?.kind === "none"}
                onClick={onNext}
              >
                <span className="flex items-center gap-1 text-[12px] uppercase tracking-[0.12em] opacity-80">
                  Next <Chevron dir="right" />
                </span>
                <span className="line-clamp-2 text-center text-[14px] text-white">{step?.label}</span>
              </button>
              <button className="ctl-btn px-2" data-on={overlay ? "" : undefined} onClick={() => cmd({ type: "overlay", open: !overlay })}>
                Table
              </button>
            </div>
          </nav>
        )
      }
    >
      {!snap ? (
        <Waiting status={status} />
      ) : overlay ? (
        <BoardPanel state={snap.state} act={act} />
      ) : (
        <Panel view={snap.screen.view} state={snap.state} offset={offset} cmd={cmd} act={act} stats={stats} homol={homol} onShow={onNext} onStartOver={startOver} />
      )}
    </Shell>
  );
}

function Panel({
  view, state, offset, cmd, act, stats, homol, onShow, onStartOver,
}: {
  view: View;
  state: GameState;
  offset: number;
  cmd: Send;
  act: Act;
  stats: StatsDraft | null;
  homol: HomolDraft | null;
  onShow: () => void;
  onStartOver: () => void;
}) {
  switch (view) {
    case "logo":
      return (
        <>
          <ProgramPanel state={state} view={view} cmd={cmd} onStartOver={onStartOver} />
          {/* homologation can be scored ahead of time, before it's on screen */}
          {homol && !state.homolDone && <HomologationForm state={state} homol={homol} />}
        </>
      );
    case "homologation":
      return homol ? <HomologationForm state={state} homol={homol} live /> : null;
    case "intro":
      return <ProgramPanel state={state} view={view} cmd={cmd} onStartOver={onStartOver} />;
    case "matches":
      return <MatchesPanel state={state} cmd={cmd} act={act} />;
    case "champion":
      return (
        <Section title="The champion is on screen">
          <p className="text-[15px] text-[var(--text-dim)]">Next goes back to the logo. Back returns to the bracket.</p>
        </Section>
      );
    case "bracket":
      return <BracketPanel state={state} cmd={cmd} act={act} />;
    case "game":
      return (
        <>
          <GamePanel state={state} offset={offset} act={act} />
          {stats && <StatsForm state={state} stats={stats} onUpdate={stats.send} onSend={onShow} sendLabel={state.game === "polygame" ? "Show Phase Stats" : "Show Game Stats"} />}
          {state.game === "garden" && (
            <Section title="Starting chances" aside={<span className="digits text-[20px] text-white">{state.gardenChances}</span>}>
              <p className="-mt-2 mb-3 text-[13px] text-[var(--text-faint)]">For every Garden match not played yet.</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="ctl-btn" disabled={state.gardenChances <= 1} onClick={() => act({ type: "setGardenChances", n: state.gardenChances - 1 })}>
                  − 1
                </button>
                <button className="ctl-btn" disabled={state.gardenChances >= 9} onClick={() => act({ type: "setGardenChances", n: state.gardenChances + 1 })}>
                  + 1
                </button>
              </div>
            </Section>
          )}
        </>
      );
    case "stats":
      return stats ? <StatsForm state={state} stats={stats} onSend={stats.send} sendLabel="Update the screen" /> : null;
    case "final":
      return <FinalPanel state={state} />;
    case "board":
      return <BoardPanel state={state} act={act} />;
  }
}

/* ─── frame ─────────────────────────────────────────────────────────── */

function Shell({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children?: ReactNode }) {
  return (
    <div data-scroll className="fixed inset-0 overflow-y-auto overscroll-contain bg-[var(--bg)]">
      <div className="stage-light" aria-hidden />
      <div className="relative">
        {header}
        <main className="mx-auto max-w-[960px] space-y-4 px-4 pb-36 pt-5">{children}</main>
        {footer}
      </div>
    </div>
  );
}

function Section({ title, aside, children, corner }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; corner?: TeamId }) {
  return (
    <section className="panel p-4 sm:p-5" data-corner={corner}>
      {(title || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="name text-[16px] text-white">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: "live" | "waiting" | "connecting" }) {
  const label = status === "live" ? "Screen live" : status === "waiting" ? "No screen" : "Connecting";
  const cls = status === "live" ? "pill--green" : status === "waiting" ? "pill--red" : "";
  return (
    <span className={`pill shrink-0 text-[11px] ${cls}`}>
      <span className="pill-dot" /> {label}
    </span>
  );
}

function Waiting({ status }: { status: string }) {
  return (
    <Section title="Waiting for the screen">
      <p className="text-[15px] leading-relaxed text-[var(--text-dim)]">
        {status === "live"
          ? "Connected. Open the screen with the same key (once: /?key=…) and it will appear here."
          : "Connecting to the live channel…"}
      </p>
    </Section>
  );
}

function KeyGate({ onKey }: { onKey: (k: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8">
      <Image src={logo} alt="TRSYP 3.0" className="h-10 w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} priority />
      <Section title="Remote control">
        <p className="-mt-1 mb-4 text-[15px] leading-relaxed text-[var(--text-dim)]">Enter the key the main screen was opened with. This phone remembers it.</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim()) onKey(v.trim());
          }}
        >
          <input
            className="ctl-input"
            placeholder="Screen key"
            aria-label="Screen key"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
          <button className="ctl-btn ctl-btn--green min-h-12" type="submit" disabled={!v.trim()}>
            Connect
          </button>
        </form>
      </Section>
    </div>
  );
}

/* ─── navigation screens ────────────────────────────────────────────── */

function ProgramPanel({ state, view, cmd, onStartOver }: { state: GameState; view: View; cmd: Send; onStartOver: () => void }) {
  const progress = (g: GameKind) => {
    if (g === "game3") {
      const champ = cupMatch(state, "final");
      return cupWinner(champ) !== null ? "Champion crowned" : "Semi-finals: 1st v 4th · 2nd v 3rd";
    }
    const list = leagueMatches(state);
    return `${list.filter((m) => m.games[g].committed).length} / ${list.length} matches played`;
  };
  const scored = state.league.filter((l) => (state.homologation[l.id] ?? "") !== "").length;
  return (
    <Section title="Program">
      <ol className="space-y-2">
        <li
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${!state.homolDone ? "border-[rgba(0,232,122,0.4)] bg-[var(--neon-faint)]" : "border-white/[0.06]"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold uppercase tracking-[0.06em] text-white">00 · Homologation</div>
            <div className="text-[13px] text-[var(--text-dim)]">{state.homolDone ? `Shown · ${scored} / ${state.league.length} teams scored` : "Before any game"}</div>
          </div>
          {!state.homolDone ? (
            <span className="pill pill--green text-[11px]">{view === "logo" ? "Up next" : "Not shown"}</span>
          ) : (
            view === "logo" && (
              <button className="ctl-btn min-h-10 px-3 text-[13px]" onClick={() => cmd({ type: "stage", game: "homologation" })}>
                Show again
              </button>
            )
          )}
        </li>
        {STAGES.map((g) => {
          const current = state.homolDone && g === state.game;
          return (
            <li
              key={g}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${current ? "border-[rgba(0,232,122,0.4)] bg-[var(--neon-faint)]" : "border-white/[0.06]"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold uppercase tracking-[0.06em] text-white">{stageTitle(g)}</div>
                <div className="text-[13px] text-[var(--text-dim)]">{progress(g)}</div>
              </div>
              {current ? (
                <span className="pill pill--green text-[11px]">{view === "logo" ? "Up next" : "On screen"}</span>
              ) : (
                <button className="ctl-btn min-h-10 px-3 text-[13px]" onClick={() => cmd({ type: "stage", game: g })}>
                  Jump here
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-[var(--text-faint)]">The show runs in this order on its own: just press Next. Jump only to fix a mistake.</p>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <Confirm className="ctl-btn ctl-btn--danger w-full" label="Start over · clear all results" onConfirm={onStartOver} />
        <p className="mt-2 text-[12px] text-[var(--text-faint)]">
          Clears homologation, every match, the league table and the cup, and puts the logo back on screen. It can&apos;t be undone.
        </p>
      </div>
    </Section>
  );
}

/** Homologation: a score out of 50 per team, private until the screen shows them. */
function HomologationForm({ state, homol, live }: { state: GameState; homol: HomolDraft; live?: boolean }) {
  const teams = [...state.league].sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
  const value = (id: string) => homol.draft[id] ?? state.homologation[id] ?? "";
  const filled = teams.filter((t) => value(t.id) !== "").length;
  const pending = state.homolDone && teams.some((t) => (homol.draft[t.id] ?? state.homologation[t.id] ?? "") !== (state.homologation[t.id] ?? ""));
  return (
    <Section
      title="Homologation"
      aside={
        <span className={`pill text-[11px] ${state.homolDone ? (pending ? "pill--pink" : "pill--green") : ""}`}>
          {state.homolDone ? (pending ? "Not on screen yet" : "Up to date") : `${filled} / ${teams.length} scored`}
        </span>
      }
    >
      <p className="-mt-1 mb-4 text-[14px] text-[var(--text-dim)]">
        A score out of {HOMOL_MAX} per team for meeting the technical specs. Only you see it until the scores are shown; then they count in the league table.
      </p>
      <div className="space-y-2">
        {teams.map((t) => {
          const v = value(t.id);
          const over = v !== "" && (parseFloat(v) > HOMOL_MAX || parseFloat(v) < 0);
          return (
            <label key={t.id} className="grid grid-cols-[auto_1fr_92px] items-center gap-3">
              <Branch id={t.id} height={26} />
              <span className="name min-w-0 truncate text-[14px] text-white">{t.name}</span>
              <span className="relative">
                <input
                  className={`ctl-input pr-10 text-right ${over ? "border-[rgba(242,85,107,0.6)]" : ""}`}
                  value={v}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`${t.name} homologation score`}
                  placeholder="—"
                  onChange={(e) => homol.onScore(t.id, e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-faint)]">/{HOMOL_MAX}</span>
              </span>
            </label>
          );
        })}
      </div>
      {live && state.homolDone && (
        <button className="ctl-btn mt-4 w-full" disabled={!pending} onClick={homol.send}>
          Update on screen
        </button>
      )}
      {live && !state.homolDone && (
        <p className="mt-4 text-[13px] text-[var(--text-faint)]">Next shows these scores on the screen{filled < teams.length ? `; ${teams.length - filled} team${teams.length - filled > 1 ? "s" : ""} not scored yet count as 0` : ""}.</p>
      )}
    </Section>
  );
}

function Pair({ m, game }: { m: Match; game: GameKind }) {
  const teams = m.games[game].teams;
  const done = slotStatus(m.games[game]) === "done";
  return (
    <div className="space-y-1.5">
      {([0, 1] as TeamId[]).map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${i ? "bg-[var(--pink)]" : "bg-[var(--green)]"}`} />
          <span className="min-w-0 flex-1">
            {m.empty ? <span className="text-[var(--text-faint)]">Not set</span> : <FitText text={teams[i].name} size={17} className="name text-white" />}
          </span>
          {done && <span className="digits text-[17px] text-[var(--text-dim)]">{cumulative(m, game, i)}</span>}
        </div>
      ))}
    </div>
  );
}

const STATUS_PILL = { upcoming: ["Upcoming", ""], live: ["Live", "pill--pink"], done: ["Done", "pill--green"] } as const;

function MatchesPanel({ state, cmd, act }: { state: GameState; cmd: Send; act: Act }) {
  const next = nextMatchId(state, state.game);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <h1 className="title text-[20px] text-white">{GAME_INFO[state.game].title}</h1>
      {leagueMatches(state).map((m) => {
        const status = slotStatus(m.games[state.game]);
        const [label, cls] = m.id === next ? (["Next match", "pill--pink"] as const) : STATUS_PILL[status];
        return (
          <Section
            key={m.id}
            title={`Match ${String(m.num).padStart(2, "0")}`}
            aside={<span className={`pill text-[11px] ${m.empty ? "" : cls}`}>{m.empty ? "No teams" : label}</span>}
          >
            <Pair m={m} game={state.game} />
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <button className="ctl-btn" disabled={!!m.empty} onClick={() => cmd({ type: "openMatch", id: m.id })}>
                Jump to this match
              </button>
              <button className="ctl-btn px-4 text-[var(--text-dim)]" data-on={editing === m.id ? "" : undefined} onClick={() => setEditing(editing === m.id ? null : m.id)}>
                Edit
              </button>
            </div>
            {editing === m.id && (
              <>
                <PairEditor
                  state={state}
                  m={m}
                  onSave={(a, b) => {
                    act({ type: "setPair", id: m.id, a, b });
                    setEditing(null);
                  }}
                />
                <Confirm
                  className="ctl-btn ctl-btn--danger mt-2 w-full"
                  label="Clear this match (its points come off the table)"
                  disabled={!!m.empty}
                  onConfirm={() => {
                    act({ type: "clearMatch", id: m.id });
                    setEditing(null);
                  }}
                />
              </>
            )}
          </Section>
        );
      })}
    </div>
  );
}

function PairEditor({ state, m, onSave }: { state: GameState; m: Match; onSave: (a: string, b: string) => void }) {
  const roster = [...state.league].sort((p, q) => parseInt(p.id.slice(1)) - parseInt(q.id.slice(1)));
  const [a, setA] = useState(m.games.polygame.teams[0].leagueId ?? "");
  const [b, setB] = useState(m.games.polygame.teams[1].leagueId ?? "");
  const pick = (v: string, set: (v: string) => void, corner: string) => (
    <select className="ctl-input" value={v} onChange={(e) => set(e.target.value)} aria-label={`${corner} corner`}>
      <option value="">{corner} corner…</option>
      {roster.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="mt-4 grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-[1fr_1fr_auto]">
      {pick(a, setA, "Green")}
      {pick(b, setB, "Pink")}
      <button className="ctl-btn ctl-btn--green" disabled={!a || !b || a === b} onClick={() => onSave(a, b)}>
        Save pair
      </button>
    </div>
  );
}

function BracketPanel({ state, cmd, act }: { state: GameState; cmd: Send; act: Act }) {
  // in playing order: the 3rd place match comes before the final
  const rounds: [CupRound, string][] = CUP_ROUNDS.map((r) => [r, `${CUP_LABEL[r]} · ${GAME_INFO[cupGame(r)].title}`]);
  const locked = CUP_ROUNDS.some((r) => cupStarted(state, r));
  const top4 = state.league.slice(0, 4);
  return (
    <div className="space-y-3">
      <Section title="Semi-finals" aside={<span className={`pill text-[11px] ${locked ? "pill--green" : ""}`}>{locked ? "Fixed" : "From the table"}</span>}>
        <p className="text-[14px] leading-relaxed text-[var(--text-dim)]">
          1st v 4th and 2nd v 3rd, from the league table: <span className="text-white">{top4[0]?.name} v {top4[3]?.name}</span> ·{" "}
          <span className="text-white">{top4[1]?.name} v {top4[2]?.name}</span>.{" "}
          {locked ? "Fixed now the cup has started." : "They follow the table until the first cup match starts."}
        </p>
        <Confirm className="ctl-btn ctl-btn--danger mt-3 w-full" label="Reset the cup results" onConfirm={() => cmd({ type: "cupReset" })} />
      </Section>
      {rounds.map(([r, label]) => {
        const m = cupMatch(state, r);
        const slot = m ? cupSlot(m) : undefined;
        const status = slot ? slotStatus(slot) : "upcoming";
        const tie = status === "done" && cupWinner(m) === null;
        return (
          <Section key={r} title={label} aside={<span className={`pill text-[11px] ${tie ? "pill--red" : STATUS_PILL[status][1]}`}>{tie ? "Tie" : STATUS_PILL[status][0]}</span>}>
            {m && cupSlot(m).teams.some((t) => t.leagueId) ? (
              <Pair m={m} game={cupGame(r)} />
            ) : (
              <p className="text-[15px] text-[var(--text-faint)]">Waiting for the semi-finals</p>
            )}
            <button className="ctl-btn mt-4 w-full" disabled={!canOpen(state, m)} onClick={() => m && cmd({ type: "openMatch", id: m.id })}>
              {m && m.id === nextCupMatch(state)?.id
                ? "Jump to match (or press Next)"
                : r === "final" && m && !m.empty && !canOpen(state, m)
                  ? "After the 3rd place match"
                  : "Jump to match"}
            </button>
            {tie && m && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([0, 1] as TeamId[]).map((i) => (
                  <button key={i} className="ctl-btn" onClick={() => act({ type: "cupPick", id: m.id, team: i })}>
                    {cupSlot(m).teams[i].name} wins
                  </button>
                ))}
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}

/* ─── the live match ────────────────────────────────────────────────── */

function GamePanel({ state, offset, act }: { state: GameState; offset: number; act: Act }) {
  const game = state.game;
  const m = state.current ? state.matches.find((x) => x.id === state.current) : undefined;
  return (
    <div className="space-y-4">
      {game === "polygame" ? (
        <PhaseBar state={state} act={act} />
      ) : (
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <button className="btn-rim min-h-14 px-3 text-[16px] font-semibold uppercase tracking-[0.06em] text-white" onClick={() => act({ type: "startBoth", now: 0 })}>
            Start both timers
          </button>
          <Confirm className="ctl-btn ctl-btn--danger" label="Restart match" onConfirm={() => act({ type: "resetAll" })} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {([0, 1] as TeamId[]).map((id) => (
          <TeamControls key={id} id={id} team={state.teams[id]} game={game} carried={m ? slotCarry(m, game, id) : 0} offset={offset} act={act} />
        ))}
      </div>
      {game === "polygame" && <Boards state={state} act={act} />}
    </div>
  );
}

/** Polygame: the phase both teams are on, and the buttons that move it on. A team's own
    Stop means it finished the phase; End phase closes it for both. */
function PhaseBar({ state, act }: { state: GameState; act: Act }) {
  const done = Math.min(...state.teams.map((t) => t.splits?.length ?? 0));
  const finished = done >= 3;
  const running = state.teams.some((t) => t.timer.running);
  // a phase is on from Start until End (even if both teams already pressed Finished)
  const inPhase = state.teams.some((t) => t.timer.running || t.timer.accumulated > ((t.splits ?? [])[done - 1] ?? 0));
  const phase = Math.min(done + 1, 3);
  return (
    <Section
      title={finished ? "All 3 phases done" : `Phase ${phase} · ${PHASE_NAMES[phase - 1]}`}
      aside={
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 w-8 rounded-full ${i < done ? "bg-[var(--green)]" : i === done && running ? "bg-[var(--green)]/50" : "bg-white/10"}`} />
          ))}
        </div>
      }
    >
      {finished ? (
        <button className="ctl-btn min-h-14 w-full" disabled>
          All 3 phases done
        </button>
      ) : inPhase ? (
        <button className="ctl-btn ctl-btn--danger min-h-14 w-full text-[16px] font-semibold uppercase tracking-[0.06em]" onClick={() => act({ type: "endPhase", now: 0 })}>
          End phase {phase}
        </button>
      ) : (
        <button className="btn-rim min-h-14 w-full px-3 text-[16px] font-semibold uppercase tracking-[0.06em] text-white" onClick={() => act({ type: "startBoth", now: 0 })}>
          Start phase {phase}
        </button>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Confirm className="ctl-btn" label="Undo last phase" disabled={done === 0} onConfirm={() => act({ type: "undoPhase" })} />
        <Confirm className="ctl-btn ctl-btn--danger" label="Restart match" onConfirm={() => act({ type: "resetAll" })} />
      </div>
      <p className="mt-3 text-[13px] text-[var(--text-faint)]">Press a team&apos;s Finished when it completes the phase. End phase stops both and keeps each team&apos;s time.</p>
    </Section>
  );
}

function TeamControls({
  id, team, game, carried, offset, act,
}: { id: TeamId; team: TeamState; game: GameKind; carried: number; offset: number; act: Act }) {
  const [picking, setPicking] = useState(false);
  const splits = team.splits ?? [];
  const phase = Math.min(splits.length + 1, 3);
  const finished = game === "polygame" && splits.length >= 3;
  // a phase is on for this team from Start until End phase
  const teamInPhase = team.timer.accumulated > (splits[splits.length - 1] ?? 0);
  // the clock shows the phase's own time, as on the screen
  const phaseLive = team.timer.running || teamInPhase;
  const since = phaseLive ? (splits[splits.length - 1] ?? 0) : (splits[splits.length - 2] ?? 0);
  return (
    <Section corner={id} title={team.name} aside={<span className={`h-2.5 w-2.5 rotate-45 ${id ? "bg-[var(--pink)]" : "bg-[var(--green)]"}`} />}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="label text-[11px]">
            {game !== "polygame" ? "Timer" : finished ? "All phases done" : phaseLive || !splits.length ? `Phase ${phase}` : `Phase ${splits.length} done`}
          </div>
          <RemoteTimer
            timer={team.timer}
            offset={offset}
            since={game === "polygame" ? since : 0}
          />
        </div>
        <div className="text-right">
          <div className="label text-[11px]">{game === "game3" ? "Score (shown after)" : "Score on screen"}</div>
          <div className={`digits text-[34px] font-bold leading-none ${id ? "text-[var(--pink)]" : "text-[var(--green)]"}`}>{carried + scoreFor(game, team)}</div>
        </div>
      </div>
      {game === "polygame" ? (
        // the phase bar starts and ends phases; here a team only says it's done
        team.timer.running ? (
          <button className="ctl-btn ctl-btn--green mt-4 w-full" onClick={() => act({ type: "stopTimer", team: id, now: 0 })}>
            Finished phase {phase}
          </button>
        ) : teamInPhase ? (
          <button className="ctl-btn mt-4 w-full" onClick={() => act({ type: "toggleTimer", team: id, now: 0 })}>
            Finished · tap to resume
          </button>
        ) : (
          <button className="ctl-btn mt-4 w-full" disabled>
            {finished ? "All phases done" : `Waiting for phase ${phase}`}
          </button>
        )
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={`ctl-btn ${team.timer.running ? "ctl-btn--danger" : "ctl-btn--green"}`}
            onClick={() => act(team.timer.running ? { type: "stopTimer", team: id, now: 0 } : { type: "toggleTimer", team: id, now: 0 })}
          >
            {team.timer.running ? "Stop" : team.timer.accumulated ? "Resume" : "Start"}
          </button>
          <Confirm className="ctl-btn" label="Reset timer" onConfirm={() => act({ type: "resetTimer", team: id })} />
        </div>
      )}
      {game === "game3" && <GlitchButtons id={id} team={team} act={act} />}
      {game === "polygame" && (
        <div className="mt-2">
          {splits.length > 0 && (
            <div className="mt-2 flex gap-2">
              {phaseTimes(team).map((ms, i) => (
                <span key={i} className={`pill text-[11px] ${onTime("polygame", ms) ? "pill--green" : "pill--red"}`}>
                  P{i + 1} {clockText(ms)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {game === "polygame" &&
        (team.pinned ? (
          <Confirm className="ctl-btn ctl-btn--danger mt-2 w-full" label="Pinned · remove the pin" onConfirm={() => act({ type: "unpin", team: id })} />
        ) : (
          <button className="ctl-btn mt-2 w-full" onClick={() => setPicking(true)}>
            Pin and freeze 4 pieces
          </button>
        ))}
      {picking && (
        <FreezePicker
          team={team}
          mirror={id === 1}
          onCancel={() => setPicking(false)}
          onValidate={(ids) => {
            act({ type: "pin", team: id, freeze: ids });
            setPicking(false);
          }}
        />
      )}
      {game === "garden" && (
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button className="ctl-btn" onClick={() => act({ type: "useChance", team: id, delta: -1 })}>
            Use chance
          </button>
          <span className={`digits w-12 text-center text-[28px] font-bold ${team.chances === 0 ? "text-[var(--cell-red)]" : "text-white"}`}>{team.chances}</span>
          <button className="ctl-btn" onClick={() => act({ type: "useChance", team: id, delta: 1 })}>
            Give back
          </button>
        </div>
      )}
    </Section>
  );
}

/** Pinning a team: tap 4 of its unused pieces, then Validate. The screen pins the team and freezes them. */
function FreezePicker({
  team, mirror, onCancel, onValidate,
}: { team: TeamState; mirror: boolean; onCancel: () => void; onValidate: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const free = SHAPES.filter((p) => p.kind !== "green" && (team.shapes[p.id] ?? "normal") === "normal");
  const need = Math.min(4, free.length);
  return (
    <Sheet onClose={onCancel}>
      <div className="name text-[16px] text-white">Pin {team.name}</div>
      <div className="text-[14px] text-[var(--text-dim)]">Tap {need} unused pieces to freeze. They can&apos;t be used for the rest of the match.</div>
      <div className="mt-4 select-none [touch-action:manipulation]">
        <ShapesBoard
          mirror={mirror}
          shapes={team.shapes}
          selected={sel}
          onChange={() => {}}
          onPieceDown={(pid, e) => {
            e.preventDefault();
            if (!free.some((p) => p.id === pid)) return;
            setSel((cur) => (cur.includes(pid) ? cur.filter((x) => x !== pid) : cur.length < need ? [...cur, pid] : cur));
          }}
        />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <button className="ctl-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="ctl-btn ctl-btn--green" disabled={sel.length < need} onClick={() => onValidate(sel)}>
          Validate · {sel.length}/{need}
        </button>
      </div>
    </Sheet>
  );
}

/** Mine: the team's three glitch cards. One tap plays a card on the screen (once per match); a played one can be undone. */
function GlitchButtons({ id, team, act }: { id: TeamId; team: TeamState; act: Act }) {
  return (
    <div className="mt-4">
      <div className="label mb-2 text-[11px]">Glitch cards · once each</div>
      <div className="grid grid-cols-3 gap-2">
        {GLITCH_CARDS.map((c) => {
          const color = c.color === "pink" ? "var(--pink)" : "var(--green)";
          return team.cards?.[c.id] !== undefined ? (
            <Confirm
              key={c.id}
              className="ctl-btn min-h-[104px] px-2 text-[12px] leading-tight text-[var(--text-faint)]"
              label={`${c.name} · played · undo`}
              onConfirm={() => act({ type: "unplayCard", team: id, card: c.id })}
            />
          ) : (
            <button
              key={c.id}
              className="ctl-btn flex min-h-[104px] flex-col items-center justify-center gap-1 px-2"
              style={{ borderColor: color }}
              onClick={() => act({ type: "playCard", team: id, card: c.id, now: 0 })}
            >
              <Image src={c.art} alt="" width={52} height={46} className="h-[46px] w-auto" />
              <span className="text-[12px] font-semibold leading-tight text-white">{c.name}</span>
              <span className="digits text-[12px]" style={{ color }}>
                {c.secs}s
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RemoteTimer({ timer, offset, since = 0, className = "text-[34px]" }: { timer: TimerState; offset: number; since?: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer.running) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [timer.running]);
  // the screen's clock = ours minus the measured offset
  const ms = Math.max(0, Math.max(timer.accumulated, elapsedMs(timer, now - offset)) - since);
  return <div className={`digits leading-none ${className} ${timer.running ? "text-[var(--green)]" : "text-white"}`}>{formatTime(ms)}</div>;
}

/** A piece drawn on its own (for the dragged ghost and the diagonal question). */
function PieceIcon({ id, size, mirror = false }: { id: string; size: number; mirror?: boolean }) {
  const def = SHAPES.find((s) => s.id === id)!;
  const xs = def.points.map((p) => p[0]);
  const ys = def.points.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${x0 - 4} ${y0 - 4} ${Math.max(w, h) + 8} ${Math.max(w, h) + 8}`}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <polygon points={def.points.map((p) => p.join(",")).join(" ")} fill={SHAPE_COLORS[def.kind]} stroke="#1b1430" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** A square split one way, with the half the piece would fill, for the diagonal question. */
function DiagIcon({ diag, half, color }: { diag: Diag; half: 0 | 1; color: string }) {
  const [x1, y1, x2, y2] = DIAG_LINE[diag];
  return (
    <svg viewBox="-1 -1 12 12" className="h-24 w-24" aria-hidden>
      <rect width="10" height="10" fill="var(--cell-white)" rx="0.4" />
      <polygon points={HALVES[diag][half].pts} fill={color} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06120d" strokeWidth={0.45} />
    </svg>
  );
}

type Drag = { id: string; x: number; y: number; over: number | null };
type Drop = { id: string; index: number; px: number; py: number };

/* Polygame boards on the remote. Drag a piece from the shapes board onto a
   grid square: a cube fills the square, a triangle fills half of it (you're
   asked which way the square is split). The piece greys out on the board and
   its number lands on the square. Tap a piece to mark it knocked off; tap a
   square to clear it (its pieces go back to the board). */
function Boards({ state, act }: { state: GameState; act: Act }) {
  const [team, setTeam] = useState<TeamId>(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ask, setAsk] = useState<Drop | null>(null);
  const [clearing, setClearing] = useState<number | null>(null);
  // a green triangle tapped: it freezes the opponent instead of going on the grid
  const [green, setGreen] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const t = state.teams[team];

  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!el || !gridRef.current?.contains(el)) return null;
    const r = el.getBoundingClientRect();
    return { index: Number(el.dataset.cell), px: (x - r.left) / r.width, py: (y - r.top) / r.height };
  };

  const pieceDown = (id: string, e: React.PointerEvent) => {
    const def = SHAPES.find((s) => s.id === id);
    if (!def) return;
    e.preventDefault();
    const st = t.shapes[id] ?? "normal";
    const canDrag = def.kind !== "green" && st !== "removed" && st !== "frozen";
    const [sx, sy] = [e.clientX, e.clientY];
    let dragging = false;
    let moved = false;
    const scroller = document.querySelector<HTMLElement>("[data-scroll]");
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) >= 8) moved = true;
      if (!dragging && (!canDrag || !moved)) return;
      dragging = true;
      ev.preventDefault();
      setDrag({ id, x: ev.clientX, y: ev.clientY, over: cellAt(ev.clientX, ev.clientY)?.index ?? null });
      // keep the grid reachable on a small phone
      if (ev.clientY > window.innerHeight - 140) scroller?.scrollBy(0, 14);
      else if (ev.clientY < 120) scroller?.scrollBy(0, -14);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      // a tap on a green triangle asks to freeze the opponent
      if (!moved && ev.type !== "pointercancel" && def.kind === "green" && (st === "normal" || t.greens?.[id] !== undefined)) return setGreen(id);
      // a tap, or a touch the browser took over: nothing changes
      if (!dragging || ev.type === "pointercancel") return;
      const hit = cellAt(ev.clientX, ev.clientY);
      if (!hit) return;
      if (def.kind.endsWith("cube")) return act({ type: "placeShape", team, shape: id, index: hit.index, half: null });
      // a square holding one triangle: the new one takes the other half, same diagonal
      const cell = toCell(t.grid[hit.index]);
      const taken = cell.full ? [] : ([0, 1] as const).filter((h) => cell.halfLabels[h] && cell.halfLabels[h] !== String(def.num));
      if (taken.length === 1) {
        return act({ type: "placeShape", team, shape: id, index: hit.index, half: taken[0] === 0 ? 1 : 0, diag: cell.diag });
      }
      setAsk({ id, ...hit });
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const askDef = ask ? SHAPES.find((s) => s.id === ask.id)! : null;
  const clearCell = clearing !== null ? toCell(t.grid[clearing]) : null;
  const clearNums = clearCell ? (clearCell.full ? [clearCell.label] : clearCell.halfLabels).filter(Boolean) : [];

  return (
    <Section
      title="Boards"
      corner={team}
      aside={
        <div className="ctl-seg">
          {([0, 1] as TeamId[]).map((i) => (
            <button key={i} data-on={team === i ? "" : undefined} onClick={() => setTeam(i)}>
              {state.teams[i].name}
            </button>
          ))}
        </div>
      }
    >
      <p className="-mt-1 mb-3 text-[13px] leading-snug text-[var(--text-faint)]">
        Drag a piece onto the grid; it turns grey once used. Tap a green triangle to freeze the opponent for {GREEN_FREEZE_SECS} s. Frozen pieces can&apos;t be moved. Tap a square to clear it.
      </p>
      {/* touch-action none: a finger on the board drags a piece instead of scrolling the page */}
      <div className="w-full select-none [-webkit-touch-callout:none] [touch-action:none]">
        <ShapesBoard mirror={team === 1} shapes={t.shapes} onChange={() => {}} onPieceDown={pieceDown} />
      </div>
      <div ref={gridRef} className="mx-auto mt-4 aspect-square w-full max-w-[360px]">
        <ColorGrid
          grid={t.grid}
          active={false}
          highlight={drag?.over ?? null}
          onCell={(i) => {
            const c = toCell(t.grid[i]);
            if (c.full ? c.colors[0] !== 0 : c.colors.some((x) => x !== 0)) setClearing(i);
          }}
          onHalf={() => {}}
          onKey={() => {}}
        />
      </div>

      {/* the piece under the finger, lifted above it so it stays visible */}
      {drag && (
        <div className="pointer-events-none fixed z-50 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]" style={{ left: drag.x - 36, top: drag.y - 96 }}>
          <PieceIcon id={drag.id} size={72} mirror={team === 1} />
        </div>
      )}

      {ask && askDef && (
        <Sheet onClose={() => setAsk(null)}>
          <div className="flex items-center gap-4">
            <PieceIcon id={ask.id} size={48} mirror={team === 1} />
            <div>
              <div className="name text-[16px] text-white">Which triangle?</div>
              <div className="text-[14px] text-[var(--text-dim)]">
                Piece {askDef.num} on square {ask.index + 1}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["/", "\\"] as Diag[]).flatMap((d) =>
              ([0, 1] as const).map((h) => (
                <button
                  key={d + h}
                  aria-label={`${d} ${h === 0 ? "up" : "down"}`}
                  className="ctl-btn h-auto py-4"
                  onClick={() => {
                    act({ type: "placeShape", team, shape: ask.id, index: ask.index, half: h, diag: d });
                    setAsk(null);
                  }}
                >
                  <DiagIcon diag={d} half={h} color={SHAPE_COLORS[askDef.kind]} />
                </button>
              )),
            )}
          </div>
          <button className="ctl-btn mt-3 w-full" onClick={() => setAsk(null)}>
            Cancel
          </button>
        </Sheet>
      )}

      {green && (
        <Sheet onClose={() => setGreen(null)}>
          <div className="flex items-center gap-4">
            <PieceIcon id={green} size={48} mirror={team === 1} />
            {t.greens?.[green] !== undefined ? (
              <div>
                <div className="name text-[16px] text-white">Green triangle played</div>
                <div className="text-[14px] text-[var(--text-dim)]">Played by mistake? Give it back to {t.name}.</div>
              </div>
            ) : (
              <div>
                <div className="name text-[16px] text-white">Freeze {state.teams[team ? 0 : 1].name}</div>
                <div className="text-[14px] text-[var(--text-dim)]">
                  A 5 s countdown runs on the screen, then their robot is frozen for {GREEN_FREEZE_SECS} s. The triangle is used for the rest of the match.
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
            <button className="ctl-btn" onClick={() => setGreen(null)}>
              Cancel
            </button>
            {t.greens?.[green] !== undefined ? (
              <button
                className="ctl-btn"
                onClick={() => {
                  act({ type: "unplayGreen", team, shape: green });
                  setGreen(null);
                }}
              >
                Give it back
              </button>
            ) : (
              <button
                className="ctl-btn ctl-btn--green"
                onClick={() => {
                  act({ type: "playGreen", team, shape: green, now: 0 });
                  setGreen(null);
                }}
              >
                Freeze · {GREEN_FREEZE_SECS} s
              </button>
            )}
          </div>
        </Sheet>
      )}

      {clearing !== null && (
        <Sheet onClose={() => setClearing(null)}>
          <div className="name text-[16px] text-white">Square {clearing + 1}</div>
          <div className="text-[14px] text-[var(--text-dim)]">
            {clearNums.length ? `Piece${clearNums.length > 1 ? "s" : ""} ${clearNums.join(" and ")} go back to the board.` : "Clear this square."}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="ctl-btn" onClick={() => setClearing(null)}>
              Cancel
            </button>
            <button
              className="ctl-btn ctl-btn--danger"
              onClick={() => {
                act({ type: "clearCell", team, index: clearing });
                setClearing(null);
              }}
            >
              Clear square
            </button>
          </div>
        </Sheet>
      )}
    </Section>
  );
}

/** A bottom sheet over the remote. */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  // closes only on a press that started on the backdrop: the click that follows
  // the tap which opened the sheet (on pointerup) must not close it straight away
  const pressed = useRef(false);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onPointerDown={(e) => void (pressed.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressed.current && e.target === e.currentTarget) onClose();
        pressed.current = false;
      }}
    >
      <div
        className="panel w-full max-w-[460px] rounded-b-none p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-b-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── stats, totals, standings ──────────────────────────────────────── */

/** Positions the timers already decide: whoever finished a phase (or the run) faster is 1st. */
function autoPositions(state: GameState, draft: Draft = [{}, {}]): Draft {
  const out: Draft = [{}, {}];
  const set = (field: StatField, a: number, b: number) => {
    if (a <= 0 || b <= 0 || a === b) return;
    out[0][field] = a < b ? "1" : "2";
    out[1][field] = a < b ? "2" : "1";
  };
  const [t0, t1] = state.teams.map((t, id) => ({ ...t, stats: { ...t.stats, ...draft[id] } }));
  if (state.game === "polygame") PHASE_FIELDS.forEach((f, i) => set(f.pos, phaseTimes(t0)[i] ?? 0, phaseTimes(t1)[i] ?? 0));
  else set("position", runTime(t0), runTime(t1));
  return out;
}

/** What the form shows for a field: what's typed, else what the screen has, else what the timers decide. */
const effective = (state: GameState, draft: Draft, id: TeamId, f: StatField) =>
  draft[id][f] ?? (state.teams[id].stats[f] || autoPositions(state, draft)[id][f] || "");

/** The stats to send for each team: the draft, plus the timers' positions where nothing was chosen. */
const toSend = (state: GameState, draft: Draft): Draft => {
  const auto = autoPositions(state, draft);
  return ([0, 1] as TeamId[]).map((id) => {
    const out: Partial<TeamStats> = { ...draft[id] };
    for (const [f, v] of Object.entries(auto[id]) as [StatField, string][]) if (out[f] === undefined && !state.teams[id].stats[f]) out[f] = v;
    return out;
  }) as Draft;
};

function StatsForm({
  state, stats, onSend, sendLabel, onUpdate,
}: { state: GameState; stats: StatsDraft; onSend: () => void; sendLabel: string; onUpdate?: () => void }) {
  const game = state.game;
  const v = (id: TeamId, f: StatField) => effective(state, stats.draft, id, f);
  // Polygame: only the phases reached so far; finished ones fold to a line
  const done = Math.min(...state.teams.map((t) => t.splits?.length ?? 0));
  const inPhase = state.teams.some((t) => t.timer.running || t.timer.accumulated > ((t.splits ?? [])[done - 1] ?? 0));
  // the phase being scored: the one running, else the one that just ended
  const current = Math.min(inPhase ? done : Math.max(done - 1, 0), 2);
  const [opened, setOpened] = useState<number[]>([]);
  const other = (id: TeamId): TeamId => (id === 0 ? 1 : 0);
  // 1st for one team is 2nd for the other
  const setPlace = (id: TeamId, f: StatField, p: string) => {
    stats.onField(id, f, p);
    stats.onField(other(id), f, p === "1" ? "2" : "1");
  };
  const preview = (id: TeamId): TeamState => ({
    ...state.teams[id],
    stats: { ...state.teams[id].stats, ...toSend(state, stats.draft)[id] },
  });
  const pending = ([0, 1] as TeamId[]).some((id) =>
    Object.entries(toSend(state, stats.draft)[id]).some(([f, val]) => val !== state.teams[id].stats[f as StatField]),
  );

  const place = (id: TeamId, f: StatField) => (
    <div className="ctl-seg w-full">
      {(["1", "2"] as const).map((p) => (
        <button key={p} data-on={v(id, f) === p ? "" : undefined} onClick={() => setPlace(id, f, p)}>
          {p === "1" ? "1st" : "2nd"}
        </button>
      ))}
    </div>
  );
  /** A time: the timer's reading, which can be corrected (clear it to go back to the timer). */
  const time = (id: TeamId, f: StatField, measured: number) => {
    const typed = v(id, f);
    const read = parseClock(typed);
    const bad = !!typed && read === null;
    const ms = read ?? measured;
    return (
      <div>
        <div className="relative">
          <input
            className={`ctl-input digits pr-[96px] ${bad ? "border-[rgba(242,85,107,0.6)]" : ""}`}
            value={typed}
            inputMode="decimal"
            autoComplete="off"
            aria-label="Time"
            aria-invalid={bad}
            placeholder={measured > 0 ? clockText(measured) : "m.ss"}
            onChange={(e) => stats.onField(id, f, e.target.value.replace(/[^\d:.,]/g, "").slice(0, 7))}
            // tidy to m:ss once it's typed, so what's sent is unambiguous
            onBlur={() => read !== null && stats.onField(id, f, clockText(read))}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px]">
            {bad ? (
              <span className="text-[var(--cell-red)]">not a time</span>
            ) : ms > 0 ? (
              <span className={onTime(game, ms) ? "text-[var(--green)]" : "text-[var(--cell-red)]"}>
                {onTime(game, ms) ? "<" : ">"} {limitText(game)}
              </span>
            ) : (
              <span className="text-[var(--text-faint)]">no time</span>
            )}
          </span>
        </div>
        {/* what the typed time was read as: 5.20 → 5:20 */}
        {typed && (
          <span className="mt-1 block text-[12px] text-[var(--text-faint)]">
            {bad ? "Type minutes and seconds, like 4.35 or 4:35" : `Edited · read as ${clockText(ms)} · timer said ${measured > 0 ? clockText(measured) : "nothing"}`}
          </span>
        )}
      </div>
    );
  };
  const field = (label: string, control: ReactNode, wide = false) => (
    <div className={wide ? "col-span-2" : ""}>
      <span className="label mb-1 block text-[11px]">{label}</span>
      {control}
    </div>
  );

  return (
    <Section
      title={game === "polygame" ? "Phase Stats" : "Game Stats details"}
      aside={<span className={`pill text-[11px] ${pending ? "pill--pink" : "pill--green"}`}>{pending ? "Not on screen yet" : "Up to date"}</span>}
    >
      <p className="-mt-1 mb-4 text-[14px] text-[var(--text-dim)]">
        Only you see this form until you send it. Times come from the timers (type to correct one); scores follow the scoring system.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {([0, 1] as TeamId[]).map((id) => {
          const team = state.teams[id];
          return (
            <div key={id}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${id ? "bg-[var(--pink)]" : "bg-[var(--green)]"}`} />
                <span className="name min-w-0 flex-1 truncate text-[14px] text-white">{team.name}</span>
                <span className={`digits text-[20px] font-bold ${id ? "text-[var(--pink)]" : "text-[var(--green)]"}`}>{scoreFor(game, preview(id))} pts</span>
              </div>
              {game === "polygame" ? (
                <div className="space-y-3">
                  {PHASE_FIELDS.map((f, i) =>
                    i > current ? null : i < current && !opened.includes(i) ? (
                      <button
                        key={i}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] px-3 py-2.5 text-left"
                        onClick={() => setOpened((o) => [...o, i])}
                      >
                        <span className="text-[14px] font-semibold text-white">
                          Phase {i + 1} <span className="font-normal text-[var(--text-dim)]">· {v(id, f.pos) === "1" ? "1st" : v(id, f.pos) === "2" ? "2nd" : "—"} · acc {v(id, f.acc) || "—"}</span>
                        </span>
                        <span className="digits text-[14px] text-[var(--text-dim)]">{phaseScore(preview(id), i)} pts · edit</span>
                      </button>
                    ) : (
                    <div key={i} className={`rounded-2xl border p-3 ${i === current ? "border-[rgba(0,232,122,0.3)]" : "border-white/[0.06]"}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-white">
                          Phase {i + 1} <span className="font-normal text-[var(--text-dim)]">· {PHASE_NAMES[i]}</span>
                        </span>
                        <span className="digits text-[14px] text-[var(--text-dim)]">{phaseScore(preview(id), i)} pts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {field("Time", time(id, TIME_FIELDS[i], timerPhaseTimes(team)[i] ?? 0), true)}
                        {field("Position", place(id, f.pos))}
                        {field(
                          `Accuracy /${MAX_ACCURACY}`,
                          <input
                            className="ctl-input"
                            value={v(id, f.acc)}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`Phase ${i + 1} accuracy`}
                            placeholder="0–20"
                            onChange={(e) => stats.onField(id, f.acc, e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                          />,
                        )}
                      </div>
                    </div>
                  ),
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {field("Time", time(id, "time", team.timer.accumulated), true)}
                  {field("Position", place(id, "position"), true)}
                  {game === "garden" ? (
                    <>
                      {field(
                        "Attempt that worked",
                        <div className="ctl-seg w-full">
                          {(["1", "2", "3"] as const).map((p) => (
                            <button key={p} data-on={v(id, "attempt") === p ? "" : undefined} onClick={() => stats.onField(id, "attempt", p)}>
                              {p === "1" ? "1st +20" : p === "2" ? "2nd +10" : "3rd +0"}
                            </button>
                          ))}
                        </div>,
                        true,
                      )}
                      {field("Scans out of order (−20 each)", <Stepper value={v(id, "scans")} onChange={(n) => stats.onField(id, "scans", n)} />, true)}
                    </>
                  ) : (
                    <>
                      {field("Edge contact (−1)", <Stepper value={v(id, "edge")} onChange={(n) => stats.onField(id, "edge", n)} />)}
                      {field("Cube drop (−2)", <Stepper value={v(id, "cube")} onChange={(n) => stats.onField(id, "cube", n)} />)}
                      {field("Mine contact (−3)", <Stepper value={v(id, "mine")} onChange={(n) => stats.onField(id, "mine", n)} />)}
                      {field(
                        "Unsafe line (−30)",
                        <div className="ctl-seg w-full">
                          {(["", "1"] as const).map((p) => (
                            <button key={p || "no"} data-on={v(id, "penalty") === p ? "" : undefined} onClick={() => stats.onField(id, "penalty", p)}>
                              {p ? "Yes" : "No"}
                            </button>
                          ))}
                        </div>,
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={`mt-5 grid gap-2 ${onUpdate ? "sm:grid-cols-2" : ""}`}>
        {onUpdate && (
          <button className="ctl-btn min-h-14 text-[15px] font-semibold" disabled={!pending} onClick={onUpdate}>
            Update on screen
          </button>
        )}
        <button className="btn-rim min-h-14 text-[15px] font-semibold uppercase tracking-[0.06em] text-white" onClick={onSend}>
          {sendLabel}
        </button>
      </div>
    </Section>
  );
}

/** − n + for a count. */
function Stepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Math.max(0, parseInt(value || "0", 10) || 0);
  return (
    <div className="grid grid-cols-[48px_1fr_48px] items-center gap-1">
      <button className="ctl-btn px-0 text-[20px]" disabled={n === 0} onClick={() => onChange(String(n - 1))} aria-label="One less">
        −
      </button>
      <span className="digits text-center text-[22px] text-white">{n}</span>
      <button className="ctl-btn px-0 text-[20px]" onClick={() => onChange(String(n + 1))} aria-label="One more">
        +
      </button>
    </div>
  );
}

function FinalPanel({ state }: { state: GameState }) {
  return (
    <Section title={`${GAME_INFO[state.game].title} score`}>
      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as TeamId[]).map((id) => (
          <div key={id} className={id ? "text-right" : ""}>
            <div className="name truncate text-[15px] text-white">{state.teams[id].name}</div>
            <div className={`digits text-[40px] font-bold ${id ? "text-[var(--pink)]" : "text-[var(--green)]"}`}>{scoreFor(state.game, state.teams[id])}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BoardPanel({ state, act }: { state: GameState; act: Act }) {
  return (
    <Section title="Leaderboard">
      <ol className="divide-y divide-white/[0.06]">
        {state.league.map((t, i) => (
          <li key={t.id} className="grid grid-cols-[2rem_1fr_6rem] items-center gap-3 py-2">
            <span className="digits text-[16px] text-[var(--text-faint)]">{i + 1}</span>
            <RemoteInput
              value={t.name}
              className="name text-[15px]"
              commitOnBlur
              onValue={(v) => v.trim() && act({ type: "renameLeague", id: t.id, name: v.trim().toUpperCase() })}
            />
            <RemoteInput
              value={String(t.points)}
              inputMode="numeric"
              className="text-right"
              commitOnBlur
              onValue={(v) => act({ type: "setLeaguePoints", id: t.id, points: parseInt(v, 10) || 0 })}
            />
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ─── bits ──────────────────────────────────────────────────────────── */

/** A field that sends as you type (or on blur), and follows the screen's value while not being edited. */
function RemoteInput({
  value, onValue, inputMode, placeholder, className = "", autoFocus, commitOnBlur,
}: {
  value: string;
  onValue: (v: string) => void;
  inputMode?: "text" | "numeric" | "decimal";
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  commitOnBlur?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      className={`ctl-input ${className}`}
      value={draft ?? value}
      inputMode={inputMode}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      onFocus={() => setDraft(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (!commitOnBlur) onValue(e.target.value);
      }}
      onBlur={() => {
        if (commitOnBlur && draft !== null && draft !== value) onValue(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && ref.current?.blur()}
    />
  );
}

/** Two taps within 3 s: the first arms it, the second does it. */
function Confirm({ label, onConfirm, className, disabled }: { label: string; onConfirm: () => void; className: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      disabled={disabled}
      data-on={armed ? "" : undefined}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? "Tap again" : label}
    </button>
  );
}

function Chevron({ dir }: { dir: "up" | "left" | "right" }) {
  const d = dir === "up" ? "m6 15 6-6 6 6" : dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
