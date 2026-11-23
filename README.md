# dsh-peak-badge

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-6f42c1.svg)](https://github.com/ibuildrun/dsh-peak-badge)

A tiny DeepSeek Harness plugin that shows the current DeepSeek pricing tier —
peak (2×) or off-peak (0.5×) — and the time left until the next switch, right
in the composer row next to the model selector.

```
● Off-peak ×0.5 · peak in 11h 17m
● Peak ×2 · ends 15:00
```

Clock times follow the local clock of the viewer; the schedule itself is
computed in UTC. A Russian UI renders the same badge as
`● Непик ×0.5 · пик через 11ч 17м` and `● Пик ×2 · до 15:00`.

## Why it matters

DeepSeek bills peak hours at **twice the off-peak rate**. Long agent runs,
batch jobs and experiments cost half as much when they start and finish
outside the peak windows. The badge tells you at a glance whether starting now
is cheap, and how long the current tier has left.

## Schedule

DeepSeek's published peak schedule, in UTC:

| Days           | Peak (2×)                           | Off-peak (×0.5) |
| -------------- | ----------------------------------- | --------------- |
| Monday–Friday  | 01:00–04:00 and 06:00–10:00 UTC     | all other hours |
| Saturday–Sunday | —                                  | all day         |

The badge computes the tier in UTC and never hardcodes a local time zone, so it
stays correct wherever the browser runs; clock values in the badge and tooltip
are rendered in local time with the browser's `Date` methods.

Chinese statutory holidays are off-peak on DeepSeek's side. The badge
implements the published weekly window only — it does not ship a holiday
calendar, so on a statutory holiday weekday it still follows the weekday
schedule.

## Install

With the DSH CLI:

```sh
dsh plugin --profile <profile> add github:ibuildrun/dsh-peak-badge
```

From a local checkout, use the `link:` form:

```sh
git clone https://github.com/ibuildrun/dsh-peak-badge.git
dsh plugin --profile <profile> add link:./dsh-peak-badge
```

Reload the DSH client after installing so the bundle is mounted.

The bundle ships a single inert host row (`peak-badge` in `cordis.patch.yml`).
It declares no services, routes or configuration; it exists only so the loader
includes the bundle and mounts the browser half. Keep it in place when wiring
the bundle into a profile manually.

## How it behaves

- **Client-only.** Renders into `conversation.input.left`. No host RPC, no
  network requests, no storage writes, no telemetry, no configuration.
- **No tokens.** The badge never talks to a model or to the DeepSeek API;
  showing it costs nothing.
- **Live.** Re-renders every 30 seconds and follows changes of the DSH UI
  language.
- **Readable.** A red dot for peak (`#e5534b`), a green dot for off-peak
  (`#3fb950`); the tooltip explains the current rate and the absolute local
  time of the next transition.

## Language

Russian when the DSH UI language is Russian, English otherwise. Detection is
best effort and read-only:

1. the `lang` attribute of the document root, as set by DSH;
2. a DSH locale hint in `localStorage`, if one is present (never written);
3. the first entry of `navigator.languages`, or `navigator.language`;
4. English.

Only `ru` and `en` string sets are bundled; any other UI language gets English.

## Compatibility

- DeepSeek Harness `>= 0.2.0` (client bundle format and the
  `conversation.input.left` slot).
- DeepSeek Harness Web and desktop builds, in any browser DSH supports.
- Node.js `>= 22` is needed only for development and tests; the plugin has no
  runtime dependencies and no build step.

## Development

```sh
git clone https://github.com/ibuildrun/dsh-peak-badge.git
cd dsh-peak-badge
node --check lib/client.js
node --test
```

The tests load `lib/client.js` in a `vm` context with a stubbed
`window.__ModuleLoader__` and React module, then exercise the exported
internals: `inPeak`, `nextTransition`, `pickLang`, `formatDuration` and
`formatClock`. No install step is required.

| Path               | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `lib/index.js`     | Inert host half                                          |
| `lib/client.js`    | Browser half, a plain `window.__ModuleLoader__.load` bundle |
| `cordis.patch.yml` | The bundle row that loads the client half                |
| `test/`            | `node:test` suite                                        |

## License

MIT. See [LICENSE](LICENSE). This plugin is not affiliated with or endorsed by
DeepSeek.
