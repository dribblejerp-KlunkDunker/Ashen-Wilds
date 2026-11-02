# Watchhouse reconciliation preparation

## Scope and status

Prepared against integration/watchhouse-survivor at 3d990df811c7ded232cebea023013bc2eb50d7f0. Observed main: 0c57b0b078d473e643785f660371a6a1610cd3b8.

This additive commit is NOT a Git merge and does not establish that main is an ancestor of this branch. It does not resolve all of PR #4's merge conflicts. No Godot compilation, execution or new passing count is claimed. Main, existing gameplay files, README, CLAUDE.md and workflows are unchanged.

## Changes

- scripts/combat/wall_deflection.gd: compatibility adapter; SwingGeometry remains authoritative. The advanced implementation's degenerate-normal fallback is intentionally retained; parity must be checked during verification.
- tests/reconciliation_smoke_test.gd: inherits the existing smoke suite and overrides the Act I test entry to run additional cleanup checks immediately before delegating to the original Act I test. The inherited save test remains last. Direct state-machine checks use a disabled Ogre dummy and restore shared player/coordinator state.
- Existing tests/ogre_target_cleanup_test.gd remains unchanged.

This differs from the earlier draft: instead of replacing the large existing smoke suite or appending to partially retrieved existing documentation, it adds a suite extension and this note. Running smoke_test.gd alone does NOT run the newly added checks. Run reconciliation_smoke_test.gd explicitly.

## Intended conflict resolutions still requiring a real merge review

- Ogre: retain the advanced implementation with exactly one _abandon_attack helper and its target-loss call. Do not replace the file with main's older version.
- Player, Goblin and Ork: preserve advanced integrations and SwingGeometry calls. Do not silently adopt main's different recoil durations, poses or older implementations. These differences are intentionally deferred, not declared equivalent.
- WallDeflection: keep this adapter rather than a second geometry implementation.
- Smoke suite: retain all advanced assertions and Act I/save ordering. Inspect incoming regression intent; do not copy the old enemy-deflection test block wholesale because its API, timing and expected behavior differ.
- README and CLAUDE.md: retain advanced architecture/feature descriptions. Update counts only from fresh successful runs of the exact reconciled commit, not from main's older 177-check baseline.

All resolution edits belong on the integration branch or a temporary branch based on it, not on main. PR #4 has main as its source; blindly updating that PR's source branch would modify main.

## Verification required

Use Godot 4.3-stable. Import, compile-check the adapter and both regression runners, then run the original smoke suite, the reconciliation smoke extension, and the standalone Ogre cleanup test twice each. Preserve raw logs, process exit codes and completion summaries. Check adapter behavior for degenerate normals and real wall collisions. Also perform an interactive Ogre death/respawn check.

Commands after import:

```bash
godot --headless --path . --script res://tests/smoke_test.gd
godot --headless --path . --script res://tests/reconciliation_smoke_test.gd
godot --headless --path . --script res://tests/ogre_target_cleanup_test.gd
```

The existing CI workflow checks pinned commit 41945737f3c693ff3dbf2e2e715bde25979c4ca9 and its original branch trigger. It does not automatically verify this integration preparation or a future reconciled commit. Updating CI and completing the merge require separate review and approval.
