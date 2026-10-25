# Private instructor pilot — seven-section pulse investigation v4

Never package this file or instructor/ as student resources. Software checks do
not establish physical readiness. Deliver locally; keep deployed pre-lab unchanged.

## CSV processing revision — 26 October 2026

- Full suite: 302 tests pass. Final focused main/post-lab checks: 25 pass.
- Main-lab synthetic journeys: 179 checks pass across Chromium, Firefox and WebKit,
  including image-only attachment, literal formulas/code, JSON/ZIP restoration,
  mobile layout, printing and storage failure recovery.
- Post-lab Chromium journey: 60 checks pass, including revised group import,
  literal processing code, large original-backup restore, mobile and print views.
- Lint, type checks and production build pass. The existing bundle-size advisory
  remains. Nothing was deployed. Classroom scope CSV export still needs the
  physical pilot below; synthetic tests do not validate hardware measurements.

## Historical software verification — 25 October 2026

These checks describe the earlier Arduino filtering workflow. Re-run acceptance
checks below for the CSV processing and final-figure revision.

- 292 application/unit/contract checks pass, including waveform levels/timing,
  source-only behavior, independent MA/EMA initialization and arithmetic,
  deadline estimates, clipping, bounded queue stalls and partial serial writes.
- Source and private completed solution compile for both UNO R4 variants with
  Renesas UNO core 1.6.0. Source globals: 12,024 bytes Minima / 14,824 WiFi.
  Completed solution globals: 13,508 bytes Minima / 15,944 WiFi.
- Seven-section browser journeys: 168 checks across Chromium, Firefox and WebKit.
  Large literal code, saved copies, six required images, original image bytes,
  ZIP/JSON restore, cancellation, invalid files, storage failures, phone layout,
  keyboard access and report mathematics passed using synthetic inputs.
- Archived v3 journey: 53 Chromium checks pass. Pre-lab journey: 115 checks pass;
  independent learning: 127 checks pass. Existing 555 workbook and application
  navigation checks also pass. The 32 recorded pre-lab/learning/instructor-kit
  file hashes are unchanged.
- Lint, type checks and production build pass. Build retains the existing bundle
  size advisory. The local preview is on port 4184; nothing was deployed.
- Hardware observations remain pending. These results use software stubs and
  synthetic browser inputs and do not establish electrical classroom readiness.

## Instructor solution and recovery

Run npm run test:noise-main-lab:arduino. Both source and digital sketches must
compile for UNO R4 Minima and WiFi. Private completed code and compiler logs are
written to output/noise-aircraft-arduino/digital/ and sibling files. The source
ZIP contains only the working A0 generator. There is no planted fault or public
A1/MA/EMA scaffold. Check board support, port and REFERENCE_V first if upload or
voltage checks fail. A0 stays near baseline if its timer cannot start.

The private Arduino filter solution is retained only for historical/reference
checks. The current Section 6 uses recorded scope data in Excel, MATLAB, Python
or another program. Do not supply the private sketch as the current student task.
Students record their own formulas or code and prepare separate labelled MA and EMA comparison figures.

## Physical pilot required

- Install board support and IDE before class. Test both R4 variants. Measure the
  supply/reference and enter it in each sketch. Inspect A0 with CH1 tip, UNO GND
  with the probe ground, DC coupling, compensated 10x probes and high impedance.
- Confirm the one-second repeating waveform: 2.0 V baseline, 2.6 V at 120–320 ms,
  2.5 V at 620–640 ms, and added 120/150/180 Hz sine components at 0.10 V peak.
  Actual noisy voltage remains within the designed 1.7–2.9 V bound. Check timing,
  edge shape, clipping, startup and sustained 4,000 updates/s. No serial output
  is expected from the first sketch. Do not silently change the waveform.
