import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const clientSource = readFileSync(join(repoRoot, 'lib', 'client.js'), 'utf8')

// Load lib/client.js the way the DSH browser bundle loader does: the file calls
// window.__ModuleLoader__.load() and the factory receives a require() shim.
function loadClient() {
  let definition = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(candidate) {
          definition = candidate
        },
      },
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(clientSource, sandbox, { filename: 'lib/client.js' })
  assert.ok(definition, 'the client bundle registers itself with window.__ModuleLoader__')

  const React = {
    createElement(type, props, ...children) {
      return { type, props, children }
    },
    useState(value) {
      return [typeof value === 'function' ? value() : value, () => {}]
    },
    useEffect() {},
  }
  return definition.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected require: ' + name)
  })
}

const client = loadClient()
const { inPeak, nextTransition, pickLang, formatDuration, formatClock } = client.__internals

test('exports the DSH client plugin plus testable internals', () => {
  assert.equal(typeof client.apply, 'function')
  assert.equal(client.inject.length, 1)
  assert.equal(client.inject[0], 'slots')
  assert.equal(client.default.name, 'dsh-peak-badge')
  assert.deepEqual(Object.keys(client.__internals).sort(), [
    'formatClock',
    'formatDuration',
    'inPeak',
    'nextTransition',
    'pickLang',
  ])
})

test('both weekday peak blocks are matched every minute of a weekday', () => {
  const dayStart = Date.parse('2026-11-23T00:00:00Z') // Monday
  for (let minute = 0; minute < 24 * 60; minute += 1) {
    const expected = (minute >= 60 && minute < 240) || (minute >= 360 && minute < 600)
    assert.equal(inPeak(dayStart + minute * 60_000), expected, `minute of day ${minute}`)
  }
})

test('the 04:00-06:00 gap between the peak blocks is off-peak', () => {
  const dayStart = Date.parse('2026-11-23T00:00:00Z') // Monday
  for (let minute = 4 * 60; minute < 6 * 60; minute += 1) {
    assert.equal(inPeak(dayStart + minute * 60_000), false, `minute of day ${minute}`)
  }
})

test('boundary instants switch exactly at the published UTC times', () => {
  const cases = [
    ['2026-11-25T00:59:59.999Z', false],
    ['2026-11-25T01:00:00.000Z', true],
    ['2026-11-25T03:59:59.999Z', true],
    ['2026-11-25T04:00:00.000Z', false],
    ['2026-11-25T05:59:59.999Z', false],
    ['2026-11-25T06:00:00.000Z', true],
    ['2026-11-25T09:59:59.999Z', true],
    ['2026-11-25T10:00:00.000Z', false],
  ]
  for (const [iso, expected] of cases) {
    assert.equal(inPeak(Date.parse(iso)), expected, iso)
  }
})

test('weekends are off-peak around the clock', () => {
  const saturday = Date.parse('2026-11-28T00:00:00Z')
  for (let minute = 0; minute < 2 * 24 * 60; minute += 1) {
    assert.equal(inPeak(saturday + minute * 60_000), false, `weekend minute ${minute}`)
  }
  for (const iso of ['2026-11-28T02:00:00Z', '2026-11-28T07:00:00Z', '2026-11-29T09:00:00Z']) {
    assert.equal(inPeak(Date.parse(iso)), false, iso)
  }
})

