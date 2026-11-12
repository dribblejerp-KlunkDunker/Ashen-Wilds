# Credits

What this repository can show about where its files came from. Where it cannot show an author, a
source or a licence, this file says **unverified** and does not guess.

## The engine

Every file in `js/` except `js/fork0.js` and `js/ledge1.js`, and `css/`, `schemas/`, `locales/`,
`sw.js`, `tools/pwa/precache.js`, `assets/icons/` and the layout of `index.html`, were copied on
2026-11-11 from *Echoes of the Shattered Octave*
(`github.com/dribblejerp-KlunkDunker/echoes-of-the-shattered-octave`, branch `phase-75-pixel-folk`,
commit `f2b3990`). Same owner as this repository. That repository declares no open licence
(`"license": "UNLICENSED"`); the copy was made at the owner's direction (decision D14).

Its code was written with AI assistance (its own credits record commits by Claude and Codebuff).

## Art that came with the engine

| Files | What | Origin |
| --- | --- | --- |
| `js/assets.js` | Wall and floor textures, sprites (including the two used here for the carter and Marget Sayle), the hands and weapons | **Unverified** in the Octave's own credits |
| `img/face_1.jpg` to `img/face_6.jpg` | Faces for the engine's creation screen (not shown in this game) | **Unverified** in the Octave's own credits |
| `img/pixel3d/` | Props turned to five-view pixel sprites | Rendered from the Octave's own sprites with Blender (a build tool; nothing of Blender ships), per its credits |
| `assets/icons/` | App icons | The Octave's; origin **unverified** |

## Art made for this game

All of it is made by code in this repository. The image files below are pictures of the running game, or cuts of the engine's sprites.

| Files | What | Made by |
| --- | --- | --- |
| `js/ledge1.js` | Nine 64 x 64 tiles, two glowing sprites, the land, the Slagcrown, the coal sun, the ash | Painted and built in code |
| `img/title.png` | The title picture | A still of the game itself, written by `tools/shots.js` |
| `img/p_la_carter.jpg`, `img/p_la_marget.jpg` | Dialogue portraits | Cut by `tools/portraits.js` from the engine's two sprites above, so they share those sprites' origin |
| `docs/screenshots/` | Stills | Written by `tools/shots.js` |

The owner's key painting and reference images guided the look. They are not stored here.

## Typefaces

Bundled in `fonts/`, each under the SIL Open Font License 1.1, with the licence text beside it.

| Typeface | Authors (from the OFL text) | Files |
| --- | --- | --- |
| Cinzel | The Cinzel Project Authors, 2020 | `cinzel-latin-*.woff2`, `OFL-Cinzel.txt` |
| Alegreya | The Alegreya Project Authors, 2011 | `alegreya-latin-*.woff2`, `OFL-Alegreya.txt` |
| Alegreya SC | The Alegreya Project Authors, 2011 | `alegreya-sc-latin-*.woff2`, `OFL-AlegreyaSC.txt` |
| UnifrakturMaguntia | j. 'mach' wust (2010) and Peter Wiegel (2009) | `UnifrakturMaguntia.woff2`, `OFL-UnifrakturMaguntia.txt` |

## Libraries

| File | What | Licence |
| --- | --- | --- |
| `js/vendor/peerjs.min.js` | PeerJS, for the two-player link | MIT, per the notice in the file. Not re-checked against upstream here |

## Sound

Every sound is generated live with WebAudio by the engine (`js/audio.js`, `js/voices.js`). No sound
or music file ships. The engine asks for the Octave's music files, which are not here.

## Tools

Playwright and Chromium run the browser tests and write the stills. They are not bundled and are
not needed to play. Playwright is Apache-2.0 upstream; Chromium carries its own licences.

## Keeping this current

Add a row for anything new. If a source or licence is not known, write "unverified".
