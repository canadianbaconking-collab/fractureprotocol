# Fracture Protocol Prototype

A deterministic, web-first 2D puzzle prototype for an Android-friendly layout.

## Core Loop
1. Place one module on the 8x8 grid.
2. Resolve module effect.
3. Tick/spawn hazards.
4. Increase pressure.
5. Apply integrity damage.
6. Update containment state (NORMAL/WARNING/CRITICAL/BREACH).
7. Check win/loss.

## Implemented V1 Content
- Modules (Set A): **Brace**, **Shield Core**, **Purge**, **Pump**, **Cycler**.
- Hazards: **Corruption** (orthogonal spread), **Leak** (integrity damage each turn).
- Win condition: survive configurable `winTurns`.
- Loss condition: `integrity <= 0` or `pressure >= 100` (plus no legal moves).

## Project Layout
- `src/game/`: pure deterministic game logic and reducer.
- `src/ui/`: browser UI shell and renderer.
- `tests/`: unit tests for turn flow, hazard spread, and end conditions.
- `scripts/simulate.js`: runs 100 deterministic heuristic playthroughs and prints aggregate metrics.

## Commands
- `npm test` — run unit tests.
- `npm run simulate` — run batch simulation harness.
- `npm start` — launch local web server at `http://localhost:4173`.
