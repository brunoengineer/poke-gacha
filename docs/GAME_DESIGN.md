# Poké Gacha: game design

The rules in this document are implemented in `src/game/` (pure, tested logic). Numbers live in
`src/game/economy.ts`, `src/game/gacha.ts` and each mode's file in `src/game/modes/`.

## Cards

- **One card per species**, plus a **shiny** version of each (151 + 151 for Kanto).
- Cards are HTML/CSS around the Black/White (Gen 5) pixel sprite, colored by type and framed by rarity.
- **Rarity** is derived from data (catch rate, evolution stage, base stats): Common, Uncommon, Rare, Epic,
  Legendary, Mythical. Works for any generation without hand-made tables.
- **Stats** grow linearly with level, like the main games: `round(base × (level + 2) / 25) + 5` (HP adds `level + 10`).
  Levels matter as much as species: a team 25% higher in level wins most battles.
  Shiny cards get +10%. **Power (PC/CP)** = sum of the six stats.

## Levels

- A duplicate gives **+1 level**.
- If you already evolved past it (pull a Charmander while you own Charmeleon), the copy goes to the evolved card.
- A **Rare Candy** gives +1 level to any card.
- **Cap Lv. 100**, with two exceptions (the easter egg):
  - a **base form that can evolve but never did** has **no cap**: a Lv. 250 Charmander outgrows a Lv. 100 Charizard;
  - **shiny cards never evolve and have no cap**: a shiny Charizard can go past Lv. 100.
- A duplicate of a capped card turns into a Rare Candy.
- Obtaining an evolved species directly starts it at half its evolution level (Charizard Lv. 18), a jackpot that
  doesn't skip the early game; legendaries start at Lv. 40. Opponent trainers use the real evolution levels.

## Evolution (optional)

- Level evolutions use the real levels (Bulbasaur 16, Ivysaur 32…).
- Stone evolutions need the stone item (consumed). Trade evolutions need a **Link Cable** (consumed).
- Evolving keeps the level, clamped to 100 (so an uncapped base form loses its extra levels; the UI warns).
- Evolving into a species you already own merges both cards: `max(levels) + 1`.

## Captures (gacha)

| Ball | Price | Unlock | Notes |
|---|---|---|---|
| Poké Ball | ₽5 (×1, ×10, ×100) | start | weights = catch rate × stage factor; shiny 1/512 |
| Safari Zone | ₽15 (×1, ×10, ×50) | start | 40% from 3 **featured families of the day** (same for everyone); shiny 1/400 |
| Great Ball | ₽50 or Great Ball item | 1 badge | flatter odds; 1 Rare+ guaranteed every 10; shiny 1/256 |
| Ultra Ball | ₽150 or Ultra Ball item | 3 badges | evolved forms and legendaries realistic; 1 Epic+ every 10; shiny 1/128 |
| Master Ball | item only | start | Legendary or Mythical guaranteed; shiny 1/32 |

Pulls are cheap on purpose: levels come from duplicates, so players open hundreds of balls.
The Safari banner is the targeted way to level a specific family.

## Economy

- New trainers choose **Bulbasaur, Charmander or Squirtle** (Lv. 5) and start with ₽600 (120 Poké Balls).
- **Daily gift**: ₽150 + ₽25 per streak day (capped at 10 days); a Great Ball every 7th day.
- **Shop** (Mart): Rare Candy ₽300, evolution stones ₽2,500, Link Cable ₽3,000.

## Battles

- Team of **6** cards; a battle is 6 rounds. Each round the opponent's card is shown with its stats hidden;
  you answer with a card from your hand and choose one of the six stats.
- Both values are multiplied by **type advantage** (each side's best attacking type vs. the other's types):
  ×1.6 (4×), ×1.3 (2×), ×1, ×0.8 (½), ×0.65 (¼), ×0.5 (immune).
- Higher value wins the round. A tied score is broken by the sum of all compared values (no draws).
- Harder modes can hide the opponent's next card (`reveal: 'type'` shows only its type; `'hidden'` shows nothing).

## Modes

### Training: friends and side characters
Casual sparring, repeatable, never locked. Friends (Brock, Misty, Professor Oak, Youngster Joey, Bug Catcher,
Hiker, Lass, Swimmer, Bird Keeper, the rival Blue…) bring themed teams that **scale with the player's team level**,
with three difficulties:

