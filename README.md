# Poké Gacha

A Pokémon gacha card game in the browser: catch all 151 Kanto Pokémon as pixel-art cards, level them up with
duplicates, evolve them (or don't), and battle friends, a ranked ladder, the eight gym leaders and the Pokémon League.

Play in Portuguese or English, as a guest or signed in with Google (cloud save).

## Features

- **One card per Pokémon, plus its shiny**: Black/White (Gen 5) pixel sprites in type-themed, rarity-framed cards.
- **Cheap captures, slow mastery**: Poké, Safari, Great, Ultra and Master Balls; every duplicate is +1 level.
- **Optional evolution** with real evolution levels, stones and a Link Cable for trade evolutions.
- **The easter egg**: unevolved base forms and shiny cards have no level cap. A Lv. 250 Charmander outgrows a Lv. 100 Charizard.
- **Battles**: 6 rounds, pick a card and a stat, type advantage matters.
- **Four modes**: Training (friends), Competition (ranked ladder), Gyms (badges), Pokémon League (Top 16 → Champion).
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
  game/        Pure game rules (tested): cards, progression, gacha, battle, teams, rewards, economy, modes/
  state/       Save format, store (events + local/cloud persistence), actions, Firebase
  ui/          Shell (header + router), login, card renderer, modals/toasts, drag and drop, effects, rewards, settings
  screens/     Collection, Capture (gacha + mart + onboarding), Battle (arena, hub, training, gyms, competition, league)
  audio/       Synthesized sound effects, music sequencer, cries
  i18n/        pt-BR and English strings, one namespace per feature
  styles/      base.css (tokens, layout, shared components) + one CSS file per feature
scripts/
  build-pokedex.mjs   Generates src/data/pokedex/gen<N>.json from PokeAPI
```

### Adding a generation

```bash
npm run pokedex 2     # writes src/data/pokedex/gen2.json
```

Then add the generation to `src/data/generations.ts`. Rarity, capture odds, evolutions, card art, sprites, cries and
opponent teams are all derived from the data.

## Credits

Pokémon and Pokémon character names are trademarks of Nintendo, Creatures Inc. and GAME FREAK. This is a non-commercial
fan project, not affiliated with or endorsed by them. Data from [PokeAPI](https://pokeapi.co); sprites from the
[PokeAPI sprites](https://github.com/PokeAPI/sprites) repository (the same Gen 5 sprites shown on pokemondb.net);
trainer portraits from [Pokémon Showdown](https://play.pokemonshowdown.com); cries from [PokeAPI cries](https://github.com/PokeAPI/cries).

Made by [Bruno Peres](https://github.com/brunoengineer).
