# GHQ value model

The value model predicts the probability that a specified player eventually
wins from a completed-turn position. It is trained from saved human games but
served as plain TypeScript and JSON, so production inference does not require
Python or a native machine-learning runtime.

## Data policy

- Only decisive HQ-capture and resignation games are included. Timeouts and
  draws are excluded because the target is board strength rather than clock
  state.
- Undo/redo actions are resolved before replay.
- Start-of-turn captures are restored from `historyLog`.
- Samples are created only after committed turns.
- Every position is represented from both players' perspectives.
- Train, validation, and test sets are split chronologically by whole game.
  Positions from one game can never leak across splits.
- Each game receives equal aggregate sample weight, so unusually long games do
  not dominate training.

## Train locally

Training is an offline build step. Runtime inference remains Vercel-compatible.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-train.txt

pnpm value:positions -- \
  --games-csv /path/to/Games_rows.csv \
  --output .data/value-positions.jsonl

pnpm value:features -- \
  --positions .data/value-positions.jsonl \
  --output .data/value-features.jsonl

pnpm value:train -- \
  --dataset .data/value-features.jsonl \
  --output src/game/value-model/model.generated.json \
  --report .data/value-model-report.json
```

The committed `model.generated.json` is the only training artifact needed by
the deployed app. A future self-play job can write games in the same canonical
position format and reuse this trainer without changing production inference.

## Personalities

All personalities share the calibrated objective value model. A personality
does not get to redefine whether a position is winning; it only ranks positions
that are already inside its allowed objective-value envelope.

The runtime currently includes:

- `balanced`
- `fortress`
- `mobile_raider`
- `battery_commander`
- `para_specialist`
- `tactical_gambler`

Each profile defines normalized style weights, a maximum permitted sacrifice in
objective win probability, a bounded log-odds bonus, risk aversion, exploration
temperature, and a tactical search bias. Style is automatically suppressed as
a line becomes forcing, and a proven win always overrides personality.

```ts
const ranked = rankPersonalityCandidates(
  candidateTurns,
  "RED",
  "battery_commander"
);

const best = ranked[0];
console.log(best.evaluation.objectiveWinProbability);
console.log(best.evaluation.styleContributions);
```

`styleContributions` provides an explanation of which normalized preferences
raised or lowered a candidate. The self-play search will supply tacticality,
risk, and search-derived objective values when those are available.
