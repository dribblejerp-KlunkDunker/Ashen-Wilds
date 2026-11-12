# CLAUDE.md - The Long Account

Guidance for Claude (and other agents) working in this repository. Player-facing documentation is
`README.md`. The design is `docs/worldbuilding/the-round-and-the-long-account.md`. The world's
rules are `docs/worldbuilding/CANON.md`.

## What this is

A first-person, co-op dark-fantasy game in **Godot 4.7.2-stable**, GDScript, Forward+ renderer.
It replaced the isometric Ashen Wilds game on 2026-11-11 (owner decision O5). Today it is a
**look test**: `scripts/main.gd` builds one scene in code, the prologue's ledge, and there is no
gameplay. The old game is on the branch `archive/isometric-prototype`; read its scripts for
reference before rebuilding a system, and never copy isometric assumptions across.

## Get Godot (cloud sessions do not have it)

    mkdir -p ~/godot && cd ~/godot
    curl -sSL -o godot.zip https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip
    unzip -o godot.zip
    export GODOT=~/godot/Godot_v4.7.2-stable_linux.x86_64

Use exactly 4.7.2-stable. A project opened in a newer editor is converted and cannot go back.
Commit the `.uid` file Godot writes beside each new script.

## Verify every change

    $GODOT --headless --path . --import
    for f in $(find scripts -name "*.gd" | sort); do
      $GODOT --headless --path . --check-only --script "res://$f" 2>&1 | grep -E "ERROR|WARNING"
    done
    $GODOT --headless --path . --quit-after 120 2>&1 | grep -E "SCRIPT ERROR|Parse Error"

Then **render and look**. A headless run draws nothing.

    sudo apt-get install -y mesa-vulkan-drivers     # once
    xvfb-run -a -s "-screen 0 1280x800x24" $GODOT --path . --rendering-driver vulkan -- --shots "$PWD/docs/screenshots"

Open every PNG it writes. The stills have caught real faults: a sky panel showing its edges, a
foreground lit entirely red, fog swallowing the citadel. Ash flecks move, so two runs never match
byte for byte.

## The look: rules that must hold

- **Scale.** The 3D view is 320 x 150 and is shown at exactly 4x (1280 x 600) with nearest
  filtering and the ordered dither in `_build_view()`. The ledger panel is 1280 x 200 beneath it.
  Never use a non-integer scale.
- **People are painted; beasts are modelled.** A human is a flat painted figure (`Sprite3D`,
  unshaded, alpha cut). A creature is real geometry through the same low-resolution pass.
- **Four lights, never confused.** Yours is tallow yellow and small. The land's is ember red and
  vast. Teal belongs to the bloom. Pale blue belongs to workings.
- **Cold where you stand, fire where you are going.** The ledge is lit cool; the far country burns.
- **Black is the base colour.** Build dark and add light.
- **The sky is a painting; the world is geometry.** `sky.png` is wrapped on an arc. Land, the
  Slagcrown, fires and smoke are real meshes.
- **In-game text is plain ASCII** (canon rule; the panel is drawn with it).

## Layout

    project.godot, main.tscn   the one scene; its root runs scripts/main.gd
    scripts/main.gd            view, sky and light, land_height() and the land mesh, the Slagcrown,
                               the ledge, the painted partner, camera, hands, panel, walking, stills
    scripts/ash_overlay.gd     ash and embers as single pixels over the low-resolution view
    assets/                    placeholder PNGs, loaded at run time with Image.load_from_file()
    tools/make_assets.py       rebuilds assets/ from the owner's key painting (Pillow, NumPy, OpenCV)
    docs/worldbuilding/        the world bible
    docs/screenshots/          the stills

`assets/` is loaded straight from disk, so `*.import` files are git-ignored. An exported build will
need those textures imported properly; nothing exports yet.

## Conventions and pitfalls

- **Typed GDScript everywhere.** Fix warnings; do not ignore them.
- **GDScript is not shader language.** `mix()` does not exist; use `lerp()` / `lerpf()`.
- **Set `position`, not `global_position`, before `add_child()`.**
- **Avoid particle nodes for anything that must be checked in a still.** They do not render under
  software Vulkan. Ash, embers, fire glow and smoke are meshes or drawn pixels.
- **`land_height(x, z)` is the one source of ground height.** Place anything that stands on the
  land by calling it.
- **Server authority is not negotiable** once networking begins: clients send intent, the server
  owns every shared outcome.

## Canon

Read `docs/worldbuilding/CANON.md` before writing any lore or in-game text.

- **O1:** only humans are people. Every creature is an animal, a lizard, a fish or a monster.
- **O3:** the wider world and this game's design decisions are approved.
- **O4:** small magic exists: spoken workings and marks on slag-iron. It is small and always costs.
- **O5:** this game replaced the isometric one; all lore is kept.
- No prophecy. Who made the Vaults, what the orks fled and why the Unnamed rise stay unsettled.

## Git

- Remote: `https://github.com/dribblejerp-KlunkDunker/Ashen-Wilds` (`main`).
- Commit under the owner's name and GitHub address, as earlier commits do, so GitHub credits them.
- Never force-push `main` without the owner's explicit OK. Never delete `archive/isometric-prototype`.
- Keep `README.md` in sync with what is actually built.

## Working with the owner (sleeves)

- Before a big design-heavy build, say whether a stronger model such as Fable is worth switching to.
- The owner works without a local Godot install: stills are how they see progress. Render them,
  look at them yourself first, and send them.
- Be honest about what a check cannot show: feel, motion, timing and how it reads on a real screen
  still need a person at the controls.
