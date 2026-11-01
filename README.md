# Poké Gacha

A Pokémon gacha card game in the browser: catch all 493 Pokémon of Kanto, Johto, Hoenn and Sinnoh as pixel-art cards,
level them up with duplicates, evolve them (or don't), and battle friends, a ranked ladder, 32 gym leaders, an endless
tower and four Pokémon Leagues.

Play in Portuguese or English, as a guest or signed in with Google (cloud save).

## Features

- **One card per Pokémon, plus its shiny**: Black/White (Gen 5) pixel sprites in type-themed, rarity-framed cards.
- **Cheap captures, slow mastery**: Poké, Safari, Great, Ultra and Master Balls; every duplicate is +1 level.
  Captures can focus on one region, so its Pokémon show up more often.
- **Optional evolution** with real evolution levels, stones and a Link Cable for trade evolutions.
- **Level caps by rarity**: cards stop at Lv. 100, legendaries at 120, mythicals at 140; shinies never stop growing.
- **Foil cards**: a card that reaches Lv. 100 turns into a shining gold foil.
- **Battles**: 6-vs-6 HP battles: Speed decides who hits first, type advantage scales damage, and you choose who goes in and when to switch.
- **Saved teams**: up to 8 named teams, loaded in one click; evolved Pokémon come back as their evolved form.
- **Six modes**: Training (friends), Competition (ranked ladder), Gyms (badges), Shiny Hunt (chain wins on one species
  for its shiny), Infinity Tower (+2 levels per floor, no top), Pokémon League (Top 16 → Champion).
- **Synthesized chiptune** sound effects and original music, plus the Pokémon cries.

The full rules and numbers are in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # game logic tests (Vitest)
npm run build      # type check + production build in dist/
```

Without Firebase configured, the game runs in guest mode (progress saved in the browser).

### Google sign-in (Firebase)

1. Create a Firebase project (or reuse one, for example the chess-rpg project) and add a **Web app**.
2. Enable **Authentication → Google**, and add your domains (e.g. `localhost`, `<user>.github.io`) under
   Authentication → Settings → Authorized domains.
3. Create a **Firestore** database and publish [firestore.rules](firestore.rules). If the project already hosts
   another game, merge the `pokegacha_saves` block into its existing rules instead of replacing them.
4. Copy `.env.example` to `.env.local` and fill in the web app config. On GitHub, add the same four values as
   repository **variables** (Settings → Secrets and variables → Actions → Variables).

The Firebase web config is not a secret: access is protected by the Firestore rules (each player can only read and
write their own save).

### Deploy

Pushing to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): tests, build, and publish to
GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Project structure

```
src/
  data/        Pokédex data (generated), species registry, types chart, items, sprite/cry URLs, generations
  game/        Pure game rules (tested): cards, progression, gacha, battle, duel, teams, rewards, economy, modes/
  state/       Save format, store (events + local/cloud persistence), actions, Firebase
  ui/          Shell (header + router), login, card renderer, modals/toasts, drag and drop, effects, rewards, settings
  screens/     Collection, Capture (gacha + mart + onboarding), Battle (arena, hub, training, gyms, competition, hunt, tower, league)
  audio/       Synthesized sound effects, music sequencer, cries
  i18n/        pt-BR and English strings, one namespace per feature
  styles/      base.css (tokens, layout, shared components) + one CSS file per feature
scripts/
  build-pokedex.mjs   Generates src/data/pokedex/gen<N>.json from PokeAPI
```

### Adding a generation

```bash
npm run pokedex 5     # writes src/data/pokedex/gen5.json
```

Then:

1. Add the generation to `src/data/generations.ts` and to the test setup (`src/test/setup.ts`). Rarity, capture odds,
   evolutions, card art, sprites, cries, opponent teams and the capture/Pokédex region filters come from the data.
2. Add the region id to `src/game/regions.ts` and its three starters to `STARTERS` (`src/game/economy.ts`).
3. Add its content in a file like `src/game/modes/sinnoh.ts` (8 gym leaders, Elite Four, Champion, friends) and register
   it in `gyms.ts` (`REGION_GYMS`), `league.ts` (`ELITE_FOURS`, `CHAMPIONS`, fee, levels, prizes) and `training.ts`.
   Its texts go in `src/i18n/*/regions.ts`, its badge artwork in `src/screens/battle/badges.ts`.
4. Bump `SAVE_VERSION` (see below).

Notes from adding Johto, Hoenn and Sinnoh:

- New evolution items need an entry in `src/data/items.ts` (name, description, Mart price), or they get a generic one.
- Baby Pokémon don't count as a stage, so a new baby form (Pichu, Munchlax) doesn't change its base form's card.
- Older species gain evolutions from newer generations on their own (Magneton → Magnezone once Sinnoh is loaded).
- PokeAPI has chain links that aren't real evolutions (Phione → Manaphy): list them in `NOT_EVOLUTIONS` in the build script.
- Gen 6+ has no Black/White sprites: `src/data/sprites.ts` falls back to the newest pixel sprites.

### Save compatibility (players have real progress)

Every release must load every save from earlier releases, unchanged. The rules (also at the top of
[src/state/save.ts](src/state/save.ts)):

- Never rename or remove save fields or ids: card keys (`"25"`, `"25s"` for shiny), badge, gym and item ids.
- New fields get a default in `defaultSave()`; `normalizeSave()` fills them in for older saves.
- Anything that isn't "a new field with a default" is a migration: bump `SAVE_VERSION` and add a step to `MIGRATIONS`.
  Also bump it when a release adds content older apps can't show (a new generation): an outdated cached app that
  meets a newer save reloads itself once.
- Unknown fields (written by a newer app) are kept, never dropped, so an old tab can't delete new progress.
- Game-rule changes must not lower existing levels or remove cards.
- **When you release, add one of its saves to `src/state/fixtures/`** (never edit the old ones).
  [src/state/compat.test.ts](src/state/compat.test.ts) loads every fixture and checks nothing was lost.

## Credits

Pokémon and Pokémon character names are trademarks of Nintendo, Creatures Inc. and GAME FREAK. This is a non-commercial
fan project, not affiliated with or endorsed by them. Data from [PokeAPI](https://pokeapi.co); sprites from the
[PokeAPI sprites](https://github.com/PokeAPI/sprites) repository (the same Gen 5 sprites shown on pokemondb.net);
trainer portraits from [Pokémon Showdown](https://play.pokemonshowdown.com); cries from [PokeAPI cries](https://github.com/PokeAPI/cries).

Made by [Bruno Peres](https://github.com/brunoengineer).
