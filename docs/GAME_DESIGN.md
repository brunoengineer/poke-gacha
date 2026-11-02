# Poké Gacha: game design

The rules in this document are implemented in `src/game/` (pure, tested logic). Numbers live in
`src/game/economy.ts`, `src/game/gacha.ts` and each mode's file in `src/game/modes/`.

## Cards

- **One card per species**, plus a **shiny** version of each (493 + 493 for Kanto, Johto, Hoenn and Sinnoh).
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
- **Level caps by tier**, each one "just reaching" a region's ceiling: normal cards **Lv. 100** (Johto), **legendaries
  Lv. 120** (Hoenn), **mythicals Lv. 140** (Sinnoh). **Shinies** never evolve and have **no cap**: they're the only way
  past 140 (League title bonuses, rematches, the Infinity Tower). Raising a cap never lowers a level.
  Until Nov 2026 unevolved base forms had no cap either; cards already past 100 keep their level (saves never lose
  levels) but can't grow any further.
- A duplicate of a capped card turns into a Rare Candy. Rare Candy can't be used on a capped card, and the post-battle
  level can't be given to one: a win greys capped cards out of the choice, a loss picks among cards that can still grow
  (only a fully capped team gets Rare Candy instead).
- **Lv. 100 cards become foil**: a gold sheen sweeps across the card, with glints, a shining frame and a gold level tag
  (shinies keep it past 100).
- **Every card starts at Lv. 1**, evolved forms and legendaries included (only the starter begins at Lv. 5). A pulled
  Charizard or Mewtwo is the better long-term card, since its stats grow faster, but levels always come from duplicates,
  Rare Candy and battles. Opponent trainers use the real evolution levels.

## Evolution (optional)

- Level evolutions use the real levels (Bulbasaur 16, Ivysaur 32…).
- Stone evolutions need the stone item (consumed). Trade evolutions need a **Link Cable** (consumed).
- Evolving keeps the level, clamped to 100 (an old base form past 100 loses the extra levels; the UI warns).
- Evolving into a species you already own merges both cards: `max(levels) + 1`.
- **Pass level** (optional): when an evolved form of the card is already owned (any stage: a Lv. 27 Nidorino and a
  Lv. 1 Nidoking, or Charmander and Charizard), the card can merge into it with no level or item needed. Same result
  as the merge above (`max(levels) + 1`, clamped to the cap); the old species stays registered and its new copies go
  to the evolved card. It doesn't count as an evolution in the stats.

**Pass levels** (all at once): when anything can be passed, a banner above the Pokédex opens a review list. Each card
goes to its most evolved owned form (on a tie, the highest level), one after another, so several cards build up the same
evolved card. Left out: shinies, cards that would lose levels (old base forms past the cap), passes that gain nothing
(evolved card at its cap) and cards whose evolved form is also on the team (the team would shrink). Tapping a row keeps
that Pokémon out.

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

**Region filter**: the Capture screen has an All / Kanto / Johto / Hoenn / Sinnoh picker (one option per loaded
generation) that applies to every ball: captures, the banner art, Safari's featured families (picked per region), the
odds and the Master Ball pool (Kanto: the birds, Mewtwo, Mew; Johto: the beasts, Lugia, Ho-Oh, Celebi; Hoenn: the
Regis, Latias, Latios, Kyogre, Groudon, Rayquaza, Jirachi, Deoxys; Sinnoh: the lake trio, Dialga, Palkia, Giratina…). Fewer species in the draw
means each one shows up more often, so duplicates level faster. A species belongs to the generation that introduced
it (Pichu is Johto, Pikachu is Kanto). Pity counters stay per ball, not per region. The choice is a UI preference
kept per player in the browser.

## Economy

Coins come slowly and Rare Candy generously: the early game is about training the few Pokémon you have, not opening
hundreds of balls at once.

- New trainers choose one of twelve starters (Lv. 5): **Bulbasaur, Charmander, Squirtle** (Kanto),
  **Chikorita, Cyndaquil, Totodile** (Johto), **Treecko, Torchic, Mudkip** (Hoenn) or **Turtwig, Chimchar, Piplup**
  (Sinnoh), and start with **₽150 (30 Poké Balls) + Rare Candy ×10**.
- **Daily gift**: ₽80 + ₽10 per streak day (capped at 10 days) and Rare Candy ×2. From the second day of a streak,
  **a Master Ball a day**; every 7th day, **Master Ball ×5** and Rare Candy ×5 instead. Missing a day restarts the streak.