test('nextTransition finds the end of the current peak or off-peak state', () => {
  const nightCases = [
    ['2026-11-25T00:30:00Z', '2026-11-25T01:00:00Z'], // before peak -> peak start
    ['2026-11-25T00:59:30Z', '2026-11-25T01:00:00Z'], // not minute-aligned
    ['2026-11-25T01:00:00Z', '2026-11-25T04:00:00Z'], // at peak start -> block end
    ['2026-11-25T02:30:00Z', '2026-11-25T04:00:00Z'],
    ['2026-11-25T04:00:00Z', '2026-11-25T06:00:00Z'], // at first block end -> second block
    ['2026-11-25T05:30:00Z', '2026-11-25T06:00:00Z'],
    ['2026-11-25T07:00:00Z', '2026-11-25T10:00:00Z'],
    ['2026-11-25T10:00:00Z', '2026-11-26T01:00:00Z'], // after peak -> next day
    ['2026-11-25T23:00:00Z', '2026-11-26T01:00:00Z'], // across a night
  ]
  for (const [from, expected] of nightCases) {
    assert.equal(nextTransition(Date.parse(from)), Date.parse(expected), from)
  }

  const weekendCases = [
    ['2026-11-27T10:00:00Z', '2026-11-30T01:00:00Z'], // Friday after peak -> Monday
    ['2026-11-28T02:00:00Z', '2026-11-30T01:00:00Z'], // Saturday
    ['2026-11-29T23:30:00Z', '2026-11-30T01:00:00Z'], // Sunday night
  ]
  for (const [from, expected] of weekendCases) {
    assert.equal(nextTransition(Date.parse(from)), Date.parse(expected), from)
  }
})

test('nextTransition always lands on a minute boundary with the opposite state', () => {
  const start = Date.parse('2026-11-23T00:00:00Z')
  for (let step = 0; step < 14 * 24 * 2; step += 1) {
    const now = start + step * 30 * 60_000
    const next = nextTransition(now)
    assert.notEqual(next, null, `no transition from ${new Date(now).toISOString()}`)
    assert.ok(next > now, `transition is in the future from ${new Date(now).toISOString()}`)
    assert.equal(next % 60_000, 0, 'transition is minute-aligned')
    assert.notEqual(inPeak(next), inPeak(now), 'transition flips the state')
    assert.equal(inPeak(next - 60_000), inPeak(now), 'no earlier minute flips the state')
  }
})

test('formatDuration prints minutes and hours for both languages', () => {
  assert.equal(formatDuration(0), '0m')
  assert.equal(formatDuration(-5 * 60_000), '0m')
  assert.equal(formatDuration(30_000), '1m') // rounded to the nearest minute
  assert.equal(formatDuration(17 * 60_000), '17m')
  assert.equal(formatDuration(60 * 60_000), '1h')
  assert.equal(formatDuration(90 * 60_000), '1h 30m')
  assert.equal(formatDuration((11 * 60 + 17) * 60_000), '11h 17m')
  assert.equal(formatDuration((11 * 60 + 17) * 60_000, 'ru'), '11ч 17м')
  assert.equal(formatDuration(17 * 60_000, 'ru'), '17м')
  assert.equal(formatDuration(60 * 60_000, 'ru'), '1ч')
  assert.equal(formatDuration(17 * 60_000, 'de'), '17m') // unsupported -> English
})

test('formatClock prints the viewer local clock time', () => {
  const ms = Date.parse('2026-11-25T06:07:00Z')
  const local = new Date(ms)
  const expected = String(local.getHours()).padStart(2, '0') + ':' + String(local.getMinutes()).padStart(2, '0')
  assert.equal(formatClock(ms), expected)
  assert.match(formatClock(ms), /^\d{2}:\d{2}$/)
})

test('pickLang prefers the document language, then the hint, then the browser language', () => {
  assert.equal(pickLang('ru', undefined, 'en-US'), 'ru')
  assert.equal(pickLang('ru-RU', 'en', 'en-US'), 'ru')
  assert.equal(pickLang('en-GB', 'ru-RU', 'ru-RU'), 'en')
  assert.equal(pickLang(undefined, 'ru-RU', 'en-US'), 'ru')
  assert.equal(pickLang('', 'ru', 'en-US'), 'ru')
  assert.equal(pickLang(undefined, undefined, 'ru-RU'), 'ru')
  assert.equal(pickLang(undefined, undefined, 'en-US'), 'en')
  assert.equal(pickLang(undefined, undefined, 'de-DE'), 'en')
  assert.equal(pickLang(null, null, null), 'en')
  assert.equal(pickLang('de-DE', 'ru-RU', 'en-US'), 'ru') // unsupported candidate falls through
  assert.equal(pickLang('RU'), 'ru') // case-insensitive
  assert.equal(pickLang(' en_US '), 'en') // trimmed, underscore separator
})
