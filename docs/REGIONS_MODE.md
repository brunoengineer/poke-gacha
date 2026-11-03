# Region Journey: the game region by region

A second way to play, next to the Classic game. Like the anime, every region is a new start: a new partner, a new team
and only that generation's Pokémon. Winning a League opens the next region. After the last one, the World brings everything
together.

Classic stays as it was, with its own save. Both games live in one app, and players pick one on the login screen or in
the account menu.

## The journey

| Chapter | Pokédex the player can use | What's there | Opens with |
|---|---|---|---|
| **Kanto** | Gen 1 (151) | Training, Gyms, Shiny Hunt, Kanto League, Legendary Battle | New game |
| **Johto** | Gen 2 (100) | The same, with Johto's content | Kanto League title |
| **Hoenn** | Gen 3 (135) | The same, with Hoenn's content | Johto League title |
| **Sinnoh** | Gen 4 (107) | The same, with Sinnoh's content | Hoenn League title |
| **World** | All of them (493) | Master League, Infinity Tower, Ranked with Ash, Training with every friend, Shiny Hunt, every Legendary Battle | Sinnoh League title |

**Starting a region.** The first visit asks for one of its three starters (Lv. 5), with ₽500 and Rare Candy ×10 on top
of the wallet: ten Poké Balls, enough for the team of six that battles need. The new team starts with just that partner.

**Going back.** Any opened chapter is one tap away on the Journey map, at any time. Going back to Kanto means playing with
the Kanto team to earn money for the next start.

### What travels and what stays

| Travels with the player | Stays in each chapter |
|---|---|
| Pokédollars, items and Rare Candy | The team |
| The whole card collection (only usable where it belongs) | Saved teams |
| Badges, League records, stats, daily gift | The starter |

### The rules in a region

- **Captures** come only from the region's generation, on every ball, and only from the part of it that's open (see
  Captures below). The region picker returns in the World.
- **The Pokédex, the team and the auto team** only show and accept the region's Pokémon.
- **Evolutions** need both forms to be of the region's generation. Golbat can't become Crobat in Kanto or Johto, and Pichu
  can't become Pikachu in Johto; both can in the World. The card says so instead of pretending it doesn't evolve.
- **Opponents** can use their region's generation and older ones, so Johto's Morty keeps his Gengar, but nobody in Kanto has
  a Crobat or a Magnezone. Hoenn's Phoebe and Glacia have Journey rosters, since their Classic ones are mostly Gen 4.
- **A League run in progress** has to end before traveling, since its team is registered.
- **A first League title** gives a shiny of that chapter's own starter.

### Captures

A region can't be bought. Two rules work together, and both only apply to the Journey:

**Each region opens with its badges.** With no badges, captures bring only the weakest quarter of the region by base stats.
Each badge opens an equal part of the rest, so the strongest forms and legendaries come at the end (`CAPTURE_OPEN_SHARE`).
This is the limit money can't get around. Master Balls are exempt: they only hold legendaries and come as gifts.

| Badges in Kanto | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Species captures can bring | 38 | 52 | 67 | 81 | 95 | 109 | 123 | 137 | 151 |

**Captures cost real money** (`JOURNEY_PRICES`). Classic's ×50 and ×100 aren't sold, and rare levels stop being cheap:

| Ball | ×1 | ×10 | Classic's price per ball |
|---|---|---|---|
| Poké Ball | ₽50 | ₽500 | ₽5 |
| Safari | ₽100 | ₽800 | ₽15 |
| Great Ball | ₽150 | ₽1,200 | ₽50 |
| Ultra Ball | ₽250 | ₽2,000 | ₽150 |

At these prices a player could spend themselves out of the game, since battles need six Pokémon and are the way to earn
money. So anyone with fewer than six usable cards who can't afford a Poké Ball gets topped up to one
(`rescueBrokePlayer`).

### Difficulty

In Classic, levels climb across regions and Hoenn and Sinnoh need shinies, because the team carries over. A fresh start
can't work that way, so in the Journey every region follows Kanto's curve, plus 5 levels per region before it
(`JOURNEY_LEVEL_STEP`). The money and candy carried over make later fresh starts faster, which is the reward for finishing
a region. Everything stays under the Lv. 100 cap, so normal cards can win every region's first playthrough.

| Region | Gyms | League | Legendary Battle |
|---|---|---|---|
| Kanto | 15–58 | 60–70 | Lv. 70 |
| Johto | 20–63 | 65–75 | Lv. 75 |
| Hoenn | 25–68 | 70–80 | Lv. 80 |
| Sinnoh | 30–73 | 75–85 | Lv. 85 |

Every region also pays and charges Kanto's coins, matching its levels: gym prizes, League fee and prizes, and the Legendary
Battle's fee. Bigger prizes would buy the next region on arrival. The World's Master League keeps its own. Rematches, title
bonuses and the training up against strong teams work the same way. These numbers are a starting proposal: they haven't
been playtested (see Open questions).

## How it's built

```
src/game/regions.ts   REGION_IDS: the only list of regions
src/game/journey.ts   Chapters, what the active chapter allows, level curve, travel()
src/state/track.ts    Classic or Journey, and where each one stores its data
src/screens/journey.ts  The chapter map (#/journey)
```

