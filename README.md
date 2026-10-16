# TRSYP 3.0 — Game screens

Live match screens for the TRSYP 3.0 robotics competition. Built screen by screen, merged later.

## Screen 1 — Polygame

A fixed 1920×1080 stage that scales to the window. Two teams, each with:

- **Camera placeholder** — the live video is laid over it when screen sharing.
- **Shapes board** — 35 pieces in a flat top view (5 columns × green triangle, red/blue top triangle, red/blue cube, red/blue bottom triangle). Pieces are numbered 1–30 zigzagging down each column (greens unnumbered). Left click removes a piece (dashed outline stays; left click again brings it back). Right click greys it (right click again restores).
- **5×5 grid** — each square is split on its diagonal into two triangles. Left click colours the whole square (no diagonal shown), right click colours one triangle (the diagonal stays, drawn clearly). Colours cycle white → red → blue → white. To number a square, hover it and type digits: a full square gets one number, a split square gets one per triangle. `Backspace` deletes a digit, `Delete` clears.
- **Timer** (counts up) and **current total** (manual).

State is saved in the browser, so a refresh mid-match keeps everything.

### Keyboard

| Action | Team 1 | Team 2 |
| --- | --- | --- |
| Start / pause timer | `Q` | `P` |
| Reset timer | `A` | `L` |
| Points +1 (Shift = +5) | `W` | `O` |
| Points −1 (Shift = −5) | `S` | `K` |

- `Space` — start / pause both timers
- `Shift+X` twice within 2 s — reset everything
- `H` — show / hide the controls panel
- Double-click a team name to rename it (defaults: CUBOT, TEST 2)

## Run

```bash
npm install
npm run dev
```
