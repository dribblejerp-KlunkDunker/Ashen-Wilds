# Rook's Stair: The Held Benches

> **Note, 2026-11-11 (owner decisions O3, O4, O5).** "Godot" in this file means the retired isometric game. Its ruling that the troll has no magical stone armour stands under O4. See `CANON.md`, *Reading the older files after O3, O4 and O5*.

Prepared 2026-11-09. Proposed lore and custom tabletop playtest rules, not implemented game systems. Additive supplement to bestiary.md and bell-road-locations.md. Repository storage does not settle canon. No existing lore, code, assets, saves or checkpoints are replaced.

## Godot integration note

Imported from dribblejerp-KlunkDunker/Grim-Dark-Ashen-Wilds- at commit b46237b50b9aa1244e394b165364ad0ac5c6b5f6. The original remains in that repository. Three passages about goblin households, negotiating salvage groups and trading goblins are adapted here to human salvagers under owner decision O1 in CANON.md. No new species, faction membership or finalized canon is approved by this import. See INTEGRATION_REPORT.md.

## Continuity and scope

Rook's Stair already exists as the quarry branch of the Bell Road. The existing bestiary identifies its lower terraces as Blind Quarry-Troll habitat. This supplement develops that predator rather than introducing a replacement quarry apex. It does not identify the Roofed Mile animal or explain what the orks fled. The Gravenback remains a separate proposed frontier apex, not a routine second boss here.

Ash curs substantially overlap the existing Greymaw wild dogs. Proposed resolution: ash cur is a local carrier name for Greymaw, not a new species. Pending approval, use the existing Greymaw ecology: 30-45 kg, 0.60-0.80 m shoulder height, packs of four to nine. Smaller encounters are foraging subgroups. Particular human salvage households may tolerate or feed particular dogs; this is not universal domestication or command over wild packs.

This file preserves a structured design consolidation, not a verbatim transcript or recovery of the earlier generator HTML. That HTML is not included in this commit.

## Custom rules frame

