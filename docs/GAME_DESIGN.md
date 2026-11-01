# Poké Gacha: game design

The rules in this document are implemented in `src/game/` (pure, tested logic). Numbers live in
`src/game/economy.ts`, `src/game/gacha.ts` and each mode's file in `src/game/modes/`.

## Cards

- **One card per species**, plus a **shiny** version of each (251 + 251 for Kanto and Johto).
- Cards are HTML/CSS around the Black/White (Gen 5) pixel sprite, colored by type and framed by rarity.
- **Rarity** is derived from data (catch rate, evolution stage, base stats): Common, Uncommon, Rare, Epic,
  Legendary, Mythical. Works for any generation without hand-made tables.
- **Stats** grow linearly with level, like the main games: `round(base × (level + 2) / 25) + 5` (HP adds `level + 10`).
  Levels matter as much as species: a team 25% higher in level wins most battles.
  Shiny cards get +10%. **Power (PC/CP)** = sum of the six stats.

## Levels

- A duplicate gives **+1 level**.
- If you evolved that species yourself (your Charmander became a Charmeleon), later copies go to the evolved card,
  so evolving never stalls a line. Getting an evolved form directly (pulling an Arbok) doesn't count: the next Ekans
  becomes an Ekans card of its own. Nothing ever evolves automatically, and pulls never take levels away.
- A **Rare Candy** gives +1 level to any card.
- **Cap Lv. 100**, with two exceptions (the easter egg):
  - a **base form that can evolve but never did** has **no cap**: a Lv. 250 Charmander outgrows a Lv. 100 Charizard;
  - **shiny cards never evolve and have no cap**: a shiny Charizard can go past Lv. 100.
- A duplicate of a capped card turns into a Rare Candy.
- **Every card starts at Lv. 1**, evolved forms and legendaries included (only the starter begins at Lv. 5). A pulled
  Charizard or Mewtwo is the better long-term card, since its stats grow faster, but levels always come from duplicates,
  Rare Candy and battles. Opponent trainers use the real evolution levels.

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

**Region filter**: the Capture screen has an All / Kanto / Johto picker (one option per loaded generation) that
applies to every ball: captures, the banner art, Safari's featured families (picked per region), the odds and the
Master Ball pool (Kanto: the birds, Mewtwo, Mew; Johto: the beasts, Lugia, Ho-Oh, Celebi). Fewer species in the draw
means each one shows up more often, so duplicates level faster. A species belongs to the generation that introduced
it (Pichu is Johto, Pikachu is Kanto). Pity counters stay per ball, not per region. The choice is a UI preference
kept per player in the browser.

## Economy

Coins come slowly and Rare Candy generously: the early game is about training the few Pokémon you have, not opening
hundreds of balls at once.

- New trainers choose one of six starters (Lv. 5): **Bulbasaur, Charmander, Squirtle** (Kanto) or
  **Chikorita, Cyndaquil, Totodile** (Johto), and start with **₽150 (30 Poké Balls) + Rare Candy ×10**.
- **Daily gift**: ₽80 + ₽10 per streak day (capped at 10 days) and Rare Candy ×2; every 7th day, a **Master Ball** and
  Rare Candy ×5 instead.
- **Shop** (Mart): Rare Candy ₽300, evolution stones ₽2,500, Link Cable ₽3,000, Johto trade items (King's Rock,
  Metal Coat, Dragon Scale, Up-Grade) ₽3,500.

## Battles

HP battles, 6 against 6 (rules in `src/game/duel.ts`, arena in `src/screens/battle/arena.ts`):

