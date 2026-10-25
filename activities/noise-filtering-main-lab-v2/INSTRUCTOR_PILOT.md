# Instructor pilot — Aircraft signal investigation v2

This file is private development/instructor material and is never packaged as a
student download. Software tests do not establish physical classroom readiness.
The released pre-lab and independent interactive learning are unchanged.

## Confirmed software checks (25 October 2026)

- All 262 unit/contract tests pass, including legacy LDR record/file coverage,
  shared waveform arithmetic, independent MA/EMA examples, queue backpressure,
  clipping, clock wrapping and timing diagnostics. Lint, types and build pass.
- Arduino UNO R4 core 1.6.0: starter fails with exactly the intended compilation
  error on Minima and WiFi. Repaired and completed digital versions compile.
- Repaired Minima: 61,104 bytes flash / 7,060 bytes global RAM; WiFi: 64,624 /
  9,496 bytes. Digital Minima: 61,384 / 7,100; WiFi: 64,880 / 9,536 bytes.
- All 118 aircraft browser checks pass across Chromium, Firefox and WebKit,
  including isolated regular WebKit profiles for normal attachment persistence.
  Private-mode storage rejection was reproduced; backup guidance remains usable.
  Legacy LDR (107), learning (127), pre-lab (263), navigation/simulator and 555
  browser regressions pass. Artifacts: output/playwright/noise-main-lab/.
  All browser fixtures are synthetic, not real circuit measurements.
- The direct host test of the completed firmware uses Arduino API stubs to verify
  continuous filter state during serial stalls, queued output and partial writes.
  It does not validate electrical behavior or real interrupt timing.
- No physical board, oscilloscope, live serial throughput, three-hour pacing or
  deployed Vercel headers have been verified by these software checks.

Three-member follow-up: 46 Chromium checks pass, including one required name
with blank IDs, all three members in reports and import previews, JSON/ZIP
restoration, and compatibility with earlier two-member v2 records.

## Compilation exercise and private recovery

The sole planted fault is the call `startSignalGenrator()` in setup; the defined
function is `startSignalGenerator()`. Repair only that call for the source stage.
The public working filter examples are a separate later integration task; the
initial pass-through processSample and DIGITAL_FILTERS=false are intentional.
Reference voltage entry and selection of the correct board are setup, not faults.

Run `npm run test:noise-main-lab:arduino`. ARDUINO_CLI and the Arduino CLI data/
download directories can be overridden through environment variables. Private
self-contained fixtures and compile logs are generated under
output/noise-aircraft-arduino/{starter,repaired,digital}/. Only the starter and
standalone filter examples are public. Do not upload recovery fixtures to public/.
If a group spends over 15 minutes on compilation, review the error explanation
with them and supply the recovery sketch privately so they reach the FFT task.
The worksheet records a short AI-help summary, not a mandatory chat transcript.

## Pre-class physical pilot — release gate

- Supply an R4 Minima or WiFi, working USB cable, Arduino IDE/core, breadboard,
  oscilloscope/probes, meter, USB storage, approximately 47 kohm resistors and
  non-polar 22/33/47/68/100 nF capacitors. Inventory actual stock/tolerances.
- Confirm A0 is DAC output and A1 ADC return on BOTH variants. No generator or
  other active output may compete with A0. Common ground; high-impedance scope
  inputs; match probe attenuation. Review the actual measured supply/reference.
- Baseline A0 -> A1: verify useful peaks 50/55/70 and interference 120/150/180 Hz,
  the 2 V offset, component amplitudes, voltage range and source repeatability.
  Ideal bound is 1.1..2.9 V; real output must be measured. Check clipping/distortion.
- Verify the DAC source is not overloaded. The RA4M1 DAC specifies at least
  30 kohm resistive load and limited direct capacitive load. Use at least 33 kohm
  SERIES R (stock approximately 47 kohm) before a large shunt capacitor; never
  attach the 22..100 nF capacitor directly to A0. Record probe/breadboard loading.
  Datasheet: https://www.renesas.com/en/document/dst/ra4m1-group-datasheet
- The shown low-pass is A0 -> R -> A1, with C from A1 to GND. For a different
  topology inspect DAC loading, bias, transient voltages and ADC limits BEFORE
  powering. A ground-referenced high-pass can create negative ADC voltages.
  The type is a student reasoning task, not permission to energize an unsafe build.
