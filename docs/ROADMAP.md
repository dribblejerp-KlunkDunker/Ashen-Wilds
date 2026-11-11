# Roadmap: the work, phased by which model should do it

Written 2026-11-06. The owner has Opus 5.5 until Sunday 2026-11-08; after that, lighter models.
The rule: spend the strongest model on judgment and cross-system design, and on writing specs tight
enough for a lighter model to follow; give the lighter models pattern-following work with a precise
brief and tests to prove it. `docs/PRODUCTION.md` records what actually ran.

## Phase 1: Opus 5.5, until Sunday 2026-11-08

| # | Work | State |
|---|---|---|
| 1.1 | **Act I objectives.** Take back the Watchhouse, bring the pot to the shelter fire, return the warning book's three torn pages, break the ork hold on the Causeway; the act's close. `scripts/world/objectives.gd`. | **Done** (Lore 2 / Act I objectives, this file's PR) |
| 1.2 | **The multiplayer port: design.** How the single-player systems (health, hits, enemies, loot, the bible's notes) move into the server-authoritative courtyard: what the server owns, what a client predicts, which RPCs and save fields change, the order of slices. Written into `docs/PRODUCTION.md`. | Next |
| 1.3 | **The multiplayer port: first slice.** Server-owned health and one enemy (the goblin) fighting two players, with `tools/net_spike.py` checks. | After 1.2 |
| 1.4 | **Specs for Phase 2.** A brief per task below: files, the pattern to copy, the exact bible text, the tests to add. In `docs/specs/`. | Last, before Sunday |

If time runs out, 1.2 alone is still the most valuable thing to have from Opus.

## Phase 2: a lighter model after Sunday (Sonnet-class)

Pattern-following work, each against a Phase 1 spec:

- **Lore 2: the rest of the texts.** Carved inscriptions and boards (`items-and-texts.md` 4.2) as readable props, on the `ActionPoint` pattern the graves use. The notes meant for corpses (14, 15, 17, 24) and the band's mark and tally (7, 8). Varied weather banners (`the-smothering.md`). The alternative background epigraphs (`items-and-texts.md` 4.4).
- **New items from the bible:** lime (clears corpse-caps and spore growth), the wet-cloth mask (less choking); `items-and-texts.md` section 3.
- **The multiplayer port, later slices:** the next enemies on the pattern 1.3 sets. **Stop** and wait for a stronger model if a slice needs a new protocol decision.
- **Screenshots and the README** kept in sync after each slice.

## Phase 3: the smallest model, or any model

- Lore tidying: renames, cross-file name checks, rerunning `tools/generate_lore_texts.py` after bible edits.
- Doc and test-count updates, checklists.

## The owner's (no model can do these)

- **Playtest** Lore 1 and Act I: whether notes are read, the reading panel and objectives panel on a real screen, whether the banners feel like the place speaking or like interruptions, how long Act I takes.
- **Settle** the archive's Mara Venn and Harl name conflicts, and whether its "faction bible" and "Reedwake chapter" exist anywhere.
- If Fable becomes available: the multiplayer port's later slices are where it would pay off most.
