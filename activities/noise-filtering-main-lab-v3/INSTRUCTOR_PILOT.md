# Instructor pilot — Aircraft pulse investigation v3

Private development/instructor material; never packaged as a student resource.
Software checks do not establish physical classroom readiness. The released
pre-lab and independent interactive learning are unchanged.

## Local software verification — 25 October 2026

- All 275 unit/contract checks pass, including v1/v2 file compatibility and v3 pulse,
  file, filter, timing and serial-stall checks. Lint, types and build pass.
- UNO R4 core 1.6.0: starter has exactly the intended compilation error on both
  variants; repaired and completed filter versions compile on both. Completed
  globals: Minima 13,508 bytes; WiFi 15,944 bytes, leaving over 16 KiB RAM.
- Pulse browser journeys pass in Chromium, Firefox and WebKit. Chromium also
  checks warnings while attachment saves are pending. Clean/noisy recordings,
  literal code, frozen originals, ZIP bytes, reload/fresh restore, printing,
  phone layouts, invalid imports and failed storage are covered.
- The focused v2 browser check restores an original sine ZIP and CSV without
  changing its answers or namespace, then confirms v3 rejects reinterpretation.
- Pre-lab browser checks (263), independent learning (127) and app navigation
  pass. Released student pre-lab hashes are unchanged.
- These are synthetic/software results. Physical electrical behavior, actual
  oscilloscope FFT, sustained board plotting and classroom pacing remain untested.

## Source and intended learning

The cycle repeats every second, using 4,000 DAC table entries: baseline 2.0 V;
long pulse at 2.6 V from 120 to 320 ms (200 ms); short pulse at 2.5 V from 620
to 640 ms (20 ms). Both pulses are useful. Noisy mode adds 120, 150 and 180 Hz
at 0.10 V peak each. The conservative noisy bound is 1.7..2.9 V. Mean voltage
is 2.13 V, not 2.0 V, because the pulses have positive area.

`source clean` / `source noisy` select precomputed source values without resetting cycle
phase, timing or digital state. Both commands pause plotting and clear pending
plot lines. Wait at least two complete cycles before recording; `plot` resumes.
Default/reset is noisy. Capture labels must state the mode; Serial Monitor
`status` reports it. The noisy table and three clean codes occupy 8,006 bytes; check compiled RAM use
and remaining stack headroom on both board variants, especially longer MA windows.

Pulse harmonics can share the injected interference bins. Magnitude subtraction
between clean and noisy FFTs does not give noise-only amplitude. Student tables
call these total-bin measurements. Paired clean/noisy numerical analysis later
needs time/phase alignment and an explicit residual/distortion model.

## Compilation exercise and private recovery

There is exactly one planted fault: `startSignalGenrator()` in setup should call
`startSignalGenerator()`. Pass-through processSample / DIGITAL_FILTERS=false are
intentional scaffolding, not extra faults. Reference entry and correct board
selection are normal setup. If repair stalls beyond 15 minutes, review the cause
and privately supply the repaired reference so students reach measurements.

Run `npm run test:noise-main-lab:arduino`. The starter must fail with only that
error; repaired and completed digital versions must compile on both Minima and
WiFi. Fixtures/logs are private under output/noise-aircraft-arduino/. Keep them
out of public/. Students receive only the starter ZIP, guide and MA/EMA examples.

Host numerical checks cover pulse boundaries, durations, repeatability, voltage
bounds/mean, interference frequencies/amplitudes from matched sample differences,
DAC/ADC conversion, clipping, timing and wrap, filter initialization, long-window
short-pulse loss, queue stalls and partial serial writes. Runtime stubs also check
source switching and uninterrupted cycle state; they cannot validate hardware.

## Physical pilot — required before classroom readiness

- Prepare Arduino IDE, UNO R4 core, both board variants, cables, scope/probes,
  meter, breadboard, storage media, approximately 47 kohm resistors and non-polar
  22/33/47/68/100 nF capacitors. Inventory actual values and tolerances.
- Verify A0 DAC output, A1 ADC return and common GND on both variants. Never
  connect an active external source to A0. Use high-impedance scope inputs and
  matching probe attenuation. Measure the voltage reference and inspect clipping.
- With A0 directly to A1, verify the one-second cycle, 200 ms / 20 ms pulse
  widths and 2.0 / 2.6 / 2.5 V clean levels. Inspect real edge shape, DAC loading,
  startup, source continuity, clean/noisy switching and reset-to-noisy behavior.
