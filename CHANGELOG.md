# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-23

### Added

- Peak/off-peak badge in the composer row (`conversation.input.left`) next to
  the model selector.
- Countdown to the next pricing transition and local end time for the current
  peak window.
- English and Russian UI, selected from the DeepSeek Harness UI language.
- UTC schedule math for DeepSeek peak hours: Monday-Friday 01:00-04:00 and
  06:00-10:00 UTC, off-peak everywhere else and all weekend.
- Unit tests covering the schedule windows, boundary instants, transition
  search, duration formatting and language selection.

[0.1.0]: https://github.com/ibuildrun/dsh-peak-badge/releases/tag/v0.1.0
