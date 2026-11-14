# Credits

What this repository can show about where its files came from. Where it cannot show an author, a
source or a licence, this file says **unverified** and does not guess.

## The engine

The code in `js/` other than `js/fork0.js`, `js/art2.js` and `js/ledge1.js`, and `css/`, `schemas/`,
`locales/`, `sw.js`, `tools/pwa/precache.js` and the layout of `index.html`, were copied on
2026-11-11 from *Echoes of the Shattered Octave*
(`github.com/dribblejerp-KlunkDunker/echoes-of-the-shattered-octave`, branch `phase-75-pixel-folk`,
commit `f2b3990`). Same owner as this repository. That repository declares no open licence
(`"license": "UNLICENSED"`); the copy was made at the owner's direction (decision D14).

Its code was written with AI assistance (its own credits record commits by Claude and Codebuff).

**None of its pictures are here.** Its embedded textures, sprites and hands (`js/assets.js`), its
creation faces, its prop renders and its app icons were removed in Phase 2 at the owner's ruling.
Some of the engine's own code still draws things procedurally (frames, roofs, ceilings, weather);
that is code, and it stays.

## Art

Every picture in this repository is made by code in this repository.

| Files | What | Made by |
| --- | --- | --- |
| `js/art2.js` | Eight tiles, the carter, Marget Sayle, the hearth, the bed, the table, the hand and blade, the game's mark | Painted in code |
| `js/ledge1.js` | Nine tiles, two glowing sprites, the land, the Slagcrown, the coal sun, the ash | Painted and built in code |
| `assets/icons/` | App icons | Written by `tools/icons.js` from the mark in `js/art2.js` |
| `img/title.png` | The title picture | A still of the game itself, written by `tools/shots.js` |
| `img/p_la_carter.jpg`, `img/p_la_marget.jpg` | Dialogue portraits | Cut by `tools/portraits.js` from the two paintings in `js/art2.js` |
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
