# TRSYP 3.0 — Game screens

Live match screens for the TRSYP 3.0 robotics competition. Built screen by screen, merged later.

## Page −1 — Games

The app opens on the three games: **01 Polygame**, **02 Garden**, **03 Mine**. Click a game to zoom into its match list. The same pairs of teams play every game in order, and **scores carry over**: a team starts Garden with its Polygame total. `Z` always goes up one level (match → match list → games).

## Screen 0 — Matches

The app opens on a grid of match cards ("CUBOT VS TEST 2"), each with a status — UPCOMING, LIVE (opened) or DONE (its points are on the leaderboard) — and the final totals once done. Click a card: the stage zooms into it and it becomes the Polygame screen for that match. `Z` zooms back out to the list from any screen.

- `N` — new match, then press `1`–`9` for team A and again for team B (Backspace undo, Esc cancel)
- Hover a card + `Delete` twice — remove it (a DONE match's points are taken back off the leaderboard)

Every match keeps its own boards, timers and stats. Reopening a DONE match and correcting a score makes the leaderboard apply only the difference (games played isn't counted twice). `Shift+X` twice restarts the open match and takes its points back off.

## Screen 1 — Polygame

A fixed 1920×1080 stage that scales to the window. Two teams, each with:

- **Camera placeholder** — the live video is laid over it when screen sharing.
- **Shapes board** — 35 pieces in a flat top view (5 columns × green triangle, red/blue top triangle, red/blue cube, red/blue bottom triangle). Pieces are numbered 1–30 zigzagging down each column (greens unnumbered). Left click removes a piece (dashed outline stays; left click again brings it back). Right click greys it (right click again restores).
- **5×5 grid** — each square is split on its diagonal into two triangles. Left click colours the whole square (no diagonal shown), right click colours one triangle (the diagonal stays, drawn clearly). Colours cycle white → red → blue → white. To number a square, hover it and type digits: a full square gets one number, a split square gets one per triangle. `Backspace` deletes a digit, `Delete` clears.
- **Timer** (counts up) and **current total** (manual).
- **PINNED** — `R` (team 1) / `U` (team 2) puts a red "PINNED" badge with a pin icon on that team's camera; press again or click the badge to remove it.

State is saved in the browser, so a refresh mid-match keeps everything.

## Screen 2 — Phase Stats

Press `→` on the Polygame screen: a neon scan bar wipes it away, then the stats table draws itself line by line, team names glitch in and numbers count up. `←` plays it in reverse.

Each team shows Time (compared against a fixed 5:00 — green "<" under, red ">" over), Position and Accuracy, each with a bonus typed by hand, Phase 1–3 scores and the **total score** (= Phase 1 + Phase 2 + Phase 3). Everything is typed by hand: hover a value and type (digits `:` `.` `%` `-`). `Backspace` deletes, `Delete` clears. Position shows as 1st / 2nd…, and accuracy gets a `%` automatically.

## Screen 3 — Game Stats

Press `→` again from Phase Stats. Shows each team's **total score** (taken from Phase Stats). 2 seconds after the scores finish counting, the reveal plays: a line sweeps across, "THE DOMINANT TEAM IS" decodes, and the leading team's name slams in with a shockwave, particle burst and screen shake. The leading score pulses and the other team dims. A tie shows "IT'S A DRAW". `←` goes back one screen.

## Screen 4 — Leaderboard

Press `→` from Game Stats. All 9 teams (placeholders for now; everyone starts on 0 with CUBOT 6th), ranked by points, with games played. The first time it opens after a match, it shows the old standings, then 3 s later each playing team's Game Stats total is added: points count up, a `+N` badge pops, rows slide to their new places and ▲/▼ show how far each team moved. Teams are matched by name to the two Polygame teams. Each match is added only once; equal points keep the previous order.

Fix things by hand: hover a team's points and type; double-click a name to rename. `Shift+X` twice starts a new match (clears boards, timers, points and stats, keeps the leaderboard).

## Game 2 — Garden

Same screen as Polygame, but under each camera there's a big **CHANCES LEFT** number instead of the shapes and grid. Left-click it (or `E` team 1 / `I` team 2) to use a chance, right-click (or `D` / `J`) to give one back. At 0 it turns red and **OUT** flashes. `Shift+1–9` sets the starting chances for every Garden match. The current total starts at the team's Polygame total.

Flow: Garden → **Game Stats details** (Time + bonus, Position 1st/2nd + bonus, **Final score**) → **Game Stats** (cumulative total and the dominant team) → **Leaderboard** (adds only the Garden final score).

## Game 3 — Mine

Same screen with only the cameras and the timer / current total (empty space below the cameras). The current total starts at Polygame + Garden. Flow: Mine → **Game Stats details** (Time + bonus, Edge contact, Cube drop, Mine contact, **Final score**) → **Game Stats** (cumulative total, dominant team) → **Leaderboard** (adds only the Mine final score).

The **Final score** on the details screens is typed by hovering it; until something is typed it shows (dimmed) the game's current total, and that is what's used.

## Sound

All sound effects are synthesised in the browser (Web Audio, no files): timer beeps, point blips, shape zaps, grid ticks, the scan-bar whoosh, line-drawing scribble, count-up ticks, the decoder chatter and the big slam on the dominant team, and leaderboard chimes / slides. `M` mutes (a small "Muted" tag shows bottom-right). Sound starts after the first key press. When screen sharing, enable "share sound".

### Keyboard

| Action | Team 1 | Team 2 |
| --- | --- | --- |
| Stop timer | `Q` | `P` |
| Reset timer | `A` | `L` |
| Points +1 (Shift = +5) | `W` | `O` |
| Points −1 (Shift = −5) | `S` | `K` |

- `→` / `←` — next / previous screen (Polygame → Phase Stats → Game Stats → Leaderboard)
- `Space` — start both timers at the same instant (a stopped one resumes); each team is stopped with its own key
- `Shift+X` twice within 2 s — restart the open match
- `Z` — back to the match list
- `H` — show / hide the controls panel
- `M` — mute / unmute sound
- Double-click a team name to rename it (defaults: CUBOT, TEST 2)

## Run

```bash
npm install
npm run dev
```
