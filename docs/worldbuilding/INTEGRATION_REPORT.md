# Browser-to-Godot lore integration

Date: 2026-11-09
Status: partial; review branch only. Not a completed merge or gameplay implementation.

## Provenance

- Source: dribblejerp-KlunkDunker/Grim-Dark-Ashen-Wilds-
- Pinned source commit: b46237b50b9aa1244e394b165364ad0ac5c6b5f6
- Target: dribblejerp-KlunkDunker/Ashen-Wilds
- Target baseline: 36e45b42f70f62e79abab84802b17bea6b20f7ee
- Branch: integration/lore-parity
- The source repository and target main are not modified by these content commits.

## Preserved so far

- [Rook's Stair: The Held Benches](rooks-stair-quarry-supplement.md): proposed lore and custom d20 rules, documentation only. First import commit: b3ae89b556c5b77aeb30c83366eb70c4b037d497.
- [The Silt Readers and the Drowned Measures](silt-readers-and-drowned-measures.md): source document preserved without intentional prose changes; proposed regional lore, documentation only.

No single-player or multiplayer implementation is claimed for either document. The source Silt Readers document references quarry-recreated/README.md, which is pending import; that reference does not mean the package is already present.

## Continuity adaptations

CANON.md and explicit owner decisions retain precedence. Only humans are people (O1). In the Godot quarry supplement, dog-feeding goblin households become human salvage households; negotiating goblin salvage groups become human salvage groups; the trading goblin pair becomes a human salvager pair. These adaptations preserve the negotiation and salvage situations without making beasts into speaking peoples. The original wording remains in the pinned source repository. No other owner decisions are changed.

## Remaining imports

- drowned-measures-playbook.md
- quarry-recreated/README.md
- quarry-recreated/manifest.json
- quarry-recreated/quarry-workshop.html
- quarry-recreated/tests.cjs

The workshop README also contains speaking goblins, named Rikk and Senn, and requires an explicit O1 adaptation or archival-only status. Its manifest hashes describe original bytes and must not be represented as hashes of adapted files. The source workshop describes a metric pass; the supplement remains the earlier topological proposal until that package is reviewed and imported.

## Remaining integration work

- Import and review the remaining files.
- Update the worldbuilding README and CANON.md additively once the complete batch is present.
- Record proposed/approved status separately from documentation/single-player/multiplayer implementation status.
- Preserve existing Godot-only lore, game scripts, scenes, assets, agent instructions and workflows.
- Review unresolved Mara Venn/Harl conflicts and missing historical faction-bible/Reedwake references without inventing recovered content.
- Validate imported workshop hashes and run its tests in a suitable environment; separately review browser interaction and any future Godot integration.

## Validation limits

Repository instructions, source lore and workshop metadata were inspected. These content commits add Markdown only. No Godot, browser, navigation, balance or workshop test execution is claimed. No local clone or Git bundle backup was created by the connector. The pinned commits record the baselines; a branch is not an independent backup. Main remains the rollback baseline until a separately reviewed pull request is merged.
