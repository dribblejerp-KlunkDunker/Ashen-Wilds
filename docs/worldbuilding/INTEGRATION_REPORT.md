# Browser-to-Godot lore integration

Date: 2026-11-09
Status: partial; review branch only. Not a completed merge or gameplay implementation.

## Provenance

- Source: dribblejerp-KlunkDunker/Grim-Dark-Ashen-Wilds-
- Pinned source commit: b46237b50b9aa1244e394b165364ad0ac5c6b5f6
- Target: dribblejerp-KlunkDunker/Ashen-Wilds
- Target baseline: 36e45b42f70f62e79abab84802b17bea6b20f7ee
- Branch: integration/lore-parity
- Existing open pull request: #36, integration/lore-parity into main. Reuse this review rather than create a duplicate. PR metadata and validation results have not yet been updated or reviewed by this integration pass.
- Target main was observed at 1c6b9166c9c857e991c91eeea750b0a2f2c1e43e when PR #36 was listed. It has advanced since the baseline; review current mergeability and concurrent changes before merging. This pass does not modify main or the source repository.

## Preserved so far

- [Rook's Stair: The Held Benches](rooks-stair-quarry-supplement.md): proposed lore and custom d20 rules, documentation only. First import commit: b3ae89b556c5b77aeb30c83366eb70c4b037d497.
- [The Silt Readers and the Drowned Measures](silt-readers-and-drowned-measures.md): proposed regional lore, source preserved without intentional prose changes. Import commit: cebf5357b63f4d1fc5afa5bf0ba3eaebfa810980.
- [Drowned Measures playbook](drowned-measures-playbook.md): proposed player procedure, Cutwardens, Rootstone Witness, two d20 event tables and Valid When Issued quest; source preserved without intentional prose changes.
- [Worldbuilding index](README.md): updated additively to link the three imports and distinguish lore status from runtime implementation.

No single-player or multiplayer implementation is claimed for these imports. Source prose references quarry-recreated/README.md, which remains pending; that reference does not mean the package is present.

## Continuity adaptations

CANON.md and explicit owner decisions retain precedence. Only humans are people (O1). In the Godot quarry supplement, dog-feeding goblin households become human salvage households; negotiating goblin salvage groups become human salvage groups; the trading goblin pair becomes a human salvager pair. These adaptations preserve the negotiation and salvage situations without making beasts into speaking peoples. The original wording remains in the pinned source repository. No other owner decisions are changed.

## Remaining queue

1. Import quarry-recreated/README.md, manifest.json, quarry-workshop.html and tests.cjs together. Reconcile the source README's speaking goblins Rikk and Senn under O1 or segregate the original as archival-only. Original manifest hashes must not be represented as hashes of adapted files.
2. Validate the workshop package: provenance and hashes, Node core tests, then browser interaction separately. Source claims about 14,400 generation cases are historical claims, not fresh validation results.
3. Update CANON.md additively for the imported proposals without changing confirmed owner decisions; finish index/report status after workshop import.
4. Update existing PR #36 for the full validation scope, inspect its diff, mergeability and CI results against current main, and record actual evidence. Do not create a duplicate PR or merge automatically.
5. Keep runtime implementation as separately scoped work, including server authority, save compatibility and tests. Preserve existing Godot-only lore, scripts, scenes, assets, instructions and workflows.

Unresolved Mara Venn/Harl conflicts and missing historical faction-bible/Reedwake references remain unresolved; no recovered content is invented here. The quarry supplement is the earlier topological proposal; the source workshop's metric pass is pending import and review.

## Validation limits

Repository instructions, source lore, index and workshop metadata were inspected. These content commits change Markdown only. No Godot, browser, navigation, balance or workshop test execution is claimed. No local clone or Git bundle backup was created by the connector. The pinned commits record baselines; a branch is not an independent backup. The shared main branch has not been modified by this pass.