- **Shop** (Mart): Rare Candy ₽300, evolution stones ₽2,500 (including Sinnoh's Shiny, Dusk, Dawn and Oval Stones),
  Link Cable ₽3,000, trade and held items ₽3,500 (King's Rock, Metal Coat, Dragon Scale, Up-Grade, Deep Sea Tooth and
  Scale, Protector, Electirizer, Magmarizer, Dubious Disc, Reaper Cloth, Razor Claw, Razor Fang).
- Older species gain the evolutions later generations added (Magneton → Magnezone, Togetic → Togekiss, Eevee →
  Leafeon/Glaceon…). Location-based ones use a level (Lv. 30), like Johto's friendship evolutions.

## Saved teams

Up to **8 named teams** (`src/game/saved-teams.ts`), saved from the **Teams** button on the Collection dock or any
Battle team strip; the Battle hub also shows them as one-click chips. A team is a list of card keys:

- Evolving a card (or passing its level) rewrites it in every saved team, in the same slot: a saved Charmander comes
  back as Charmeleon. When it merges into a card already in that team, the duplicate slot is dropped.
- Loading resolves each card again anyway: one no longer owned becomes its owned evolved form, duplicates collapse,
  and anything missing is skipped and reported (the saved team is healed to what loaded). Shinies never resolve to
  another card.
- The team matching the current one exactly (same cards and order) shows as **In use**.

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
  Choosing shows the type multipliers of the matchup; the rest (Speed, stats, HP) is on the cards.
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
- **Hoenn**: a Ruin Maniac, an Aroma Lady, a Ninja Boy, a Tuber, Shelly (Team Aqua), Wally, Professor Birch, Lisia,
  Wallace, the rival May.
- **Sinnoh**: Youngster Tristan, Skier Neve, Mars (Team Galactic), Cheryl, Riley, Mira, Buck, Dawn, Professor Rowan,
  the rival Barry.

Rivals add the starter of their region whose type beats yours (fire beats grass, water beats fire, grass beats
water): Blue a Kanto one, Silver a Johto one, May a Hoenn one, Barry a Sinnoh one (you picked Squirtle: Blue brings
Bulbasaur, Silver Chikorita, May Treecko, Barry Turtwig).
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

### Ranked: the ladder that trains against you
(Id `competition` in saves and routes.) A ladder of 100 generated trainers (names, classes, portraits and species from a
per-save seed). You start unranked (below #100) and can challenge the 5 trainers directly above you. Beating one takes
their place; losing costs a little reputation. Rank #1–#10 are Elite trainers, with one rare Pokémon.

- **Opponent level**: your team's average, **+10% per place above you** (+10% … +50% for the five you can challenge),
  and never below the rank's own level (rank 100 = Lv. 4 … rank 1 = Lv. 63). At No. 1, the challengers below are +10%.
- Win: `60 + 10 × opponent level` coins and Rare Candy ×1. Loss: ₽15.
- One-time milestones: Top 75 → Great Ball ×3 · Top 50 → Ultra Ball + Rare Candy ×10 · Top 25 → Ultra Ball ×3 +
  random stone · Top 10 → Ultra Ball ×5 + Rare Candy ×30 · #1 → Master Ball.

**Ash** opens for good when you reach No. 1. His team is 5 Pokémon from those he used in the anime, different every battle,
at **your average +40%**, plus **Pikachu at your strongest Pokémon's level +100**. **Once per hour** (the hour starts when
the battle does). Winning pays **Master Ball ×5**; a loss costs nothing.

### Gyms: Kanto, Johto, Hoenn and Sinnoh leaders
Fixed order, each unlocks after the previous badge. Themed rosters, hard by design: a fresh team needs some training
first. Simulated with a player who picks perfectly (real players need a bit more): a new team can't beat Brock
until about 10 Normal Training battles (29% after 10, 81% after 15); Misty needs about 25–30 (41% after 25, 78% after
30). Losses are free to retry, so gyms are tuned to be near impossible without training. Levels decide HP battles.
A region switch shows each region's badge case. Every first win also gives Rare Candy ×5.

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

**Hoenn** opens once all 8 Johto badges are earned, **Sinnoh** once all 8 Hoenn badges are. They are the endgame and
go past the Lv. 100 cap of normal cards: Hoenn climbs from 100 to 120 (its League), Sinnoh from 120 to 140. Progressing
here **requires shinies** (Shiny Hunt) or, for the patient and lucky, legendaries (cap 120, enough for Hoenn) and
mythicals (cap 140, enough for Sinnoh), all leveled with Rare Candy and training. The Gyms screen says so on both
regions, with a link to the Hunt. Their big candy rewards feed that leveling.

| # | Hoenn | Type | Levels | First-win reward (+ Rare Candy ×5) |
|---|---|---|---|---|
| 1 | Roxanne | Rock | 100–103 | Stone Badge, ₽5,000, Protector + Rare Candy ×15 |
| 2 | Brawly | Fighting | 102–105 | Knuckle Badge, ₽5,250, Rare Candy ×15 + Ultra Ball ×3 |
| 3 | Wattson | Electric | 104–107 | Dynamo Badge, ₽5,500, Dubious Disc + Rare Candy ×15 |
| 4 | Flannery | Fire | 106–109 | Heat Badge, ₽5,750, Magmarizer |
| 5 | Norman | Normal | 108–111 | Balance Badge, ₽6,000, Oval Stone + Rare Candy ×20 |
| 6 | Winona | Flying | 110–113 | Feather Badge, ₽6,250, Razor Fang + Ultra Ball ×3 |
| 7 | Tate & Liza | Psychic | 112–115 | Mind Badge, ₽6,500, Dawn Stone + Rare Candy ×20 |
| 8 | Juan | Water | 114–117 | Rain Badge, ₽7,500, Deep Sea Tooth + Deep Sea Scale + Ultra Ball ×5 |

| # | Sinnoh | Type | Levels | First-win reward (+ Rare Candy ×5) |
|---|---|---|---|---|
| 1 | Roark | Rock | 120–123 | Coal Badge, ₽7,500, Rare Candy ×15 + Ultra Ball ×3 |
| 2 | Gardenia | Grass | 122–125 | Forest Badge, ₽7,750, Shiny Stone + Rare Candy ×15 |
| 3 | Maylene | Fighting | 124–127 | Cobble Badge, ₽8,000, Dawn Stone + Rare Candy ×20 |
| 4 | Crasher Wake | Water | 126–129 | Fen Badge, ₽8,250, Rare Candy ×20 + Ultra Ball ×4 |
| 5 | Fantina | Ghost | 128–131 | Relic Badge, ₽8,500, Reaper Cloth + Dusk Stone |
| 6 | Byron | Steel | 130–133 | Mine Badge, ₽8,750, Protector + Rare Candy ×20 |
| 7 | Candice | Ice | 132–135 | Icicle Badge, ₽9,000, Razor Claw + Rare Candy ×20 |
| 8 | Volkner | Electric | 134–137 | Beacon Badge, ₽10,000, Electirizer + Rare Candy ×25 + Ultra Ball ×5 |

Rematches (every region): +10 levels per rematch (up to +40), half the coins plus Rare Candy ×3.
Badges unlock the Great Ball (1) and Ultra Ball (3), counting every badge; each League needs its region's 8 badges,
and each region's Gyms the 8 badges of the region before (`UNLOCK_BADGES`, `regionGymsOpen`).

### Shiny Hunt: chains on one species
Pick a caught species in the Pokédex (card details → **Hunt**) and battle wild hordes of it, one paid attempt at a
time. Legendary and mythical Pokémon can't be hunted; neither can species never caught (captures keep their surprise).

- **Horde**: six wild Pokémon of that species at the team's average level ±1.
- **Entry fee** by rarity: Common ₽100, Uncommon ₽150, Rare ₽250, Epic ₽400 (a copy costs about a Mart Rare Candy).
- **Each win**: 35% chance of a copy (new card or +1 level), plus the shiny chance of the chain.
- **Chain**: consecutive wins on the same species. Shiny chance = (1 + 0.23 × chain) / 256, capped at chain 40:
  1/256 at 0, 1/78 at 10, 1/38 at 25, 1/25 at 40+. A loss or forfeit breaks the chain; switching species restarts it
  (the game asks first). Finding the shiny doesn't break it.
- Roughly 40–60 hunts per shiny: about ₽5k for a Common, ₽20k for an Epic, plus the battles.

### Infinity Tower: the endless climb
Opens with the first badge (`TOWER_UNLOCK_BADGES`). One battle per floor; there is no top floor, the point is how far
a player gets.

- Floor 1 is Lv. 15 and each floor adds **+5 levels** to the whole opposing team (floor N = Lv. 10 + 5N): floor 18
  is Lv. 100, floor 22 Lv. 120 (legendary cap), floor 26 Lv. 140 (mythical cap); past that only shinies keep up.
- Progress is kept: a loss doesn't reset the climb, the same floor waits for a retry. Each floor pays **once**, on its
  first clear, so low floors can't be farmed: **Rare Candy ×3 + ₽20 per level** (₽300 on floor 1, ₽2,000 at Lv. 100).
- Every **10th floor is a boss floor** (Tower Master, legendaries allowed): **+₽2,000** bonus.
- Floors are fixed: floor N always brings the same trainer and team (seeded by N), so a lost floor can be studied.
- Pacing: a floor adds 30 levels across the opposing team, while a clear gives about 4–5 (3 candies + the post-battle
  level), so the tower pulls ahead fast and needs the other modes to keep climbing.

### When the team outgrows Gyms and Leagues
Gyms and Leagues keep their designed levels (rematch and title bonuses included) until the **team's average level**
passes them; then they train up to match (`src/game/scaling.ts`). Prizes don't change. A battle with the current team
(the registered one in a League run) shows this on its card as "Trained up".

- **Gyms** (each on its own, when the average passes its top level): at least a share of the average, by position in the
  region: 65%, 70%, 75%, 80%, 85%, 90%, 95%, 100%. Never below the designed levels. The 8th gym's last Pokémon, the ace,
  has the level of the team's strongest Pokémon.
- **Leagues** (all four duels at once, when the average passes the League's top level): the average, +10%, +20%, +30%. The
  final's ace has the level of the team's strongest Pokémon (or the +30%, if that's higher).

Example, average 178 and a Lv. 330 Gengar: Gym 4 at 142, Gym 8 at 178 with an ace at 330; League duels at 178, 196, 214,
and 231 with an ace at 330.

### Pokémon League: elimination championship
Needs 8 badges and a full team; entry fee ₽1,000. Four duels in a row; the first loss ends the run.

**Attrition** (every region's League): the team is **registered at entry** and locked for the whole run (changing the
team in the Collection doesn't affect it; a registered card that evolves mid-run is followed). **HP and faints carry
over** between duels, stored as a fraction of max HP. Before each duel after the first, the player makes **one heal
choice**: a **Potion** (one Pokémon back to full), a **Revive** (one fainted Pokémon back at 50%) or a **Rest** (the
whole team +20%; fainted ones stay down). No choice is asked when nobody is hurt. "Perfect" only counts faints in that
duel. The post-battle level-up goes to the registered team. Prizes didn't change:

| Lost at | Placement | Reward |
|---|---|---|
| Duel 1 (Round of 16) | Top 16 | ₽250 + Rare Candy ×5 |
| Duel 2 (Quarterfinal) | Top 8 | ₽750 + Great Ball ×5 + Rare Candy ×10 |
| Duel 3 (Semifinal) | Top 4 | ₽1,500 + Ultra Ball ×3 + Rare Candy ×20 |
| Duel 4 (Final) | Top 2 | ₽2,500 + Ultra Ball ×5 + Rare Candy ×30 |
| Won all four | **Champion** | ₽5,000 + Master Ball + Rare Candy ×40 |

Opponents: an elite ladder trainer, then Elite Four members (Lorelei, Bruno, Agatha, Lance), then the Champion,
the rival Blue. Levels start at 60–70 and grow +5 per title won (up to +40). **First title ever**: a shiny copy of your starter, which is uncapped.

**Johto League**: same format, its own run, titles, best placement and Hall of Fame (a region switch on the
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

**Hoenn League** (8 Hoenn badges, fee ₽4,000): Elite Four Sidney (Dark), Phoebe (Ghost), Glacia (Ice), Drake
(Dragon); Champion Steven (Steel). Levels 114–120. Prizes triple the Kanto table; Champion: ₽15,000 + Master Ball +
Rare Candy ×100.

**Sinnoh League** (8 Sinnoh badges, fee ₽6,000): Elite Four Aaron (Bug), Bertha (Ground), Flint (Fire), Lucian
(Psychic); Champion Cynthia (Garchomp last). Levels 134–140. Prizes quadruple the Kanto table; Champion: ₽20,000 +
Master Ball ×2 + Rare Candy ×120.

Every league adds +5 levels per title (up to +40), so rematch titles go well past 140.
**First Hoenn / Sinnoh title**: a shiny copy of that region's starter of your starter's type (Charmander → Torchic,
Chimchar); if that's your own starter (already given by the Kanto title), Kanto's of the same type instead
(`firstTitleStarter`).

## Adding a generation

See "Adding a generation" in the README for the full checklist (data, region id, starters, gyms, league, friends,
texts, badges, `SAVE_VERSION`). Rarity, weights, evolutions, sprites, cries, team generation and region filters are
derived from the data.

Baby Pokémon don't count as a stage, so a new baby form (Pichu before Pikachu) doesn't change its base form's card:
Pikachu stays a base form.
