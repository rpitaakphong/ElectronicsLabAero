> Shared workbench update: this directory now also maintains the Voltage Divider Lab Simulator. `profiles.js` selects components, lead types and storage. `engine.js` provides shared union-find and matrix solving; `dc-engine.js` adds an ideal DC operating-point model. `divider.html` and `divider.js` provide the DC supply, multimeter, four divider references and isolated saves. The existing op-amp profile retains its instruments, transient model, storage keys and pinout migration. Root packaging publishes each lab and its offline download from these sources. See the root README for divider usage and tests.

> This is the maintained simulator source for Electronics Lab. The temporary clone is not used by the webapp. Run `npm run package:simulator` at the repository root after changes. This packages both the standalone runtime and the offline download. Browser regressions accept `SIMULATOR_URL` for testing the packaged location; the default remains the original local port.

# Op-Amp Lab Simulator

A static browser-based teaching simulator for first-year electronics labs. It combines:

- a virtual solderless breadboard,
- resistors and capacitors,
- an UA741-style DIP-8 op-amp,
- ± supply rails,
- sine/square/triangle function generator,
- two oscilloscope probes with grounded/common ground behavior,
- an oscilloscope panel modeled after the **GW Instek GDS-1202B**.

No server or package manager is required. Open `index.html` in a modern browser.

## Why this exists

The student should not receive a perfectly scaled graph the instant the circuit is connected. The workflow is deliberately closer to a lab:

1. Wire the breadboard.
2. Power pins 7 and 4 of the UA741.
3. Connect generator input and return path.
4. Connect CH1 / CH2 tips and ground clips.
5. Turn on the required channel(s).
6. Set V/div and TIME/div.
7. Set trigger source, slope, level, and mode.
8. Interpret the waveform and measurements.

`Challenge mode` deliberately gives the oscilloscope poor settings so the student has to recover the trace. Autoset still works, but challenge scoring notices it.

## UA741 model used

Top-view DIP-8 pin model:

| Pin | Function |
|---|---|
| 1 | NC on TI UA741CP PDIP, Rev. H (not modeled) |
| 2 | Inverting input |
| 3 | Non-inverting input |
| 4 | V− supply |
| 5 | NC on TI UA741CP PDIP, Rev. H (not modeled) |
| 6 | Output |
| 7 | V+ supply |
| 8 | NC |

Default teaching model:

- open-loop gain: 200,000
- output saturation: a fixed 2 V inside each supply rail (teaching approximation, not a load-dependent guarantee)
- gain-bandwidth product: 1 MHz, single dominant pole
- slew-rate limit: 0.5 V/µs
- input current and offset-current effects: neglected

Open-loop gain and slew rate can be edited by selecting the op-amp on the breadboard.

