import { HOMOL_MAX, type GameKind } from "@/lib/game";
import { RAIL } from "@/lib/flow";

/* A stage's opener: 00 Homologation, then each game. The title builds itself
   letter by letter over a sweeping line, a huge outlined number sits behind
   it, and a rail across the top shows where the show is
   (00 Homologation · 01 Polygame · 02 Garden · 03 Champions Cup).
   `on` plays it in; off clears it away. */

type Stage = "homologation" | GameKind;

const SUB: Record<Stage, string> = {
  homologation: `Every robot checked against the technical specs · up to ${HOMOL_MAX} points`,
  polygame: "League · 4 matches",
  garden: "League · 4 matches",
  game3: "Semi-finals in Mine · 3rd place and final in Polygame",
};

export default function StageScreen({ on, game }: { on: boolean; game: Stage }) {
  const here = RAIL.findIndex((r) => r.key === game);
  const { num, name: title } = RAIL[here];
  let c = 0;
  return (
    <div className={`stage absolute inset-0 overflow-hidden ${on ? "stage-on" : ""}`} aria-hidden={!on}>
      {/* the stage number, huge and outlined, behind everything */}
      <span className="stage-num digits absolute leading-none" aria-hidden>
        {num}
      </span>

      {/* where the show is */}
      <ol className="stage-rail absolute left-[200px] right-[200px] top-[110px] grid grid-cols-4 gap-6">
        {RAIL.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-3" data-state={i < here ? "done" : i === here ? "now" : "later"}>
            <span className="stage-rail-bar h-[3px] rounded-full" />
            <span className="flex items-baseline gap-3 whitespace-nowrap text-[20px] font-semibold uppercase tracking-[0.12em]">
              <span className="digits">{r.num}</span>
              {r.name}
            </span>
          </li>
        ))}
      </ol>

      {/* the title */}
      <div className="absolute left-[200px] top-1/2 -translate-y-1/2">
        <span className="stage-kicker digits block text-[44px] font-bold text-[var(--pink)]">{num}</span>
        <h1
          className="title mt-2 whitespace-nowrap leading-[0.95] text-white"
          style={{ fontSize: title.length > 10 ? 140 : 200, textShadow: "0 0 70px rgba(0,232,122,0.3)" }}
        >
          {[...title].map((ch) => (
            <span key={c} className="stage-char" style={{ "--c": c++ } as React.CSSProperties}>
              {/* a plain space would collapse inside its own box */}
              {ch === " " ? <>&nbsp;</> : ch}
            </span>
          ))}
        </h1>
        <span className="stage-line mt-10 block h-[3px] w-[980px] rounded-full" />
        <span className="stage-sub mt-8 block text-[36px] font-medium text-[var(--text-dim)]">{SUB[game]}</span>
      </div>
    </div>
  );
}
