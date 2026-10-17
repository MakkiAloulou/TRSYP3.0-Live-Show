# TRSYP 3.0 — live screens

Two pages:

- **`/` — the main screen**, shown on the event's big screen. A fixed 1920×1080 stage that scales to the window. It shows only what the audience should see: no buttons, hints or forms. It holds the whole game and saves it in its browser, so a refresh keeps everything.
- **`/control` — the remote**, on a phone or a PC. Every command and every form lives here. Scores are typed privately and reach the screen only when you show them.

## Connecting

The two talk over a Supabase Realtime channel (nothing is stored on Supabase). The channel name comes from a secret key you choose:

1. On the screen PC open `http://localhost:3000/?key=YOUR-KEY` once. The key is remembered.
2. On the phone (same network) open `http://<PC's IP>:3000/control`, type the same key and press Connect. The header turns to **Screen live**.

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key only).

## The show

The order is fixed. On the remote, **Next** always does the next thing and says what it is ("Start 00 · Homologation", "Show Phase Stats", ...). **Back** steps back. The Program panel can jump to a stage, but only use it to fix a mistake.

1. **Logo**: the TRSYP logo, big.
2. **00 · Homologation**: done once, before any game.
   Each robot is checked against the technical specs and gets **0–50 points**.
   - Type the eight scores on the remote. You can do this in advance while the logo is up.
   - Next plays the opener, then **shows the scores**: they count up with a bar per team.
   - The points go into the league table at that moment. Next then shows the **leaderboard** with a `+N` badge per team.
   - To correct a score later, change it and press **Update on screen**. Only the difference is applied.
3. **01 · Polygame**: title card → line-up of the 4 league matches (pairs from the admin-portal draw).
   - Each match is played with its 3 phases in one go: live screen → Phase Stats → Game Stats → leaderboard → back to the line-up.
4. **02 · Garden**: same pairs, same flow. Its Game Stats details screen shows time, position and the final score.
5. **03 · Champions Cup**: the league's top 4, always **1st v 4th** and **2nd v 3rd**.
   - The pairs follow the table until the first cup match is opened.
   - Semi-finals are played in **Mine**. Then come the **3rd place match** and the **final**, both in **Polygame**.
   - Cup scores never touch the league table. After the final, Next crowns the champion, then returns to the logo.

**Table** on the remote shows the full leaderboard over any screen. It never adds points.

## During a match (remote)

- **Phases**: one Start / End button for both teams. Ending a phase records each team's time from its timer. Undo and Restart are also on the remote. Each team can also stop its own timer ("Finished") or resume it.
- **Polygame boards**: drag a piece from a team's shapes onto its 5×5 grid (works with touch).
  - Dropping a triangle asks for one of its 4 orientations.
  - A used piece turns grey and stays used for all 3 phases.
  - Green triangles never go on the grid. Tap one to freeze the opponent's robot for 20 s.
    - The triangle greys out for the rest of the match.
    - On the screen, frost sweeps the frozen team's boards and its timer panel ices over with a 20 s countdown.
    - Tap a played green to give it back.
- **Pin**: choose 4 unused pieces of the pinned team and validate. The screen plays a freeze animation.
  - Frozen pieces cannot be used. They stay frozen after unpinning and through all 3 phases.
- **Stats**: filled privately per phase, then **Show** puts them on the screen.
  - Times come from the timers and can be edited. A phone can type `4.12`, `412` or `5` for 4:12 / 4:12 / 5:00.
  - Editing stats that are already on screen shows an "updated" toast.
- **Garden**: chances left per team. Starting chances apply to every Garden match not played yet.
- **Mine**: the screen shows each team's three glitch cards above its timer, and no score (the score comes with Game Stats).
  - The cards are Signal Jam (5 s), Blind Pilot (15 s) and One Hand Control (15 s).
  - Tap a card on the remote to play it. It can be played once per match.
  - On the screen the card glitches in and counts down. The opponent's timer shows the card's name and the seconds left.
  - When the effect ends, the card greys out as Used. Played by mistake? Tap it twice on the remote to undo.

The camera areas are left empty on purpose: OBS lays the live streams over them.

## Scoring (from "Scoring system.pdf")

| Game | Position, on time | Position, late | Other |
| --- | --- | --- | --- |
| Polygame, per phase (limit 5:00) | 1st 30 · 2nd 10 | 1st 20 · 2nd 0 | accuracy up to 20 |
| Garden (limit 3:00) | 1st 30 · 2nd 15 | 1st 15 · 2nd 0 | attempt 1st +20 · 2nd +10 · 3rd 0; wrong scanning order −20 each |
| Mine (limit 3:00) | 1st 30 · 2nd 20 | 1st 20 · 2nd 0 | edge −1 · cube drop −2 · mine −3 each; unsafe line −30 |

Homologation adds 0–50 to each team's league points before the first game. Game Stats shows the score of the game just played. The dominant team appears in its own corner colour.

## Keyboard on the screen PC (backup)

`→` / `←` next / back · `Home` logo · `Tab` leaderboard (Tab / Esc closes) · `Z` from a match back to the line-up.

## Run

```bash
pnpm install
pnpm dev      # the phone needs the PC's port 3000 open on a private network
pnpm build && pnpm start   # for the event
```