Reference: [TI UA741 datasheet, Rev. H](https://www.ti.com/lit/ds/symlink/ua741.pdf). This models the UA741CP PDIP active pinout. Rev. H identifies pins 1 and 5 as NC for D/P packages; older 741 parts and the PS package may expose offset-null pins. Check the actual part before wiring hardware. The model does not implement input bias/offset, current limiting, temperature effects, or load-dependent output swing; it is not TI’s transistor-level SPICE model.

## Circuit solver

The simulator uses a small modified-nodal-analysis (MNA) solver in JavaScript:

- resistors are stamped as conductances,
- capacitors use backward-Euler companion models,
- supply rails are ideal voltage sources; the SFG MAIN output has 50 Ω series resistance,
- the op-amp is a high-gain voltage-controlled voltage source with supply saturation and a simple slew-rate limit,
- jumper wires merge breadboard nets,
- probe ground clips are tied to instrument ground.

This is intentionally an educational circuit solver, not a replacement for SPICE.

## Included presets

- voltage follower
- inverting amplifier, gain −4.7
- non-inverting amplifier, gain 5.7
- RC low-pass followed by a buffer
- practical op-amp integrator

The simulator always starts on an empty blank board, ignoring saved preset overrides at startup. Built-in and custom presets, plus Manage presets, require **Unlock presets → instructor password `aero1234`**. Unlocking only enables the controls; it does not load a circuit. Access lasts for the current page visit and resets on reload or re-entry. Incorrect passwords leave the circuit, history, and saved data unchanged.

This is a client-side classroom deterrent, not secure authentication: the password and preset code can be inspected in browser source. Save/Recall for students’ own labs and the reference schematic/pin guide remain available while presets are locked. Saved originals remain untouched. Once unlocked, saved overrides (including Blank board) load as before; Reset lab always clears to the original blank board.

`node tests/preset-access.cjs` checks locked startup, ignored saved overrides, incorrect/correct passwords, keyboard/phone controls, unchanged storage/history, manual Save/Recall, and re-locking in standalone, embedded, and offline versions. Existing behavioral scripts explicitly unlock and load their starting fixture through the UI.

### Organized physical layouts

The 30 hole columns use a 30-pixel pitch centered within the unchanged board, leaving 130-pixel side margins. Larger, higher-contrast lead labels sit in these margins; row letters sit above their hole lines so incoming cables remain readable. Hole addresses and saved circuits are unchanged by this display spacing.

`presets.js` defines exact terminal and instrument holes for all five built-in circuits. The UA741 stays at column 14. Input parts use the left side, output strips use column 22, and feedback parts occupy separate lower rows. The integrator puts its 100 nF capacitor on row H and its 100 kΩ resistor on row J; neither crosses the chip. Intermediate strips and short jumpers preserve the original electrical networks, values, supplies, generator settings, and scope settings.

The built-in layouts have no crossed component leads or overlapping component bodies. Jumper and instrument wires may cross with bridge marks, while routing around components. Their geometry is checked for at least 8 canvas pixels of clearance between unrelated component bodies, value labels, and leads. Power rails appear as broad, softly shaded red and blue bands behind their holes, visually distinct from solid jumper wires. Printed breadboard rails and internally connected strips are part of the board, not additional jumper wires.

These changes update built-in originals only. Saved labs, custom presets, and saved overrides retain their stored positions. To use a new built-in layout in place of a customized override, choose **Manage presets → Restore original**; export or save a separate copy first if you want to keep that override. The save format remains `pinoutVersion: 2`, with no stored route or dock geometry.

`node tests/preset-layouts.cjs` checks exact placements, independent geometry/clearance calculations, unique hole occupancy, electrical equivalence after merging jumper-connected strips, and signed waveform samples against the original fixtures. It also verifies route caching. Run this alongside all nine existing regression scripts. `tests/layout.cjs` captures every built-in circuit at desktop, tablet, and phone widths and verifies editing and the offline portable version.

## GDS-1202B functions represented

The simulator includes the front-panel workflow and the major menu categories documented for the GDS-1000B series / GDS-1202B:

- CH1 / CH2 setup
- vertical position and V/div
- horizontal position and TIME/div
- edge trigger source, slope, mode, level, coupling
- Auto / Normal trigger behavior
- Run/Stop, Single, Force Trigger, 50%
- Autoset
- acquisition modes: Sample, Peak Detect, Average
- Display settings
- automatic measurements
- cursors
- Arithmetic math and saved reference waveforms
- Save/Recall using browser local storage
- Hardcopy to PNG
- Help / Utility; unsupported APP / BUS controls are disabled

Hardware-specific behavior such as Ethernet/USB remote control, actual firmware file management, PictBridge printing, Go/NoGo rear-panel I/O, calibration circuitry, and serial-bus decode engines is not electrically emulated.

## Manufacturer reference used for control layout

GW Instek, **GDS-1000B Series User Manual**, which specifically lists the GDS-1202B as the 2-channel, 200 MHz, 1 GSa/s model and documents the front-panel keys and menu organization.

Manufacturer download page:
https://www.gwinstek.com/en-global/download/index/2?cate=0&down=0&key=gds-&ser=0&subcate=0

## Recommended deployment

Because this app is static, it can be hosted cheaply on:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Render static site
- any LMS that accepts a static web package

For a class, GitHub Pages is probably the least dramatic solution: one repository, one URL, no student install, works from iPad/Android/desktop browsers.

## Files

- `index.html` — UI structure
- `styles.css` — responsive oscilloscope / breadboard layout
- `app.js` — circuit solver, breadboard interaction, scope controls and rendering


## Moving and reconnecting parts

- **Select / Move:** drag the body of a resistor, capacitor, wire or UA741. ICs slide along the center gap; existing wires remain in their original holes.
- Select a two-terminal part to reveal **A / B handles**. Drag a handle to reconnect just that terminal, or use **Reconnect A/B** and click the target hole.
- The **Parts and leads** list selects obscured parts. The editor offers exact row/column fields, left/right nudging, values, colors and deletion.
- Drag generator/probe endpoints to new holes. Physical holes and electrical nets are stored separately, so moving from A4 to D4 preserves the electrical connection.
- **Undo / Redo** records circuit edits, including placement, deletion, presets, values and lead moves (up to 100 edits). It does not undo oscilloscope settings. **Esc** cancels unfinished placement or dragging. With the board focused, arrow keys nudge parts and Delete removes the selection.
- **Fit board**, zoom and **Pan view** work without moving the circuit. Browser page zoom is enabled.
- **Save lab / Recall lab** retains exact holes and scope settings in this browser. Original saves without hole coordinates are assigned representative holes when loaded.

## Measure and cursors

Press **Measure → Add Measurement**, choose a category and source, then an item. The accessible panel below the instrument offers the same controls directly. Each of eight slots retains its own source; adding CH2 does not change existing CH1 measurements. Remove individual items or all items. Long side menus have a **Next page** key.

The simulator implements 32 measurement types: 12 voltage/area measurements, 11 timing/count measurements, and 9 delay/phase measurements. Four hardware overshoot/preshoot measurements are not implemented. Full-record, screen and between-cursor gates are available. Invalid measurements explain missing connections, disabled channels, insufficient samples/cycles or undersampling. Rise/fall thresholds and high/low estimation are configurable. Statistics accumulate on simulated acquisitions, not UI redraws.

**CH1 cursors are yellow; CH2 cursors are blue**, including lines, channel labels and delta readouts. Set positions directly or use the Cursor soft keys and VARIABLE knob. Voltage-cursor increments follow the selected channel scale; time cursors follow horizontal position.

Run/Stop freezes the acquisition while retaining scale/position control. Single remains armed until a trigger; Force captures an armed/running acquisition. Autoset adjusts enabled channels and offers Undo Autoset. Probe attenuation adjusts indicated voltage and scale for the virtual 1X leads. Average combines successive acquisitions, which are identical for unchanged deterministic inputs. Peak Detect retains extrema present in the simulated samples; it does not reproduce the hardware's analog peak-detector bandwidth.

The panel displays the **actual simulated** sample count/rate. The badge lists the physical GDS-1202B's ratings, not solver performance. FFT, persistence, deep hardware memory, advanced trigger types, roll, deskew, bus decoding, search, APP and hardware interfaces remain outside this build. See `AUDIT.md` for the comparison and limitations.

## Development and verification

The app still requires no build tools or dependencies to run. Both `index.html` and `gds1202b_opamp_sim_single_file.html` are usable entry points. After editing the source files, regenerate the standalone copy:

```sh
python3 tools/build-single-file.py
```

Browser regression scripts are in `tests/simulator.cjs` and `tests/scope.cjs`. With Playwright and its Chromium browser installed, serve the project on `http://127.0.0.1:8765` and run both scripts with Node. If Playwright is outside the project, set `NODE_PATH` to its `node_modules` directory. These development dependencies are not required by students.

## Reference circuit schematics

Expand **Circuit schematics & UA741 pin guide** to compare the existing pin guide with five standard SVG schematics. The desktop split is 35% pin guide and 65% schematic. Below 1024 px the schematic appears first and the pin guide stacks below it. Phones start collapsed and allow horizontal scrolling inside the diagram to keep its labels readable.

The **Circuit schematic** dropdown defaults to the inverting amplifier. It is reference-only: changing it does not load a preset or change components, instruments, selection, Undo/Redo, or browser storage. Loading a preset also leaves the chosen reference unchanged. The drawings represent built-in circuit values, not a live schematic generated from edits or saved overrides.

The drawings use the same dark background and cyan, amber, coral, and mint palette as the UA741 pin guide, with a 640 px maximum display width for a more compact section. The non-inverting amplifier draws pin 3 (+) above pin 2 (−), with its feedback divider below the triangle; this changes its presentation, not its electrical connections.

Each reference shows standard resistor/capacitor/op-amp symbols, actual UA741 pin numbers, supplies, input/output test points, function-generator MAIN/return, and common oscilloscope grounds. Negative supply and ground remain separate. `presets.js` supplies logical component roles and values; `schematics.js` renders the diagrams with stable wire/net identifiers. This metadata stays outside saved circuits. Hover, focus, and tap connection explanations are reserved for Step 2 after schematic review; this delivery is Step 1.

Run `node tests/schematics.cjs` alongside the ten existing scripts. It checks literal circuit definitions, physical preset connectivity, connected SVG component terminals, unambiguous wire junctions, unchanged simulator state, desktop proportions, text bounds, keyboard controls, responsive views, and all five offline schematics. The portable builder embeds the renderer automatically.

## Overwriting presets

Load a preset, edit the circuit and scope controls, then click **Save over preset**. This overwrites the preset selected in the dropdown with your current parts, exact hole positions, leads, values, supply/generator settings and scope configuration. The dropdown marks customized presets **Saved**. Loading that preset, including after a page reload, uses your saved version; acquisitions restart in Run mode.

**Restore original** removes the selected preset's saved override and loads its built-in version. **Reset lab** still creates a truly blank board. Saved overrides live in this browser's local storage for this site/file origin; they do not rewrite the HTML or transfer automatically to other browsers. The separate Save lab / Recall lab slot remains independent.

To create a separate preset, enter a **New preset name** and click **Create new preset** (or press Enter). The new preset is selected automatically and can subsequently be overwritten using **Save over preset**. Names must be unique. For custom presets, **Delete preset** removes the saved preset while keeping the current circuit open. These presets also persist in this browser after reload.

**Export saved presets** downloads `gds1202b-saved-presets.json`, including all local preset overrides and custom presets from the current browser origin. This is a snapshot; it does not change the browser's saved presets or automatically embed future changes.

## SFG-1013 front-panel trainer

The simulator includes the photographed **GW Instek SFG-1013** with all of its front-panel control types connected to the model: POWER, OUTPUT ON/OFF, WAVE, numeric/decimal keys, SHIFT shortcuts, frequency digit selection and knob, amplitude control, duty/offset pull controls, voltage/frequency display, −40 dB attenuation, and MAIN/TTL connection controls. See [the student guide](SFG1013_GUIDE.md) for operation and model details. The additional 50 Ω termination checkbox is an external load, not a hardware control.

Both outputs use the generator's common grounded return. MAIN has 50 Ω source resistance; loading can therefore reduce the signal at the breadboard. For example, the default inverting circuit's 10 kΩ input resistance reduces a 2 Vpp open-circuit input to approximately 1.990 Vpp. The gain measured relative to that actual input remains approximately −4.7. Legacy presets acquire default generator panel settings automatically; new saves include output state, duty, offset enable, attenuation, TTL/return connections and external termination.

`sfg1013.js` contains the panel and signal functions and is included automatically by `tools/build-single-file.py`. `tests/generator.cjs` verifies keypad sequences, limits, knobs, loading and responsive layout. The trainer does not reproduce hardware noise, calibration, warm-up, output tolerances, TTL edge timing or TTL current loading; it uses a nominal 0–5 V TTL waveform.

## One connection per hole

Each physical breadboard hole accepts one terminal: a wire end, resistor/capacitor terminal, UA741 pin, or instrument lead. Occupied holes are rejected during creation, lead placement, terminal reconnection, dragging, nudging and numeric position edits. All eight IC pins reserve their holes. Moving a part may reuse its own old holes, and separate holes on the same electrical strip remain legal. Rejected moves leave the original circuit and undo history unchanged; hover readouts identify the occupant.

Older saved layouts with overlapping terminals are repaired when loaded by moving conflicting terminals to free holes on the same electrical strip. Existing nonconflicting holes and all electrical nets are preserved. If a strip is full or IC packages overlap, the load is rejected without replacing the current circuit. Built-in presets specify distinct physical holes explicitly; loading them does not rely on automatic allocation. `tests/occupancy.cjs` covers these behaviors.

## Local interface redesign

The Chula-branded **Op-Amp Lab Simulator** retains the original breadboard → SFG-1013 → GDS-1202B section order and electrical model. At desktop widths (1280px and above), the workspace uses tools / breadboard / settings columns. Tools wrap above the board on smaller screens. On phones, use board zoom and Pan view for precise connections.

The UA741 OpAmp Pin Config diagram shows the pin functions in the chip's breadboard orientation. **Manage presets** expands the saved-preset controls. Selecting a component reveals its settings; **Exact position** and **Advanced model** expand additional controls. Circuit warnings expand beneath the board when they change.

`routing.js` derives orthogonal wire and instrument-lead paths, avoiding component bodies, complete passive leads, value labels, and occupied terminals. Wires can cross other wires with small bridge marks to distinguish crossings from electrical junctions. Routing prefers short, simple paths with a modest crossing cost and a stronger penalty for shared segments; it does not take long detours merely to avoid another wire. Component bodies, complete passive leads, labels, and unrelated terminals remain routing obstacles. Instrument docks follow the nearest left or right board edge, with spaced labels included in the routing obstacles. The same paths support wire selection, movement and deletion. Routes are cached by geometry and are never saved as electrical state. Dense layouts can fall back to an orthogonal path with crossings; automatic routing does not reposition components or alter any connected hole.

`layout.js` manages the responsive pin guide and editor disclosures. The local `assets/` directory contains the existing lab logo and Inter fonts (license included). Rebuild the portable file after changing source files or assets:

```sh
python3 tools/build-single-file.py
```

The generated HTML embeds code, styles, images, fonts and the font license. It runs directly from disk without a network connection. This clone has not been integrated into the parent React app or deployed to Vercel.

In addition to the five original browser scripts, run `node tests/routing.cjs` for routing checks and `node tests/layout.cjs` for responsive layouts, routing interactions, preserved topology and offline portable-file checks. Browser tests require a Playwright installation (set `NODE_PATH` if it is outside this repository) and this server:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

`tests/layout.cjs` writes review screenshots beneath the parent workspace's `output/playwright/simulator-redesign/` directory. Existing preset and occupancy tests now open the new disclosures before using their controls; their original behavioral assertions remain intact.


## Corrected UA741 orientation and older saves

The pin configuration diagram is the package top view rotated counterclockwise, placing the notch on the left: **E-row pins are 8, 7, 6, 5; F-row pins are 1, 2, 3, 4**, from left to right. Pin 1 has a dot beside it. `ua741.js` supplies the package functions, the pin configuration drawing, physical pin holes, and the electrical pin mapping used by the solver and presets.

Earlier versions mirrored the pin assignment across the breadboard gap. Their internally consistent presets could produce correct waveforms while teaching an incorrect physical pinout. New circuits use the corrected mapping and new lab/preset save envelopes contain `pinoutVersion: 2`.

Loading an unversioned save that contains an op-amp first validates and allocates its original holes, then reflects all main-board terminals and source/probe connections across the gap (A↔J, B↔I, C↔H, D↔G, E↔F; T↔B electrical strips). Columns, supply-rail connections, component values, and instrument settings are retained. Reflecting the whole circuit preserves shared connections even with multiple op-amps. Saves without op-amps keep their positions. The existing same-strip repair of overlapping legacy terminals happens before this separate pinout conversion.

A dismissible notice identifies converted circuits. Loading and exporting do not overwrite stored originals. Explicitly saving the lab or preset writes the corrected version; later loads do not reflect it again. Exported preset copies are normalized and versioned while the export bundle format remains version 1. Unsupported pinout versions or malformed data are rejected before changing the current circuit or downloading a partial export.

`node tests/ua741.cjs` checks the literal physical pin table and connection reflection. `node tests/pinout.cjs` uses explicit physical-hole wiring, signed complex preset gains, pre-correction waveform fixtures, two cascaded op-amps, migration/export/storage checks, and desktop/mobile guide screenshots. Run it with the same Playwright setup and local server as the other browser tests. Rebuild the portable HTML after editing the shared pin definition.

### RC filter profile

`rc.html` uses the same editor and instrument runtime as the op-amp lab, with independent rails and only wire/resistor/capacitor tools. `rc.js` owns three general circuit presets plus the instructor-only UAV high-pass preset, their references, and atomic version-2 recall validation; version-1 saves migrate to ordinary function-generator input. Storage remains `rc-filter-v1-*` so existing saves and custom presets remain available. `rc-signals.js` defines repeatable UAV and sensor/noise examples independently of the SFG front panel, preserving original EEG signals for legacy recalls. Input choice, synthetic output, noise enable, and strength persist in `state.rcInput`. Source selection never automatically changes wiring or scope scales.

The UAV example uses a conditioned accelerometer teaching signal: 200 Hz/1 V peak motor vibration and 2 Hz/0.6 V plus 5 Hz/0.3 V aircraft movement. Its phases match Interactive Learning. The UAV preset connects 33 kΩ/100 nF with both probes and asks students to press Autoset. For synthetic sources, Autoset independently acquires a fresh record before changing settings: UAV uses 100 ms/div with movement or 2 ms/div without it; the sensor uses 2 ms/div; legacy EEG uses 1 s/div with noise or 0.2 s/div without it. It fits actual voltages on enabled connected channels, preserves coupling/probe/inversion and the circuit/source, and resumes acquisition. Failure leaves prior settings and capture intact; Undo restores them, including stopped captures. Function-generator Autoset remains unchanged. Legacy EEG appears in the selector only when recalled from an existing save or custom preset.

`rc-engine.js` solves arbitrary passive wiring with 50 Ω source resistance and shared instrument grounds. The existing generator path uses periodic boundary conditions and timestep refinement; the synthetic path solves each frequency through the wired network with complex admittances and combines the resulting phasors. It uses the matrix factorization from `transient-engine.js`, with no artificial grounding. Acquisition centers on the same source epoch for repeatable comparisons, requires at least 32 samples per fastest active period, and rejects timebases exceeding 24,000 intervals. Mixed-signal metadata survives stopped/single acquisitions; cycle, timing, frequency, and phase measurements explain why they are unavailable for mixtures. Voltage/RMS/mean/area measurements remain available. The original op-amp equations and divider DC solver remain separate.

The application README documents controls, model limits, phase convention, and verification. Package all profiles using the root `npm run package:simulator`; it produces `public/simulators/rc-filter/` and the self-contained `rc_filter_sim_single_file.html`. Do not edit generated assets. Run root RC numerical/component tests and `tests/rc-integration.cjs` in addition to this directory's existing regressions.