| Difficulty | Opponent level | Coins on win |
|---|---|---|
| Easy | team avg −3 … −1 | 30 + 4 × level |
| Normal | team avg −1 … +1 | 50 + 6 × level |
| Hard | team avg +2 … +5 | 80 + 9 × level |

First win of the day against each friend also gives 1 Rare Candy. Friends sometimes give gifts: Normal 5% and
Hard 12% chance of a **Link Cable** or a random evolution stone ("trading with friends"). A loss pays ₽10.

### Competition: the ranked ladder
A ladder of 100 generated trainers (names, classes, portraits and teams from a per-save seed). You start unranked
(below #100) and can challenge the 5 trainers directly above you. Beating one takes their place; losing costs a
little reputation. Rank #1–#10 are Elite trainers with stronger, partially evolved teams.

- Opponent level by rank: about `4 + (100 − rank) × 0.6` (rank 100 ≈ Lv. 4, rank 1 ≈ Lv. 63).
- Win: `60 + 8 × level` coins. Loss: ₽15.
- One-time milestones: Top 75 → Great Ball ×3 · Top 50 → Ultra Ball + Rare Candy ×10 · Top 25 → Ultra Ball ×3 +
  random stone · Top 10 → Ultra Ball ×5 + Rare Candy ×30 · #1 → Master Ball.

### Gyms: the eight Kanto leaders
Fixed order, each unlocks after the previous badge. Themed rosters, hard by design.

| # | Leader | Type | Levels | First-win reward |
|---|---|---|---|---|
| 1 | Brock | Rock | 8–12 | Boulder Badge, ₽500, Great Ball ×3 |
| 2 | Misty | Water | 14–18 | Cascade Badge, ₽1,000, Water Stone |
| 3 | Lt. Surge | Electric | 20–24 | Thunder Badge, ₽1,500, Thunder Stone |
| 4 | Erika | Grass | 26–30 | Rainbow Badge, ₽2,000, Leaf Stone |
| 5 | Koga | Poison | 32–37 | Soul Badge, ₽2,500, Rare Candy ×10 |
| 6 | Sabrina | Psychic | 38–43 | Marsh Badge, ₽3,000, Moon Stone + Link Cable |
| 7 | Blaine | Fire | 44–49 | Volcano Badge, ₽3,500, Fire Stone |
| 8 | Giovanni | Ground | 50–55 | Earth Badge, ₽5,000, Ultra Ball ×3 |

Rematches: +10 levels per rematch (up to +40), half the coins plus Rare Candy ×3.
Badges unlock the Great Ball (1), Ultra Ball (3) and the Pokémon League (8).

### Pokémon League: elimination championship
Needs 8 badges; entry fee ₽1,000. Four duels in a row; the first loss ends the run:

| Lost at | Placement | Reward |
|---|---|---|
| Duel 1 (Round of 16) | Top 16 | ₽500 |
| Duel 2 (Quarterfinal) | Top 8 | ₽1,500 + Great Ball ×5 |
| Duel 3 (Semifinal) | Top 4 | ₽3,000 + Ultra Ball ×3 + Rare Candy ×10 |
| Duel 4 (Final) | Top 2 | ₽5,000 + Ultra Ball ×5 + Rare Candy ×20 |
| Won all four | **Champion** | ₽10,000 + Master Ball + Rare Candy ×30 |

Opponents: an elite ladder trainer, then Elite Four members (Lorelei, Bruno, Agatha, Lance), then the Champion,
the rival Blue. Levels start at 55–65 and grow +5 per title won (up to +40). The final hides the opponent's next card
(`reveal: 'type'`). **First title ever**: a shiny copy of your starter, which is uncapped.

## Adding a generation

1. `npm run pokedex 2` writes `src/data/pokedex/gen2.json` from PokeAPI.
2. Add it to `src/data/generations.ts`.
3. Optionally add trainers, gyms and banners that use the new species. Everything else (rarity, weights, evolutions,
   sprites, cries, team generation) is derived from the data.

Note: a new generation can add pre-evolutions (Pichu before Pikachu). A card that was an uncapped base form keeps
its level, but stops being uncapped.