- Verify the added 120/150/180 Hz components against the clean reference. Some
  pulse harmonics overlap; establish which features the actual FFT can resolve
  and quantify. Check actual FFT sample count, duration, window and display span
  on the GDS-1202B. Four-second records are a target, not a verified capability
  for every FFT mode; 10M record mode disables FFT per the family manual. Keep
  button/menu recovery instructions private: students discover the procedure.
- Confirm clean/noisy FFT screenshots and Detail CSVs can be saved/transferred
  with time/voltage metadata. Test clean/noisy source captures and clean/noisy
  RC output CSVs. Use matching acquisition/probe settings and consistent units.
- Review physical RC loading before power. The RA4M1 DAC specifies at least
  30 kohm resistive loading and limited direct capacitance. Keep at least 33 kohm
  SERIES resistance (47 kohm stock) between A0 and large shunt capacitors; never
  place the 22..100 nF capacitor directly on A0. Record scope/breadboard loading.
  Source: https://www.renesas.com/en/document/dst/ra4m1-group-datasheet
- Low-pass reference: A0 -> R -> A1, C from A1 to GND. Check both scope grounds
  at common GND, CH1 before R and CH2 after. Another topology needs review for
  DAC loading, input bias, negative transients and ADC limits before energizing.
- With actual R/C, compare steady ripple, long/short pulse heights, defined
  width thresholds and CH1-to-CH2 event delay. A single RC is gradual and cannot
  keep ideal edges while completely rejecting all interference. Ensure the
  short pulse remains usable across the available stock; adjust teaching limits
  after measurements. A settled baseline window such as 800..950 ms must exclude
  recovery, especially for unusually large student-selected time constants.
- Verify separate hardware timers actually maintain 4 kHz DAC and 1 kHz ADC
  rates under continuous serial output, paused output, source switching and
  disconnection/reconnection. Inspect counters, processing duration and source
  on scope. Missed-slot estimates do not certify electrical timing.
- Sustain three labeled live traces at 500,000 baud in the classroom IDE on both
  variants. Verify zero steady-run output overruns, availableForWrite and partial
  write behavior, usable display history and clear status/plot transitions.
  The plot horizontal axis is sample order, not calibrated physical time.
- Verify independent filter inputs/history and first-input initialization.
  Compare MA5 with MA51, EMA0.40 with EMA0.02, then reasonable student choices.
  Make sure strong smoothing visibly reduces/delays the 20 ms useful event.
  Define acceptable ripple, event-height retention and delay only after a pilot;
  no numerical pass/fail target or grading gate is imposed by the workbook.
- Allow users to record unavailable results/limits. Do not claim a live screenshot
  establishes numerical digital-output SNR. Later filtering of scope recordings
  is recomputation and must be described accordingly.
- Rehearse the eight required uploads, saving code/design copies, literal code,
  ZIP/JSON restore on another computer, storage failure recovery and printing.
  Time the clean/noisy source changes, eight required files and six parameter
  trial rows within 20/35/65/40/10 minutes plus ten recovery minutes. Reduce
  logistics or provide a recovery route if this exceeds three hours.
- Every member keeps group ZIP plus their own pre-lab ZIP. Supply submission
  destination/deadline separately. No production deployment or individual
  post-lab implementation is part of this change.

## Saved work and delivery

Activity: 2145427-w12-noise-filtering-main-lab; schemaVersion / backupVersion 3.
Browser key: electronics-noise-filtering-main-lab-v3.
Attachment database: electronics-noise-filtering-main-lab-files-v3.
ZIP remains main_lab_backup.json, code/, screenshots/, data/, with original bytes.
Code fields accept 128 KiB UTF-8; other fields 4,000 characters. Incomplete exports
remain available. Import validates and previews before explicit replacement.
Group ID and Student 1 name required; Student 2/3 names and all IDs optional.

Older sine v2 sources/worksheet/downloads remain independently restorable at
/worksheets/noise-filtering-main-lab-v2.html. LDR v1 remains at its existing
legacy URL. The pulse worksheet rejects either prior schema with a recovery
link in the message. It never migrates old measurements into pulse answers.
The released pre-lab, learning and 555 storage are separate.

Run contracts, full unit suite, numerical/runtime checks, both-board compiler
checks, browser journey, lint, types and build. Results are logged in output/ and
/private/tmp/noise-pulse-* during local verification. Browser test measurements and files are synthetic.
Deliver through the local preview; passing software tests leaves this physical
pilot outstanding. No hardware observations have been fabricated.