- Two Pokémon fight at a time until one faints. The faster one (Speed; ties go to the player) hits first, then
  they alternate. There are no moves: each hit uses the attacker's better offensive stat (Attack vs. the target's
  Defense, or Sp. Atk vs. Sp. Def, whichever deals more), scaled by **type advantage** (the attacker's best type
  against the target's types): ×1.6 (4×), ×1.3 (2×), ×1, ×0.8 (½), ×0.65 (¼), ×0.5 (immune).
- The winner stays in with the HP it has left; the opponent sends its team in order, always shown in full once on
  the field (card, stats, exact HP).
- **The player's decisions**: who goes in first, who replaces a fainted Pokémon, and an optional free switch each
  time a new opponent enters (keep the damaged survivor in, or send another; whoever leaves keeps its HP).
  Choosing shows the type multipliers and who strikes first; Training also predicts the outcome.
- Duels play out automatically (tap to skip, 1×/2× speed). The side with Pokémon left wins; **perfect** = none of
  yours fainted.
- **Training after every battle** (not forfeits): after a win you pick a team member to gain +1 level (+2 for a
  perfect win); after a loss a random one gains +1. Capped cards get Rare Candy instead.

## Modes

### Training: friends and side characters
Casual sparring, repeatable, never locked: the main way to earn Rare Candy. Friends bring themed teams that
**scale with the player's team level**, grouped by region in the lobby:

- **Kanto**: Brock, Misty, Professor Oak, Youngster Joey, Bug Catcher, Hiker, Lass, Swimmer, Bird Keeper,
  Jessie & James, the rival Blue.
- **Johto**: Youngster Tommy, a Kimono Girl (Eeveelutions), Kurt, Eusine, Bill, Professor Elm (hatched babies),
  Lyra, Ethan, the rival Silver.

Rivals add the starter whose type beats yours (fire beats grass, water beats fire, grass beats water): Blue with
a Kanto one, Silver with a Johto one (you picked Squirtle or Totodile: Blue brings Bulbasaur, Silver Chikorita).
Three difficulties:

| Difficulty | Opponent level | Coins on win | Rare Candy on win |
|---|---|---|---|
| Easy | team avg −3 … −1 | 15 + 2 × level | 1 |
| Normal | team avg −1 … +1 | 25 + 3 × level | 1 |
| Hard | team avg +2 … +5 | 40 + 5 × level | 2 |

The first win of the day against each friend adds Rare Candy ×1. Every battle also trains one team Pokémon
(see Battles), so candy is a bonus on top. Friends sometimes give gifts: Normal 5% and
Hard 12% chance of a **Link Cable**, a random evolution stone or a Johto trade item (King's Rock, Metal Coat,
Dragon Scale, Up-Grade): "trading with friends". A loss pays ₽10.

### Competition: the ranked ladder
A ladder of 100 generated trainers (names, classes, portraits and teams from a per-save seed). You start unranked
(below #100) and can challenge the 5 trainers directly above you. Beating one takes their place; losing costs a
little reputation. Rank #1–#10 are Elite trainers with stronger, partially evolved teams.

- Opponent level by rank: about `4 + (100 − rank) × 0.6` (rank 100 ≈ Lv. 4, rank 1 ≈ Lv. 63).
- Win: `30 + 4 × level` coins and Rare Candy ×1. Loss: ₽15.
- One-time milestones: Top 75 → Great Ball ×3 · Top 50 → Ultra Ball + Rare Candy ×10 · Top 25 → Ultra Ball ×3 +
  random stone · Top 10 → Ultra Ball ×5 + Rare Candy ×30 · #1 → Master Ball.

### Gyms: Kanto and Johto leaders
Fixed order, each unlocks after the previous badge. Themed rosters, hard by design: a fresh team needs some training
first. Simulated with a player who picks perfectly (real players need a bit more): a new team can't beat Brock
until about 10 Normal Training battles (29% after 10, 81% after 15); Misty needs about 25–30 (41% after 25, 78% after
30). Losses are free to retry, so gyms are tuned to be near impossible without training. Levels decide HP battles.
A Kanto / Johto switch shows each region's badge case. Every first win also gives Rare Candy ×5.

| # | Leader | Type | Levels | First-win reward (+ Rare Candy ×5) |
|---|---|---|---|---|
| 1 | Brock | Rock | 15–19 | Boulder Badge, ₽250, Great Ball ×3 |
| 2 | Misty | Water | 18–22 | Cascade Badge, ₽500, Water Stone |
| 3 | Lt. Surge | Electric | 24–28 | Thunder Badge, ₽750, Thunder Stone |
| 4 | Erika | Grass | 30–34 | Rainbow Badge, ₽1,000, Leaf Stone |
| 5 | Koga | Poison | 36–40 | Soul Badge, ₽1,250, Rare Candy ×10 |
| 6 | Sabrina | Psychic | 42–46 | Marsh Badge, ₽1,500, Moon Stone + Link Cable |
| 7 | Blaine | Fire | 48–52 | Volcano Badge, ₽1,750, Fire Stone |
| 8 | Giovanni | Ground | 54–58 | Earth Badge, ₽2,500, Ultra Ball ×3 |

**Johto** opens once all 8 Kanto badges are earned:

| # | Leader | Type | Levels | First-win reward (+ Rare Candy ×5) |
|---|---|---|---|---|
| 1 | Falkner | Flying | 60–64 | Zephyr Badge, ₽2,500, Great Ball ×5 |
| 2 | Bugsy | Bug | 63–67 | Hive Badge, ₽2,750, Metal Coat |
| 3 | Whitney | Normal | 66–70 | Plain Badge, ₽3,000, Rare Candy ×15 |
| 4 | Morty | Ghost | 69–73 | Fog Badge, ₽3,250, Ultra Ball ×3 |
| 5 | Chuck | Fighting | 72–76 | Storm Badge, ₽3,500, King's Rock |
| 6 | Jasmine | Steel | 75–79 | Mineral Badge, ₽3,750, Metal Coat |
| 7 | Pryce | Ice | 78–82 | Glacier Badge, ₽4,000, Up-Grade |
| 8 | Clair | Dragon | 81–86 | Rising Badge, ₽5,000, Dragon Scale + Ultra Ball ×5 |

Rematches (both regions): +10 levels per rematch (up to +40), half the coins plus Rare Candy ×5.
Badges unlock the Great Ball (1) and Ultra Ball (3), counting every badge; the Kanto League needs the 8 Kanto badges,
the Johto Gyms the 8 Kanto badges and the Johto League the 8 Johto badges (`UNLOCK_BADGES`, `JOHTO_UNLOCK_BADGES`).

### Pokémon League: elimination championship
Needs 8 badges; entry fee ₽1,000. Four duels in a row; the first loss ends the run:

| Lost at | Placement | Reward |
|---|---|---|
| Duel 1 (Round of 16) | Top 16 | ₽250 + Rare Candy ×5 |
| Duel 2 (Quarterfinal) | Top 8 | ₽750 + Great Ball ×5 + Rare Candy ×10 |
| Duel 3 (Semifinal) | Top 4 | ₽1,500 + Ultra Ball ×3 + Rare Candy ×20 |
| Duel 4 (Final) | Top 2 | ₽2,500 + Ultra Ball ×5 + Rare Candy ×30 |
| Won all four | **Champion** | ₽5,000 + Master Ball + Rare Candy ×40 |

Opponents: an elite ladder trainer, then Elite Four members (Lorelei, Bruno, Agatha, Lance), then the Champion,
the rival Blue. Levels start at 60–70 and grow +5 per title won (up to +40). **First title ever**: a shiny copy of your starter, which is uncapped.

**Johto League**: same format, its own run, titles, best placement and Hall of Fame (a Kanto / Johto switch on the
League screen). Needs the 8 Johto badges; entry fee ₽2,500. Elite Four: Will (Psychic), Koga (Poison), Bruno
(Fighting), Karen (Dark); Champion Lance (Dragon). Levels 88–98, +5 per Johto title (up to +40). Prizes are double
the Kanto table, except the Champion's:

| Lost at | Placement | Reward |
|---|---|---|
| Duel 1 | Top 16 | ₽500 + Rare Candy ×10 |
| Duel 2 | Top 8 | ₽1,500 + Great Ball ×10 + Rare Candy ×20 |
| Duel 3 | Top 4 | ₽3,000 + Ultra Ball ×6 + Rare Candy ×40 |
| Duel 4 | Top 2 | ₽5,000 + Ultra Ball ×10 + Rare Candy ×60 |
| Won all four | **Champion** | ₽10,000 + Master Ball + Rare Candy ×80 |

**First Johto title**: a shiny copy of the other region's starter of your starter's type (Bulbasaur → Chikorita,
Charmander → Cyndaquil, Squirtle → Totodile, and back to Kanto for a Johto starter).

## Adding a generation

1. `npm run pokedex 3` writes `src/data/pokedex/gen3.json` from PokeAPI.
2. Add it to `src/data/generations.ts` and bump `SAVE_VERSION` (see "Save compatibility" in the README).
3. Optionally add trainers, gyms and a league that use the new species. Everything else (rarity, weights,
   evolutions, sprites, cries, team generation, region filters) is derived from the data.

Baby Pokémon don't count as a stage, so a new baby form (Pichu before Pikachu) doesn't change its base form's card:
Pikachu stays an uncapped base form.