- On the actual GDS-1202B, confirm readable FFT peaks at 120/150/180 Hz using an
  appropriate duration, window and span. Check Linear RMS versus dBV RMS readings
  and peak measurement repeatability. Pulse harmonics may overlap these bins.
  Section 2 requires the oscilloscope FFT screenshot and frequency table, with no
  written FFT questionnaire or image-detail fields. Record the working controls
  privately as a recovery route; the student page
  deliberately gives no button sequence. Full manual:
  https://www.gwinstek.com/en-global/products/downloadSeriesDownNew/1676/130
- Check screenshots/photos can be transferred in PNG/JPEG/BMP/WebP. A single
  time-domain screen must show CH1 input and CH2 output together. Section 5 needs
  one image containing both CH1 and CH2 FFT results with matching settings;
  separate captures can be combined into one labelled image. After Section 5, verify CH2 Detail CSV
  export in normal sampling at 500 ms/div and a 10,000-point record. Confirm about
  five seconds, actual sample spacing, correct time/voltage units, no clipping,
  and enough samples to resolve the 20 ms pulse. Transfer the file to a computer.
  CSV remains local; no CSV attachment or submission is required.
- Review loading before powering: approximately 47 kohm stock and non-polar
  22–100 nF. Keep at least 33 kohm SERIES resistance in the shown unbuffered
  low-pass arrangement, not a large capacitor directly on A0. The RA4M1 DAC
  specifies minimum resistive loading and limited direct capacitance:
  https://www.renesas.com/en/document/dst/ra4m1-group-datasheet
  Account for scope, ADC and breadboard loading. Other topology/lower resistance
  requires review of source loading, bias, negative transients and ADC range.
- Low-pass wiring: A0 → R → output; C from output to GND. CH1 before R, CH2 after,
  probe grounds common. Leave A1 disconnected for the current workflow. Never tie another
  active source to A0. Check source changes under load and real filter attenuation.
- Check useful pulse height, width, edge shape, delay and remaining ripple across
  available parts. Attenuation is gradual; smoothing may hide a short event.
  No numerical grading gate is imposed. Compare predicted/measured attenuation
  at the three identified frequencies with matching RMS conventions. Do not call
  it noise-only RMS/SNR, especially with overlapping pulse harmonics.
- Rehearse CSV import in Excel, MATLAB and Python, including scope metadata above
  numeric data. Compute sample rate from recorded time values and check duration
  and uniform spacing. A 500 ms/div display is not a sample-rate specification.
- Verify independent trailing MA and EMA from identical original RC values,
  first-input initialization/padded MA history and documented settling. Compare
  MA 5/51, EMA 0.40/0.02 and chosen settings using the actual sample interval.
- Check two comparison figures: MA windows 5, 51 and chosen, and EMA coefficients
  0.4, 0.02 and chosen. Each includes the RC reference from the same recording,
  descriptive title, Time (s), Voltage (V), and a legend identifying every setting.
  Verify legibility, common scales and visible delay. No digital trial table or
  figure-metadata fields are required; settings belong in legends/captions.
- Rehearse 15/25/25/30/25/45/5 minutes plus ten recovery minutes. Include six
  required images (including combined FFT, MA trials and EMA trials), saved initial
  source, group ZIP, restore on another computer, plain-language observations
  and actual equipment constraints.
- Ensure each member takes the group ZIP and own pre-lab ZIP to the future
  individual post-lab. Supply the submission destination and deadline separately.

## Software acceptance and compatibility

Version/schema 4 has separate browser and attachment namespaces. ZIP contains
backup JSON, code/ and screenshots/; original image bytes are retained. V3 remains
at its own recovery URL with its prior storage and file format. V2/v1 also remain.
Earlier v4 answers and saved Arduino sketches remain available separately; new
CSV-processing answers initialize blank when an older v4 record is restored. Pre-lab and 555 records stay separate.

Run full unit tests, source/filter/timing host checks, both-board compiler checks,
seven-section CSV/figure browser journeys, older v4 restore, v3 recovery, responsive/keyboard/report checks,
lint, types and build. Test cancelled/invalid imports, images, incomplete exports,
large literal code, storage failures, reload and fresh-browser restoration.
Software results must be reported separately from this outstanding hardware pilot.