- **Chapters come from `REGION_IDS`**, with the World always last. Unlocks, the map and the level curve are derived from it.
- **A single question drives the rules:** `activeChapter()`. It's `null` in Classic, and then every helper answers
  "everything is allowed" (`playerCanUse`, `opponentCanUse`, `visibleRegions`, `modeInChapter`…). So the rule modules gain
  small checks that do nothing in Classic, and the original test suite and save fixtures keep guarding that game.
- **The team stays in `save.deck`.** The active chapter's team, saved teams and starter live in the save's usual fields, so
  the rest of the game doesn't know about chapters. `travel()` swaps them with `save.journey.slots`.
- **Traveling reloads the page**, as signing in and resetting already do, so screens never handle a chapter change.
- **The save** adds one optional field, `journey`, and only Journey games have it. It's "a new field with a default", so
  `SAVE_VERSION` stays at 3.

### Why the main branch keeps working (Firebase and saves)

Both versions can run at once, on one Firebase project and in one browser, because their progress never meets:

| | Classic (and the `main` branch) | Journey |
|---|---|---|
| Local save | `pg-save-<uid>` | `pg-journey-save-<uid>` |
| Cloud saves | `pokegacha_saves` | `pokegacha_journey_saves` |
| Online ranking | `pokegacha_leaderboard` | `pokegacha_journey_leaderboard` |
| Capture history, capture region, Pokédex filters | `pg-capture-history-<uid>`… | `pg-journey-capture-history-<uid>`… |

Sharing wouldn't be safe: `writeCloudSave` replaces the whole document, so each version would erase what the other stored,
and a higher `SAVE_VERSION` would make `main` think its app is outdated and reload. `src/state/track.test.ts` pins Classic's
names and `SAVE_VERSION`. `src/state/store.test.ts` switches games while signed in, against a fake Firestore, and checks
the other game's saves stay byte for byte the same. The track is decided once per page load: leaving a page writes the
current save, so changing it mid-page would write one game's save over the other's.

What they do share is harmless: the Google session, language, sound, battle speed and the dock's collapsed state.

[firestore.rules](../firestore.rules) only gains two blocks; the existing ones are unchanged. **It needs publishing before
signed-in players can use the Journey**. Guests can play without it, though the Ranking tab can't load its boards. Until
then, signing in on the Journey fails with a permission error, and `main` isn't affected.

### Which game a player gets

1. The choice in this browser (`pg-track`): what they picked, or the game they last entered.
2. Without one, if this browser has a Classic save: Classic.
3. Otherwise `DEFAULT_TRACK`, the Journey on this branch. But if they sign in and their account has a Classic cloud save,
   they go back to Classic. Nobody is moved by surprise, even in a new browser. Picking the Journey on the login screen
   counts as a choice.

## Adding a region

Follow "Adding a generation" in the [README](../README.md). The chapter appears by itself, before the World, once
`REGION_IDS` has its id. TypeScript points at every table that needs the new region, since they're `Record<RegionId, …>`.
`src/game/journey.test.ts` checks that each region has its gyms, starters, Elite Four, Champion, friends and legendaries.

The Journey's rules need no editing. A fifth region's curve is 35–78 for gyms and 80–90 for its League, and the World then
opens with that region's title. As usual, it also needs a `SAVE_VERSION` bump, since older apps can't show its content.

Three small things to touch by hand:

- A `.jc-<region>` color in `src/styles/journey.css` (without one, it uses Kanto's red).
- Texts that count the Leagues: "all four" in the Master League's strings in `src/i18n/*/regions.ts` and `modes.ts`.
- `journeyRoster` on any Elite Four member whose roster leans on newer species. `src/game/journey.test.ts` lists which
  rosters need it (Phoebe and Glacia in Hoenn did).

Players already in the World stay there, since an entered chapter never closes. The Master League asks for every title, so
it locks for them until they win the new region's League, and they can catch its Pokémon in the World before that. Worth
deciding again when the region is real.

## Open questions

- **Balance:** the level curve, prices and opening pace need playtesting (`JOURNEY_LEVEL_STEP`, `JOURNEY_PRICES`,
  `CAPTURE_OPEN_SHARE`). Fewer captures also means fewer levels from duplicates, so early gyms may feel harder. Rare Candy is
  bought with global money, so farming an old region is a real way to power up a new team. That's the intent.
- **Deploying:** `deploy.yml` only publishes `main`, so this branch has no public site yet. Merging into `main` would make the
  Journey the default for new players (`DEFAULT_TRACK`), while existing players stay on Classic.
- **Cards evolved in the World** leave the old region's team, because the new form doesn't belong there. A new copy of the
  base form makes a new card, so the team can be rebuilt.
- **Dead ends in a region:** babies and items whose evolution belongs to another generation wait for the World (Pichu in
  Johto, Budew in Sinnoh, an Up-Grade won in Johto). The card explains it, but it may still surprise players.
- **Rematches and title bonuses** can pass Lv. 100 (Sinnoh's League reaches 125), as Kanto's do in Classic.
