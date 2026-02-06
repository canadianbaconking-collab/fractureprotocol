# Fracture Protocol Prototype

Deterministic, reducer-driven neon containment puzzle prototype (web-first + Android packaging path).

## Gameplay model
- 8x8 grid, deterministic seeded RNG, pure reducer state transitions.
- Stats: `pressure` (0..100), `integrity` (0..100), `turn`.
- Containment states: `NORMAL`, `WARNING`, `CRITICAL`, `BREACH`.
- Win: survive `winTurns` turns.
- Loss: integrity reaches `0`, pressure reaches `100`, or no legal move.

## How to Play
Place modules onto the 8x8 grid during the PLAYING phase while three deterministic tray modules are active; shielded tiles help mitigate hazards, you win by surviving `winTurns` turns, and you lose at Integrity 0 or Pressure 100. Module quick brief: Brace locks down space, Shield Core is a 1x1 core that shields adjacent tiles, Purge clears hazards in a 3x3 zone, Pump lowers pressure immediately, and Cycler rerolls the active tray modules.

## Module Set A
Bottom tray shows 5 module cards, with **3 deterministic tray entries active at a time**.

1. **Brace**: place polyomino brace shapes (extensible shape library).
2. **Shield Core**: place 1x1 core; adjacent filled tiles become shielded.
3. **Purge Unit**: clears hazards in a **3x3 centered** pattern.
4. **Pump**: immediate pressure reduction (`-8`, floor `0`).
5. **Cycler**: rerolls all 3 tray entries from the seeded RNG stream.

## Hazards
- **Corruption**: spreads orthogonally into empty, unshielded tiles each turn (seed-deterministic).
- **Leak**: applies integrity damage per leak each turn; shielded leaks are mitigated.

## Onboarding hazard ramp
Early turns ease new players into containment management without changing deterministic behavior. Turn-based modifiers apply to hazard spawning, leak damage, and early pressure gain:
- **Turns 1–3:** corruption spawn disabled, leak damage ×0.3, reduced pressure tick.
- **Turns 4–7:** reduced corruption spawn, leak damage ×0.5.
- **Turns 8–10:** near-normal hazard behavior with ×0.8 multipliers.
- **Turn 11+:** full baseline behavior.

## Run / Test / Simulate
- `npm start` — web dev server (`http://localhost:4173`).
- `npm test` — headless unit tests (no DOM dependency).
- `npm run simulate` — 100 seeded heuristic playthroughs with aggregate metrics.
- `npm run build` — create web bundle in `dist/`.

## Capacitor / Android
> Note: In restricted environments without npm registry access, installing Capacitor packages may fail. The repo is configured for Capacitor, but dependency installation is required before sync/open.

1. Install deps: `npm install`
2. Sync web build to native project: `npm run cap:sync`
3. Open Android Studio project: `npm run cap:open-android`

Config defaults:
- App name: `Fracture Protocol`
- Package id: `com.frostedlogic.fractureprotocol` (editable in `capacitor.config.ts`)
- Splash setup: launch branding configured via Capacitor SplashScreen plugin settings.

### Android artifact outputs (after Android Studio build)
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### Signing notes (Android Studio)
- Build > Generate Signed Bundle / APK > Android App Bundle.
- Use/produce a keystore and alias.
- Keep `keystore.jks` out of git; store passwords in local secure storage / CI secrets.

BUILD_ID: 2026-02-05T05:08:46Z
