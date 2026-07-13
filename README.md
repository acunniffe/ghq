# Kurt Vonnegut's GHQ
> We like to think that if heaven is real, the most interesting thing going on in Kurt's life is watching all us earthly fools playing his board game. **Is GHQ winnable?** idk...**war winnable**. So it goes. Play on or write some code with us

### Contributing ideas
- Help us build the GHQ bot and figure out if this is a solvable game. It could be 🤷 
- Build an interactive instruction manual with embedded playable boards to grow the community
- Mobile friendly PWA 
- Correspondence games
- Refactor of board logic is needed. We didn't know the reqs when we started so there's a lot to do. 
- Build some cool variants. What does 4 player GHQ look like? Infinite canvas

Huge Kudos to everyone who has contributed to https://github.com/boardgameio/boardgame.io. 

## Headless AI prototype

The first explainable search bot lives in `scripts/ghq_ai.py`. It uses the same
Python rules engine as the site, searches complete three-action turns, and emits
JSON containing its chosen turn, principal variation, timing, and evaluation
breakdown.

```bash
python3 scripts/ghq_ai.py \
  --fen 'qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r' \
  --time-ms 2000 \
  --max-depth 2 \
  --beam-width 12 \
  --personality balanced
```

Available personalities are `balanced`, `fortress`, `mobile`, and `artillery`.
They share the same observable features but weight them differently, so their
preferences remain inspectable. Search depth counts complete player turns, not
individual actions. The current prototype uses beam-limited alpha-beta search,
so results are approximate and the beam width is included in the output.

Run its focused tests with:

```bash
python3 -m unittest tests/test_ghq_ai.py
```
