# Recorded instrument samples

HARU plays its music with real recorded instruments. A small subset of each library was trimmed,
normalised and converted to mono MP3 by `tools/build-samples.js`; pitches were measured (YIN) and
mapped in `manifest.json`.

| Library | Author | License | Used for |
|---|---|---|---|
| [VCSL — Versilian Community Sample Library](https://github.com/sgossner/VCSL) | Sam Gossner / Versilian Studios & contributors | CC0 1.0 (public domain) | piano, FM e-piano, vibraphone, marimba, glockenspiel, kalimba, tenor sax, all drums & percussion |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | Sam Gossner / Versilian Studios & contributors | CC0 1.0 (public domain) | string ensemble, pizzicato, contrabass, harp, flute, clarinet, trumpet, French horn |
| [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) | Nicholaus P. Brosowsky | CC BY 3.0 (samples) | electric bass, nylon / acoustic / clean electric guitar |

CC BY 3.0 attribution: *"tonejs-instruments" samples by Nicholaus P. Brosowsky, licensed under
CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Modified: trimmed, normalised, re-encoded.*

The music styles ("taste") in `src/js/styles.js` are original descriptions of instrumentation and
mixing habits; they do not reproduce any composer's work.
