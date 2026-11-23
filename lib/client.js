// Client half of dsh-peak-badge: a DeepSeek peak/off-peak pricing badge in the
// composer row next to the model selector. DeepSeek bills peak hours at twice
// the off-peak rate; peak runs Mon-Fri 01:00-04:00 and 06:00-10:00 UTC and all
// other hours, including weekends, are off-peak. The schedule is always
// computed in UTC, while clock times are shown in local time.
window.__ModuleLoader__.load({
  id: 'dsh-peak-badge',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var React = require('react')
    var MINUTE = 60000
    var DAY = 24 * 60 * MINUTE
    var REFRESH_MS = 30000

    var STRINGS = {
      en: {
        peakLabel: 'Peak ×2',
        offPeakLabel: 'Off-peak ×0.5',
        peakMetaPrefix: 'ends ',
        offPeakMetaPrefix: 'peak in ',
        hourShort: 'h',
        minuteShort: 'm',
        peakTitle: 'DeepSeek peak hours: full rate (×2). Off-peak rate starts at ',
        offPeakTitle: 'DeepSeek off-peak hours: half rate (×0.5). Next peak starts at ',
      },
      ru: {
        peakLabel: 'Пик ×2',
        offPeakLabel: 'Непик ×0.5',
        peakMetaPrefix: 'до ',
        offPeakMetaPrefix: 'пик через ',
        hourShort: 'ч',
        minuteShort: 'м',
        peakTitle: 'Часы пик DeepSeek: полный тариф (×2). Непиковый тариф начнётся в ',
        offPeakTitle: 'Непиковые часы DeepSeek: половина тарифа (×0.5). Ближайшие часы пик: ',
      },
    }

    function inPeak(ms) {
      var d = new Date(ms)
      var day = d.getUTCDay()
      if (day === 0 || day === 6) return false
      var minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
      return (minutes >= 60 && minutes < 240) || (minutes >= 360 && minutes < 600)
    }

    function nextTransition(ms) {
      var t = Math.ceil(ms / MINUTE) * MINUTE
      var current = inPeak(ms)
      var limit = t + 8 * DAY
      while (t <= limit) {
        if (inPeak(t) !== current) return t
        t += MINUTE
      }
      return null
    }

    function formatDuration(ms, lang) {
      var strings = STRINGS[lang === 'ru' ? 'ru' : 'en']
      var total = Math.max(0, Math.round(ms / MINUTE))
      var hours = Math.floor(total / 60)
      var minutes = total % 60
      if (hours === 0) return minutes + strings.minuteShort
      if (minutes === 0) return hours + strings.hourShort
      return hours + strings.hourShort + ' ' + minutes + strings.minuteShort
    }

    function formatClock(ms) {
      var d = new Date(ms)
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
    }

    function pickLang(documentLang, localeHint, navigatorLang) {
      var candidates = [documentLang, localeHint, navigatorLang]
      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i]
        if (typeof candidate !== 'string') continue
        var primary = candidate.trim().toLowerCase().split(/[-_]/)[0]
        if (primary === 'ru' || primary === 'en') return primary
      }
      return 'en'
    }

    function readLocaleHint() {
      // Read-only probe for a DSH locale hint; the badge never writes storage.
      try {
        var storage = window.localStorage
        if (!storage) return undefined
        for (var i = 0; i < storage.length; i++) {
          var key = storage.key(i)
          if (typeof key !== 'string' || !/(?:^|[._:-])(?:locale|lang|language)$/i.test(key)) continue
          var value = storage.getItem(key)
          if (typeof value !== 'string') continue
          var primary = value.trim().toLowerCase().split(/[-_]/)[0]
          if (primary === 'ru' || primary === 'en') return primary
        }
      } catch (error) {
        // Storage can be unavailable (private mode, sandboxed frame); ignore it.
      }
      return undefined
    }

    function detectLang() {
      var navigatorLanguage
      if (typeof navigator === 'object' && navigator !== null) {
        navigatorLanguage =
          Array.isArray(navigator.languages) && navigator.languages.length > 0
            ? navigator.languages[0]
            : navigator.language
      }
      var documentLanguage
      if (typeof document === 'object' && document !== null && document.documentElement) {
        documentLanguage = document.documentElement.lang
      }
      return pickLang(documentLanguage, readLocaleHint(), navigatorLanguage)
    }

    var CSS = [
      '.dshPeakBadge{display:inline-flex;align-items:center;gap:6px;font:var(--dsw-font-xs-13,12px);line-height:16px;white-space:nowrap;user-select:none;}',
      '.dshPeakBadgeDot{width:6px;height:6px;border-radius:999px;flex:none;background:currentColor;}',
      '.dshPeakBadgeLabel{font-weight:600;}',
      '.dshPeakBadgeMeta{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}',
    ].join('\n')

    function PeakBadge() {
      var state = React.useState(Date.now())
      var now = state[0]
      var setNow = state[1]
      React.useEffect(function () {
        var timer = setInterval(function () {
          setNow(Date.now())
        }, REFRESH_MS)
        var observer = null
        // DSH rewrites <html lang> after boot, so follow the attribute to swap
        // the label language without waiting for the next 30 s tick.
        if (typeof MutationObserver === 'function' && typeof document === 'object' && document && document.documentElement) {
          observer = new MutationObserver(function () {
            setNow(Date.now())
          })
          observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        }
        return function () {
          clearInterval(timer)
          if (observer) observer.disconnect()
        }
      }, [])
      var lang = detectLang()
      var strings = STRINGS[lang]
      var peak = inPeak(now)
      var next = nextTransition(now)
      var label = peak ? strings.peakLabel : strings.offPeakLabel
      var title = (peak ? strings.peakTitle : strings.offPeakTitle) + (next === null ? '—' : formatClock(next))
      var meta = ''
      if (next !== null) {
        meta = peak
          ? strings.peakMetaPrefix + formatClock(next)
          : strings.offPeakMetaPrefix + formatDuration(next - now, lang)
      }
      return React.createElement(
        'span',
        {
          className: 'dshPeakBadge',
          style: { color: peak ? '#e5534b' : '#3fb950' },
          title: title,
          role: 'status',
        },
        React.createElement('span', { className: 'dshPeakBadgeDot' }),
        React.createElement('span', { className: 'dshPeakBadgeLabel' }, label),
        meta === '' ? null : React.createElement('span', { className: 'dshPeakBadgeMeta' }, '· ' + meta),
      )
    }

    var plugin = {
      name: 'dsh-peak-badge',
      inject: ['slots'],
      apply: function (ctx) {
        var style = document.createElement('style')
        style.dataset.plugin = 'dsh-peak-badge'
        style.textContent = CSS
        document.head.appendChild(style)
        var slots = ctx.get('slots')
        if (slots === undefined) return
        slots.inject('conversation.input.left', function () {
          return slots.register({ name: 'conversation.input.left', id: 'peak-badge' }, function (props) {
            return React.createElement(PeakBadge, props)
          })
        })
      },
    }

    exports.apply = plugin.apply
    exports.inject = plugin.inject
    exports.default = plugin
    exports.__internals = {
      inPeak: inPeak,
      nextTransition: nextTransition,
      pickLang: pickLang,
      formatDuration: formatDuration,
      formatClock: formatClock,
    }
    return module.exports
  },
})
