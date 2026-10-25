# Instructor pilot — Noise and Filtering main lab

Software checks do not establish the performance of a physical kit. Run this pilot
with the actual R4, LDR, instruments and component stock before the class.

Local software verification completed on 24 October 2026:

- All 234 application unit/contract tests passed, as did type checks, lint and the production build.
- The final main-lab build passed 218 synthetic browser checks across Chromium,
  Firefox and WebKit: all five pages, both group sizes, preserved/corrected
  predictions, 21 required evidence attachments, byte-preserving JSON/ZIP,
  fresh restoration, cancellation, failure recovery, keyboard navigation and reports.
- All 263 existing Noise pre-lab browser checks passed, along with the existing
  555 main-lab and site-navigation regression suites. The released pre-lab HTML
  remains SHA-256 `74151a50017b58bdeac6989cdc6a17821f0cd19a8a8b14810f3b494747079d69`.
- Arduino UNO R4 core 1.6.0 compiled both targets. Minima: 55,884 bytes flash and
  20,600 bytes global RAM. WiFi: 65,872 bytes flash and 23,036 bytes global RAM.
  Host C++ tests cover filter initialization/arithmetic, mean-removed RMS,
  timestamps, missed slots, clipping and capture memory bounds.
- Reports and circuit diagrams were visually reviewed at desktop and phone sizes.
  All recordings used in these checks are synthetic; they establish no hardware results.

The preview is local. No production push, Vercel deployment, deployed-header
acceptance or physical hardware test was performed for this change.

## Hardware and teaching pilot

- Confirm both R4 variants compile; record the board/core and sketch versions used.
- Verify the LED current with the 1 kΩ series resistor, LDR orientation, divider
  wiring, available equivalents for 10/40 kΩ and 1/2.2 µF, and capacitor polarity.
- Measure the actual ADC reference/supply and compare a known voltage with the
  exported 12-bit conversion. Check USB supply and meter uncertainty.
- Inspect actual sampling timestamps for steady, step, pulse and external modes.
  Record missed slots, maximum lateness/gap and clipping; repeat if timing is poor.
- Check that the 1.5 s settling plus 500-sample warm-up produces a steady baseline.
  Allow extra manual settling when the LDR or ambient conditions require it.
- Verify the 250 ms optical pulse is visible in the raw LDR response. Adjust pulse
  duration if needed, then announce and record the same value across comparisons.
- Check noise is measurable under fixed illumination. Record a resolution limit
  when variation is too small; do not promise that filtering must improve every run.
- Verify common grounds, high-impedance scope inputs, source-load settings and the
  actual generator input range of 1–3 V before connecting A0. Disconnect the sensor
  source and D9 before generator-driven tests.
- Check the isolated RC response using 1 Hz square-wave input. Distinguish input
  edge timing from sensor response and account for source/probe loading.
- Capture all three 5 Hz sine runs. Confirm complete CSV metadata, samples, end
  markers and scope screenshots survive attachment, ZIP export and fresh restore.
- Confirm the bypass sine record supplies RAW, both MAs and both EMAs. Assess
  waveform distortion, interference and acquisition timing before choosing the
  later post-lab SNR estimator. Do not mistake useful sine RMS for noise RMS.
- Rehearse manual Serial Monitor copying, a logging-terminal fallback, plot replay
  and timing extraction from CSV. Serial reconnection may clear a board's RAM.
- Time all three experiments, including file handling. Three hours is a planning
  allowance, not verified student pacing. Prioritize required SNR capture before
  allowing the optional cascade experiment.
- Announce optional numerical limits only after this pilot. Record the metric,
  units, operating conditions and pulse width; blank limits mean comparison only.
- Supply the submission destination/deadline separately. No post-lab importer or
  grading service is implemented by this worksheet.

## Portable record contract

`activityId` is `2145427-w12-noise-filtering-main-lab`; `schemaVersion` is 1.
The record holds a UUID, client timestamps, page 0–4, named string fields,
three nullable preserved bench predictions, and an attachment-slot inventory.
Predictions remain separate from editable current versions; records are evidence,
not proof of authorship or correctness. Group IDs/names are user claims.

Backups use `format: noise-filtering-main-lab-backup`, `backupVersion: 1`, `record`,
and `attachments`. Each attachment has slot, canonical filename, original filename,
MIME type and base64 original bytes. The ZIP stores `main_lab_backup.json`, the
same original images under `screenshots/`, and CSVs under `data/`. Imports verify
the duplicate byte copies, bounds and CRCs; unsupported activities are rejected.

Limits: 4,000 characters per answer, 10 MiB per image, 5 MiB per CSV, 32 MiB total
attachment bytes, 64 MiB backup JSON and 96 MiB ZIP. CSVs must be UTF-8 delimited
text; attachment validation does not certify measurement validity/completeness.
Images are signature-checked and decoded. Imports preview before replacement.

Answers use `electronics-noise-filtering-main-lab-v1`; attachments use the separate
IndexedDB `electronics-noise-filtering-main-lab-files-v1`. The pre-lab and 555 keys,
files and importers are never accessed by the new workbook. Future individual
post-lab work should preserve the original pre-lab and main-lab backups and link
them to separate individual calculations. No future schema or API is implied.