Experimental d20 system, not D&D challenge ratings and not the current browser or Godot combat implementation. A round is six seconds. Each creature gets one move and one action; no opportunity attacks. Attacks roll d20 + attack against Defense; ties hit. Natural 1 misses, natural 20 hits without extra damage. Saves roll d20 + save against DC; ties succeed. An action may attack, interact, help (+2 to one ally's next relevant roll), or move again. Distances are metres. Difficult ground doubles movement cost. Standing costs 3 m.

Fatigue is 0-3: each point gives -1 to attacks and saves and -1 m movement; at 3 no running. Ten minutes of suitable shelter, water and rest clears one point from exertion; cold fatigue also needs dry clothing and warmth. These are fictional encounter abstractions, not outdoor safety guidance.

## Blind Quarry-Troll: custom stat block

Role: solitary territorial sound-hunter; ledger tier IV, Leave. Height 2.60 m hunched, width 1.60 m, estimated mass 900-1,200 kg, matching the existing lore profile.

| HP | Defense | Attack | Damage | Move | Save | Threat cost |
| --- | --- | --- | --- | --- | --- | --- |
| 85 | 14 | +7 | 2d8 + 3 | 6 m | +5 | 14 |

Threat cost is only an experimental encounter-budget number, not a validated level recommendation.

### Hearing and memory

Use the ledger's approximate open-ground sound reaches as tabletop thresholds: searching a container 5 m; walking 6 m; dodging 9 m; shield impact 10 m; weapon swing 12 m; sprinting 14 m; blade against stone 16 m. A substantial intervening stone barrier halves these ranges. Ordinary light does not reveal a target to this blind creature. Poor smell does not provide automatic tracking of a still, quiet person.

A successful audible event records a location, not a perfect moving target. It remembers that location for one round, then returns home if no new sound occurs. Resolve simultaneous noises by strongest nearby event, then nearest if equal. Quiet movement at half speed has a proposed 3 m hearing reach; this addition needs playtesting.

### Actions and readable counterplay

1. Investigate: move toward the last audible location. Walking to it does not grant a free attack.
2. Double-fist pound: one action, one target within 2 m of the recorded location, attack +7, 2d8 + 3 damage. At the end of the preceding turn it plants its feet and raises its fists. Targets may leave the threatened location before resolution. If nobody remains there, it strikes empty ground. No automatic retargeting.
3. Defensive sweep: if directly struck, it may use its next action for one attack against an adjacent attacker it can locate. No free retaliation.
4. Thrown-stone decoy: a character spends an action throwing a stone to a visible point within 12 m. The landing creates a noise audible within 12 m of that point. It draws investigation, not guaranteed control if a stronger sound intervenes.

No regeneration, magical stone armor, omniscient tremorsense or unexplained teleportation. A 1.35 m service doorway blocks its 1.60 m shoulders. Rough pillars obstruct movement and attacks normally.

### Retreat

When it loses its sound, it returns to its resting shelf. At 42 HP or below it withdraws toward its lower shelter if a route exists. At 21 HP or below it abandons the feeding site. It pounds an escape obstruction only when cornered; it does not deliberately engineer rockfalls.

### Ecology, signs and salvage

It waits near animal routes and scavenges as well as hunting. Lower terraces provide shelter, not infinite food; it ranges beyond the playable map between encounters. Signs include fist-shattered stone, a dust-crusted shape that changes position between visits, and a broad rubbed passage. Quarry residents time visits and avoid its ground; they do not control it. Potential salvage is reachable quarry equipment and scattered belongings, not automatic treasure generated by its death. Animal remains are not automatically safe food.

## The Benchwardens

A proposed faction of eighteen residents occupying the upper quarry works: cutters, haulers, dependants and former tally hands. They hold the gate, usable tool store and haul ramp, not every terrace or lower gallery. The quarry is abandoned as an industrial enterprise, not empty of inhabitants.

Principle: nobody works beneath stone that another person has not inspected.

Contradiction: their inspection service genuinely prevents deaths, but they ration inspection, safe routes and tool access to bind newcomers to work obligations. Their safety marks become a form of property.

They trade recovered dressed stone, fittings, repair work and route knowledge for food, fuel, cloth and sound rope. They have no functioning large-scale extraction operation. Connection to the Split Kiln is a proposed small supply arrangement, not a grain-preservation monopoly.

### Three decision-makers

- Mara Sorn, bench caller: assigns work and shelter. She will close a productive terrace when it becomes unsafe, but assigns unrecognized newcomers the least desirable inspected jobs. Her name does not imply a connection to Mara Venn.
- Edda Vennick, sounding hand: checks routes and records new cracks. She refuses to mark uninspected stone safe, including when Mara needs its salvage. She knows the troll's observed habits, not its thoughts.
- Tollen Rake, stores keeper: maintains tools and ration accounts. He grants tool advances against future labor; he has quietly extended several debts because writing them off would expose an empty store.

### Membership and outsiders

Visitors may trade at the upper gate without joining. A chalk-marked escorted route costs agreed goods or a defined shift of work; no surprise lifetime debt. Membership requires a witnessed work agreement, not ancestry. The dispute is whether dependants and injured members retain shelter when they can no longer fulfill the agreement.

They use hand signals in sightlines and runners between separated posts. Chalk records an inspection date and initials, never a supernatural guarantee. Reports are local: the faction learns theft or violence through witnesses, discovered losses or missed returns, not global reputation magic.

### Regional relationships

Split Kiln households need manageable stone deliveries; Benchwardens need kiln repair materials. The Grey Lash could haul loads beyond the wardens' capacity, but no contract is presumed. Human salvage groups negotiate over small fittings and confined service routes; some trade, others steal. No existing named household is automatically assigned here. Goblins remain scavenging beasts, not negotiating people (O1).

### Playable conflict: The Closed Bench

A newly exposed beam and iron assembly could repair the upper haul ramp. Edda has closed its terrace after fresh cracking. Tollen has already accepted supplies against delivery. Mara asks outsiders to inspect an alternative approach. Possible solutions include a smaller recovery, a renegotiated delivery, an engineered bypass, or abandoning the salvage. Killing the troll does not repair the ramp or settle the debt.

## Encounter layout

Topological layout, not a surveyed battle grid. North is up. Approximate principal links are 10-30 m; exact lengths and line of sight must be authored before combat. Elevation: upper bench +8 m, middle bench +4 m, working floor 0 m, sump shelf -2 m. Labels A-J are locations, not occupied squares.

```text
                            N
                            ^
                   [J LOWER SHELTER]
                     /           \
              [I TROLL SHELF]---[H LOWER ADIT]
                     |               |
            [G WORKING FLOOR]---[F FLOODED SUMP]
                  /       \             :
         [D SCREE RAMP]   [E WINCH]      : ladder
                  \       /            :
                [C MIDDLE BENCH]---[B SERVICE CUT]
                        |                 |
                  [A UPPER GATE]----------+
                        |
                 Bell Road quarry branch
```

Solid links are traversable routes with the conditions below. The F-B ladder is optional, initially broken, and never the only escape. No route is connected merely because two labels are near each other on the diagram.

| Key | Contents and tactical role |
| --- | --- |
| A | Benchwarden gate, work shelter and trade point. Main public exit south. Residents need a reason to deny retreat; no automatic locked gate. |
| B | 1.35 m service cut to A and C; cover from larger creatures. Broken ladder overlooks F. Its initial condition is visible. |
| C | Middle terrace, fresh inspection board, rope anchor and failing outer edge. Safe inner lane remains available. |
| D | Loose scree shortcut between C and G. Open sightline, poor charge footing. |
| E | Winch station between C and G. Unstable carrier hangs over a marked lane; broad ramp remains usable. |
| F | Sump at G's eastern edge, with a shallow perimeter route toward H. Deep water is optional, not required to reach H. |
| G | Working floor, pillars and spoil heaps; partial cover. A marked overhang threatens one side, not the whole floor. |
| H | Lower adit, broad enough for the troll; connects F, I and J. A bend blocks direct sight. |
| I | Troll's usual resting shelf. This is a possible initial position, never an unavoidable spawn on arrival. |
| J | Lower shelter and withdrawal route beyond the encounter boundary. Preserve this exit unless player actions actually block it. |

### Quarry hazard blocks

1. Loose scree at D: half-speed passage needs no check; rushing requires DC 12 save or slide 3 m and fall prone. A marked stable patch ends the slide. All creatures use the same rule.
2. Failing edge at C: visible cracks define a 3 m outer strip. Crossing it requires DC 12 save or a 2 m fall for 1d6 damage; the strip then collapses permanently. The inner lane is safe.
3. Hanging rubble at G: a clearly marked fractured overhang activates only after heavy impact or direct disturbance. Creatures beneath make DC 13 save; failure 2d6 damage and prone, success half damage and upright. Rubble becomes difficult ground. Ordinary speech does not activate it.
4. Flooded sump at F: shallow margins are difficult ground. A creature in the marked deep water must swim or spend an action and pass DC 12 save to reach an adjacent reachable edge or flotation aid. Help gives +2. Each complete round struggling adds one cold fatigue, maximum three. No extra hidden drowning rule in this prototype.
5. Winch carrier at E: visible fraying and movement warn of failure. Direct interference triggers one swing through the marked lane: DC 12 save or 1d8 damage and 2 m shove. Then it settles or breaks. No repeating free trap.
6. Sound escalation: machinery crashes and major falls can alert a nearby troll if a connected route exists. Announce a scrape and heavy movement. Reinforcement arrival takes at least three rounds. If the troll is already in the scene, apply its local hearing rules instead of spawning another. No exact position is learned through noise alone.

For a standard encounter activate one physical hazard, retain an alternative route, and use at most one clearly signaled escalation. Other hazards remain marked features until disturbed. DCs reflect conditions, not party level.

### Example encounter: The Counterweight

The party needs an iron fitting at E. A human salvager pair waits at B to trade information, not automatically ambush. The troll rests at I and a hauler waits at A. Quiet retrieval can avoid combat. Breaking the carrier creates noise and blocks its swing lane, but the broad ramp remains passable. A loud collapse gives time to withdraw through C-B-A while the troll investigates E. Do not force every hazard to activate.

## Gravenback retreat addendum

Custom prototype: HP 110, Defense 14, attack +8, damage 2d8 + 4, move 9 m, saves +6, threat cost 18. Four weight-bearing legs plus two short grasping forelimbs; solitary territorial hunter and kill thief. It is distinct from the unidentified Roofed Mile animal.

Priorities: preserve movement; protect dependent young if present; keep food when affordable; avoid needless injury.

- At 55 HP or below, controlled withdrawal. At 27 HP or below, abandon food and escape.
- If it loses 22 HP between the start of one turn and the next, give ground; withdraw if it cannot isolate a target on its following turn.
- Two failed charges, or two turns with no reachable target behind a substantial narrow barrier, end the commitment.
- If it secures its carcass, leave with the food instead of continuing combat.
- If its last usable exit is visibly threatened, preserve that exit immediately.
- A major nearby rockfall causes it to leave unstable footing, not become immune to terrain.

Signal withdrawal by releasing the carcass, turning its body toward an exit and backing away. Controlled withdrawal uses normal movement; full escape spends the action for a second move and makes no attack. No free parting attacks in this system. Young change the retreat route, not create automatic death fights. A blocked animal tries alternate paths before attacking to get out. Following it does not automatically reset aggression.

## Review and integration

Prepared from repository lore inspection and conversation proposals. No runtime code changed; no combat, browser, Godot, navigation or balance tests claimed. Map is topological and needs a metric pass. Open decisions: ash cur/Greymaw naming, faction population and names, exact quarry placement, sound occlusion, balance and species approval. Mainline implementation requires a separate task branch, current game-code inspection and tests.
