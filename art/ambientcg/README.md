# ambientCG surface textures (CC0)

Photo-scanned textures for the level's walls, ground, roof and props (look and feel 2). Every
ambientCG asset is CC0 1.0 (https://ambientcg.com/license, read 2026-11-04); credit is optional and
given anyway: **ambientCG.com**.

| Files | Source asset (1K JPG) | Used for |
|---|---|---|
| `mud_albedo.jpg`, `mud_normal.jpg` | [Ground071](https://ambientcg.com/view?id=Ground071): mud with straw and sticks | the ground |
| `stone_albedo.jpg`, `stone_normal.jpg` | [Bricks113A](https://ambientcg.com/view?id=Bricks113A): dressed natural stone | the Watchhouse, ruins, entry hall and fire ring (tinted darker for the hall and ring) |
| `planks_albedo.jpg`, `planks_normal.jpg` | [Planks023A](https://ambientcg.com/view?id=Planks023A): dark weathered planks | the roof, crates, chests, the charred logs |

Each albedo is the asset's Color map multiplied by its (softened) AmbientOcclusion map; each normal
is its NormalGL map (Godot's convention). The tints and tiling densities live in
`AshenWildsBootstrap.SURFACES`; the walls are drawn by `shaders/foreground_cutaway.gdshader`, which
projects the texture in world space so a box of any size tiles at the same density.