- Private reference comparison: R=47 kohm, C=33 nF, nominal cutoff approximately
  102.6 Hz. It retains about 82.6% of 70 Hz and 65.0% of 120 Hz in the ideal
  unloaded model. Expect partial rejection, not removal of all unwanted tones.
  Compare input/output spectra and actual components; repeat after a design edit.
- Verify TWO independent timers maintain the 4 kHz source and 1 kHz return rate.
  Inspect the actual DAC spectrum and sample diagnostics during live printing,
  paused printing, disconnection/reconnection and deliberate serial backpressure.
  Check max sample-processing time and timing gaps. Diagnostics estimate missed
  slots from gaps; they are not a physical measurement of the analogue output.
- On both variants sustain three labeled traces at 500,000 baud in the actual
  classroom Arduino IDE. Verify availableForWrite behavior, no unreported line
  loss, usable display length and zero steady-run output overruns. resetstats
  pauses/clears diagnostics; plot resumes. status pauses plot text and prints
  diagnostics while generation/acquisition/filter state continue. Reconnection
  may reset the board. Repeat measurements after any reset.
- Verify digital initialization, settling and separate inputs: MA and EMA each
  consume the same measured A1 voltage. They do not consume one another. Compare
  supplied MA5/EMA0.40 with student-selected settings; confirm useful loss and
  delay are observable. The plot's horizontal axis is not calibrated time.
- On the actual GDS-1202B establish an FFT setup that resolves all SIX tones,
  especially 50/55 Hz, with readable scales. Check acquisition duration, actual
  sample rate, window and FFT point limits; 10M record mode disables FFT in the
  manual. Family documentation says FFT frequency scale depends on timebase;
  do not assume either a fixed 10 kHz/div minimum or a proven 0..250 Hz view.
  Keep the exact working button sequence in PRIVATE recovery notes. Student
  materials supply the manual but no FFT button/menu instructions.
- Verify settled four-second time-domain Detail CSVs and readable FFT images can
  be saved/transferred manually. Retain time, voltage, source, acquisition settings,
  sample count and duration. The sample count actually used by an FFT determines
  bin spacing; zoom alone adds no resolution and windows broaden peaks.
- If the scope cannot distinguish 50/55 or live plotting is unreliable, resolve
  the bench setup before release. Do not silently change frequencies or switch
  students to a replay workflow. Instructor-assisted CSV/PC analysis can diagnose
  the limitation, but does not establish that the planned scope task is validated.
- Rehearse uploads, code preservation, group JSON/ZIP restore and printing on a
  second computer. Each member keeps group ZIP plus their own pre-lab ZIP.
- Time 20/35/65/40/10 minutes plus 10 recovery. Give groups a recovery path when
  debugging/FFT discovery stalls; aim to preserve time for analogue/digital work.
- Announce any numerical targets only after this pilot. Default assessment is
  reasoning, evidence and tradeoffs; no automatic correctness grade or pass gate.
- Publish submission destination and deadline separately. This change adds no
  post-lab importer, web Arduino uploader, AI endpoint or production deployment.

Groups support up to three students. Group ID and Student 1 name are required;
Student 2/3 names and all student IDs are optional. Older two-member v2 records
restore with blank third-member fields; record and attachment IDs are retained.

## Portable record / compatibility

Activity stays 2145427-w12-noise-filtering-main-lab with schemaVersion 2.
Browser key: electronics-noise-filtering-main-lab-v2.
Attachment database: electronics-noise-filtering-main-lab-files-v2.
Backup format: noise-filtering-main-lab-backup; backupVersion 2.
Current and preserved generator/digital code are UTF-8 literal text, max 128 KiB
per code field; ordinary fields max 4,000 characters. Original RC design is
separate from current corrections. No stored version is an automatic verification.

ZIP: main_lab_backup.json, code/, screenshots/, data/. Current and preserved
self-contained .ino files have separate Arduino-compatible folders; attachment
bytes in the ZIP must match their embedded backup bytes. JSON 64 MiB / ZIP 96 MiB;
images 10 MiB each, CSVs 5 MiB each, aggregate attachments 32 MiB. No CSV analysis.
Legacy v1 source/downloads and worksheet remain available separately, with their
original storage and backup contracts. New imports reject old LDR records with
legacy guidance, and never migrate/reinterpret them as aircraft measurements.

Baseline/RC scope CSVs support later SNR analysis. Keep useful tones, interference,
DC, distortion and unexplained components distinguishable. Total RMS is not
noise-only RMS. Digital output screenshots do not support numerical digital SNR;
future recomputation from recorded samples must be labeled as recomputation.
