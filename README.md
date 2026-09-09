# Electronics Learning Lab

A Vite, React, and TypeScript learning app with voltage-divider, RC filter, and operational-amplifier labs. Start at the welcome page, browse the searchable topic catalog, then use interactive lessons and breadboard simulators to connect circuit theory with measurements.

## Learning topics

- `/`: welcome page introducing the lab, with a link to browse topics
- `/topics`: searchable catalog of available topics
- `/resources`: getting started, saving work, model limitations, and all three offline downloads
- `/voltage-divider`: topic page with Interactive Learning and the Voltage Divider Lab Simulator
- `/voltage-divider/learn`: basic, loaded, potentiometer, and adjustable-resistance sensor dividers, with DC response curves and short experiments
- `/voltage-divider/simulator`: shared breadboard workbench with a DC supply and V/A/Ω multimeter
- `/rc-filter`: RC topic overview
- `/rc-filter/learn`: low-pass, high-pass, and unbuffered band-pass interactive learning
- `/rc-filter/simulator`: passive RC breadboard workbench with generator and oscilloscope
- `/operational-amplifier`: topic landing page with Interactive Learning and the Op-Amp Lab Simulator
- `/operational-amplifier/learn`: the six existing ideal op-amp simulations
- `/operational-amplifier/simulator`: UA741 breadboard workspace with a function generator and oscilloscope

The divider learning tool uses an ideal 0–24 V DC source and 100 Ω–1 MΩ resistors. Potentiometer position runs from ground (0%) to the supply (100%). Loaded circuits account for the load in parallel with the lower resistor. Sensor resistance is adjusted directly without assuming a specific sensor. Learning settings persist while switching configurations, but leaving a learning tool or refreshing restores defaults. Simulator Save/Recall is explicit and local to the browser.

Client-side routes support browser Back/Forward and direct links. Hosts must serve `index.html` for route requests; the included Vercel configuration already does so.

## Shared navigation and resources

The sticky Chula/Electronics Lab header links to Home, Topics, and Resources on every application route. The desktop Topics popover includes the catalog and each topic’s overview, Interactive Learning, and Simulator. Below 900 px, the same destinations appear in a scrollable, keyboard-contained drawer. Escape and dismissal return focus to the menu trigger; navigation closes the menu and moves focus into the destination. A skip link bypasses the header. Reduced-motion settings disable menu transitions.

Menu state lives in the shared header, separately from lesson state and iframe state. Opening or dismissing it preserves current work and instructor unlocks. Navigating away still leaves the tool, and revisiting restores the existing startup defaults. Save/Recall stays explicit; saves are separate for each simulator and browser origin. No automatic save or cross-device sync is added.

Breadcrumbs follow Home → Topics → Topic → Tool. The header height informs scroll offsets and embedded viewport sizing, keeping simulator controls and notifications accessible while scrolling. Standalone and downloaded simulators retain their own headers and Reset controls.

The catalog searches topic names and descriptions without a backend. Resources links to all three self-contained HTML simulators and explains the current model and storage behavior. Local worksheets are outside this release.

To add a topic, register its metadata and available tools in `lib/catalog.ts`, then its overview and learning components in `src/App.tsx`. The catalog, navigation, breadcrumbs, and document titles derive from the registry. Downloads and resource guidance are registered alongside the topics.

`tests/navigation-integration.cjs` checks all navigation destinations at 1512, 1024, 768, and 390 px, along with catalog search, keyboard dismissal/focus, mobile focus containment, skip links, direct links, Back/Forward, reloads, unknown routes, reduced motion, lesson settings, unsaved circuit/iframe preservation, and sticky controls/notifications. It writes review screenshots to `output/playwright/navigation/`.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal, normally [http://localhost:3000](http://localhost:3000). The app runs without an account, API key, or external service.

## Deploy on Vercel

Import the GitHub repository into Vercel. The included `vercel.json` selects the Vite framework, runs `npm run build`, and serves the generated `dist` directory. There are no environment variables to configure.

Vercel will create preview deployments and redeploy the production branch when new commits are pushed.

## Simulators

1. Comparator
2. Voltage follower (buffer)
3. Non-inverting amplifier
4. Inverting amplifier
5. Summing amplifier
6. Inverting low-pass filter

Comparator is selected at startup. Signal settings are preserved while switching circuits, and **Reset lab** restores the startup configuration.

## Using the lab

- Choose sine, square, or triangle input signals.
- Adjust amplitude, frequency, DC offset, and phase. The summing amplifier provides an independent second input.
- Change the circuit's relevant resistance, capacitance, reference voltage, and shared power-supply rails.
- Try common ±5 V, 0–5 V, ±12 V, and ±15 V supply presets or enter custom rails to observe output clipping.
- Read the current ideal equation with substituted component values.
- Compare input and output on the shared oscilloscope. Its time scale is fixed at 0.5 ms/div across a 4 ms window; vertical scaling starts on Auto fit.
- Move the time cursor to inspect signal values at a selected instant.

All settings are session-only. Refreshing the page restores the defaults.

## Model

The amplifier configurations use these ideal relationships:

- Inverting: `Vout = Vref − (Rf/Rin)(Vin − Vref)`
- Non-inverting: `Vout = Vref + (1 + Rf/Rg)(Vin − Vref)`
- Voltage follower: `Vout = Vin`
- Summing: `Vout = Vref − (Rf/Rin)(V1 − Vref) − (Rf/R2)(V2 − Vref)`
- Low-pass: low-frequency gain `−Rf/Rin` and cutoff `1/(2π Rf C)`
- Comparator: `V+` supply rail when `Vin ≥ Vref`, `V−` supply rail otherwise

The low-pass filter includes the external resistor-capacitor response. Sines are evaluated analytically; square and triangle waves use a periodic first-order filter calculation to avoid arbitrary startup transients.

This is a teaching model rather than a chip-specific SPICE simulator. It assumes infinite input impedance, zero output impedance, and unlimited amplifier speed. Every output is limited exactly at the selected power-supply rails; real devices often stop short of those rails. It does not simulate noise, input bias current, source loading, common-mode restrictions, output-current limits, bandwidth, slew rate, output headroom, stability, hysteresis, propagation delay, or overload recovery.

## Project structure

- `lib/opamp/simulator.ts`: typed configuration, validation, ideal circuit equations, filtering, and metrics
- `lib/opamp/content.ts`: circuit explanations and displayed equations
- `components/lab/`: schematic, oscilloscope, mathematical display, and parameter controls
- `src/main.tsx`: Vite browser entry point
- `lib/catalog.ts`: typed topic/resource registry and route metadata for links, titles, and breadcrumbs
- `src/App.tsx`: application routes and topic view registration
- `src/AppLayout.tsx`, `src/TopicHeader.tsx`, `src/TopicBreadcrumbs.tsx`: shared layout, accessible responsive navigation, and breadcrumbs
- `src/Welcome.tsx`, `src/TopicCatalog.tsx`, `src/Resources.tsx`: welcome, searchable topics, and student guidance
- `src/OpAmpLab.tsx`: op-amp state and interface
- `src/DividerLab.tsx`, `lib/divider/`, and `components/divider/`: divider interface, model, teaching content, and visuals
- `lib/opamp/browser-tools.ts`: optional feature-detected browser tools
- `tests/`: numerical and component checks

## Verification

```sh
npm test
npm run typecheck
npm run build
```

## References

- [Analog Devices: Basic Op Amp Configurations](https://www.analog.com/en/resources/analog-dialogue/studentzone/studentzone-may-2019.html)
- [TI: Low-Pass Filtered, Inverting Amplifier Circuit](https://www.ti.com/lit/an/sboa293a/sboa293a.pdf)
- [Analog Devices AN-849: Using Op Amps as Comparators](https://www.analog.com/media/en/technical-documentation/application-notes/an-849.pdf)


## Operational Amplifier topic and simulator

The catalog and shared Topics menu open `/operational-amplifier`, a two-tool topic page. Interactive Learning is at `/operational-amplifier/learn`; the breadboard lab is at `/operational-amplifier/simulator`. Both have breadcrumbs back through the topic, catalog, and welcome page.

The maintained simulator source is in `vendor/opamp-lab-simulator`, imported from https://github.com/vtaerodoctor-hokie/gds1202b_opamp_sim with our local layout, pinout, routing, and schematic changes. Make simulator changes there; the `tmp` checkout is no longer an integration dependency. Runtime assets retain their bundled font license and original documentation.

`npm run dev` and `npm run build` first run `scripts/package-simulator.mjs`. This Node-only step copies runtime files and assets into the generated, ignored `public/simulators/opamp/` , `public/simulators/voltage-divider/`, and `public/simulators/rc-filter/` directories and generates the downloadable offline HTML from the same inputs. Run `npm run package:simulator` after editing vendor files during an already-running dev session. Do not edit generated public files. Vite copies this directory into `dist`; the existing Vercel SPA rewrite serves application routes while real simulator assets are served as files.

The React simulator page embeds `/simulators/opamp/index.html?embed=1` on the same origin. Embedded mode hides duplicate branding and the introduction, retaining Challenge mode. The application places Reset lab and the offline download beside the page heading; Reset invokes the same simulator action as the standalone control. A parent ResizeObserver sizes the iframe to the body, and viewport updates keep board scrolling and notifications aligned with the visible page. The iframe is removed when leaving the page. Simulation state, presets, and history are independent of the learning tool; Save/Recall remains explicit. Localhost and deployed-domain saves are separate browser storage. This release adds no automatic save or migration between origins.

The **Download offline simulator** link downloads a self-contained HTML file. Opening `/simulators/opamp/index.html` directly retains the standalone header. Neither version needs a backend or external runtime assets.

For simulator regression checks, run all `vendor/opamp-lab-simulator/tests/*.cjs` from that vendor directory with `SIMULATOR_URL=http://127.0.0.1:3000/simulators/opamp/` (trailing slash required). Browser scripts use Playwright; set `NODE_PATH` to its installation if necessary. `tests/integration.cjs` checks the integrated app, including routing, iframe resizing, storage, responsive layouts, and the downloadable file; set `APP_URL` to the dev or production-preview origin. Deployment is separate from this local integration.

The simulator starts with **Blank board** on every visit. **Unlock presets** requires instructor password `aero1234` before choosing other presets or managing saved presets; reloading locks them again. Unlocking does not load a circuit. Existing saved presets are preserved, including overrides of Blank board, but cannot auto-load at startup. Student Save/Recall and reference diagrams remain available. This browser-side gate discourages accidental answer reveals and is not secure authentication.


## Voltage Divider Lab Simulator

The voltage-divider topic has two independent tools: the original learning page at `/voltage-divider/learn` and a breadboard simulator at `/voltage-divider/simulator`. The simulator shares the existing editor, occupancy rules, wire routing, movement, undo/redo, and iframe layout with the op-amp lab. Its profile provides resistors, a three-terminal potentiometer, an adjustable resistance sensor, a DC supply, and an ideal multimeter. It has no function generator, oscilloscope, or challenge score.

Start with a blank board. Set the supply from 0–24 V (default 5 V, output off), connect its positive and negative leads, and wire the components. Each full-length rail is independent; no rail is automatically powered or grounded. Each A–E column and each F–J column remains one connected strip. Every physical hole accepts one terminal or instrument lead.

Resistances range from 100 Ω to 1 MΩ, with 10 kΩ defaults. Place a potentiometer by choosing A, B, then W. Its wiper runs from B (0%) to A (100%); a load can be wired from W to B. Sensor resistance is adjusted directly and has no temperature/light model. Escape cancels an incomplete part, and the editor supports exact positions and reconnection of all terminals.

The multimeter has automatic engineering units and two movable probes:

- **V:** red voltage minus black voltage, with infinite input impedance and no ground connection.
- **A:** an ideal zero-resistance branch. Open a circuit branch and insert the meter in series; positive current enters red. Placing it across the supply produces a short-circuit warning.
- **Ω:** requires supply output off. Measures equivalent resistance between probes, including parallel paths. Open circuits display `OL`; shorted probes display 0 Ω. Disconnect a component to measure it alone.

Invalid or undefined readings display `—` with a reason. Separate floating networks are never implicitly grounded or connected. Supply output off is an open circuit; enabled 0 V is an ideal voltage constraint. The model includes no component tolerances, fuse behavior, meter ranges, or current limits.

Four presets cover basic, loaded, potentiometer, and sensor dividers. They use the existing instructor password `aero1234`; unlocking lasts for the current visit and does not load anything. Reference diagrams and student Save/Recall remain available while locked. Startup and Reset always use the original blank board. Divider saves and custom presets use `voltage-divider-v1-*` keys, independently of op-amp saves. Recall validates the complete circuit before changing it. No automatic save or cross-origin migration is performed.

`vendor/opamp-lab-simulator/profiles.js` selects lab capabilities. `engine.js` contains shared connectivity and matrix-solving primitives; `dc-engine.js` solves the actual resistor network once per change, without scope timing or artificial ground leakage. `divider.js` supplies divider instruments, references, presets, and versioned persistence. `divider.html` is the standalone source entry. `scripts/package-simulator.mjs` builds all three profiles and their self-contained offline downloads; never edit the generated public assets.

Numerical tests cross-check all four configurations against the independent learning model. Browser acceptance checks exercise real wiring, measurements, faults, editing, persistence, preset access, responsive layouts, and the actual offline download:

```sh
npm test
npm run typecheck
npm run lint
npm run build
# With Playwright available (set NODE_PATH to its installed node_modules if needed):
APP_URL=http://127.0.0.1:3000 node tests/divider-integration.cjs
APP_URL=http://127.0.0.1:3000 node tests/integration.cjs
APP_URL=http://127.0.0.1:3000 node tests/navigation-integration.cjs
```

If a restricted environment prevents the `tsx` CLI from opening its IPC pipe, the equivalent test command is `node --import tsx --test tests/*.test.ts tests/*.test.tsx`. For op-amp browser checks against packaged assets, set `SIMULATOR_URL` and `SIMULATOR_OFFLINE_PATH` to the packaged op-amp directory and offline HTML respectively, as described above.

## RC Filter topic

The recommended order is **Voltage Divider → RC Filter → Operational Amplifier**. `/rc-filter` offers Interactive Learning at `/rc-filter/learn` and the breadboard Lab Simulator at `/rc-filter/simulator`. The catalog, shared menu, breadcrumbs, titles, and Resources download list use `lib/catalog.ts`.

The learning tool covers passive low-pass, high-pass, and an **unbuffered** high-pass/low-pass cascade. Its ideal-source model includes optional output loading and the loading between cascade stages. Gain/phase plots mark the selected input frequency and half-power cutoffs relative to passband or peak gain. Band-pass results distinguish complete-network bandwidth from isolated-stage corners. Periodic sine, square, and triangle plots show four periods; initially uncharged step responses show eight slowest time constants. Components range from 100 Ω–1 MΩ and 100 pF–10 µF. Source controls cover 0.1 Hz–1 MHz, 0–5 V peak and ±5 V offset. Configuration-specific components and shared source settings persist while switching configurations; Reset, route departure, and reload start fresh.

`lib/rc/simulator.ts` is independent of React and the breadboard engine. It uses the actual network transfer function and exact first-order modal responses, including periodic boundary conditions for square and triangle waves. The default band-pass peak is about 503.29 Hz with gain 5/6, not the product of two isolated filter stages.

The RC breadboard reuses the editor, SFG-1013, and two-channel scope. All four rails are independent; each five-hole strip remains connected. Start blank with disconnected leads and generator output off. Place wires, 10 kΩ resistors, and 10 nF capacitors; edit values within the same component limits as the learning tool. The three examples connect MAIN/return, CH1 input, and CH2 output and enable the signal. Instructor unlock (`aero1234`) lasts only for the visit and never loads a circuit. References never modify wiring; student Save/Recall works while locked.

**Measure actual input voltage.** The bench generator has a 50 Ω MAIN source resistance and displays nominal amplitude into 50 Ω: its unloaded voltage is twice that value. The learning source is ideal. For a single sine-wave input, measure filter gain as CH2 Vpp / CH1 Vpp. For output phase relative to input, select Phase with Source 1 = CH2 and Source 2 = CH1; negative phase is lag. Generator return and both scope ground clips are electrically common. Connecting ground clips to different circuit nodes joins those nodes and can bypass a component or short a source. The simulator warns and solves the resulting network when possible; disconnected, floating, or conflicting-source measurements clear rather than inventing a ground reference.

`transient-engine.js` contains shared resistor/capacitor matrix stamping and factorization. The op-amp transient model keeps its existing behavior; the divider retains its separate DC solve. `rc-engine.js` solves actual passive wiring with a backward-Euler periodic boundary solve, then doubles timestep resolution to check convergence independently of the displayed scope window. Computation is bounded at 16,384 steps per period, 60 connected nodes, and 24 capacitors; unresolved or singular calculations report a reason. Extremely fast transients relative to the period or more than 1,500 periods in the scope window can require changing frequency or TIME/DIV. No leakage, hidden supply rails, parasitics, tolerances, active filters, band-stop tools, or automatic frequency sweep are added.

RC Save/Recall stores lab `rc-filter`, version `1`, under `rc-filter-v1-*`, including component terminals, leads, generator and scope settings. Recall validates before replacing current work and recomputes live traces. Storage is browser/origin-specific and isolated from divider and legacy op-amp keys. Saving remains explicit; leaving the simulator discards unsaved work.

Packaging also generates `/simulators/rc-filter/` and `rc_filter_sim_single_file.html` from the maintained vendor files. The Resources page and simulator heading offer this self-contained, network-free download. Generated simulator assets are ignored by Git. Standalone files retain their own headers; opening application navigation preserves the embedded workbench.

RC verification includes analytical cutoff, phase, loading, step, band-pass, waveform, extreme-value and convergence tests, component-state tests, and actual browser measurements. Run `APP_URL=http://127.0.0.1:3000 node tests/rc-integration.cjs` with Playwright available, alongside the existing three application integration scripts and vendor regression scripts. Browser checks cover all three examples, invalid recall, isolated saves, stale readings, four viewport widths (1512/1024/768/390), route reloads, and the downloaded offline file. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as well. Deployment remains separate.

### Useful signals and interference

RC Interactive Learning starts with a controlled filtering example in each category. All tones are zero-phase sine waves with zero DC offset:

| Category | Useful signal | Interference at 100% strength |
| --- | --- | --- |
| Low-pass: Clean a sensor signal | 200 Hz, 1 V peak | 10 kHz, 0.35 V peak |
| High-pass: Remove sensor drift | 5 kHz, 1 V peak | 50 Hz, 0.6 V peak |
| Band-pass: Isolate a vibration | 500 Hz, 1 V peak | 20 Hz, 0.6 V peak; 10 kHz, 0.35 V peak |

Choose **Clean signal**, **Signal with interference**, or **Custom waveform**. Examples expose useful-signal frequency (0.1 Hz–1 MHz), amplitude (0–5 V peak), and interference strength (0–200%). **Advanced signal settings** lets students change individual interference frequencies. These are deterministic disturbances, not random noise. Frequencies can overlap: the filter acts on both useful and unwanted content at the same frequency.

The waveform comparison shows the dashed desired reference, measured input, and actual filtered output on common axes. Output amplitude and phase are never corrected to match the reference. **Signal detail** requests four useful periods; **Long overview** requests the longer of that span or one period of the slowest active interference tone, revealing baseline drift. Sampling uses at least 32 intervals per fastest active tone, at least 1,001 samples, and at most 32,769. Extreme frequency separation shortens the displayed window with an explicit explanation rather than aliasing. The model sums each tone's analytical complex response, including the actual load and unbuffered interstage loading.

The tone table reports theoretical gain and input/output amplitudes for each component, independently of the displayed window. The frequency panel plots discrete input/output amplitudes in V peak, combining coincident tones. Gain/phase plots mark useful and active unwanted frequencies and compare the output response against explicit input references of 0 dB and 0°. These normalized references are distinct from the actual signal spectrum. A composite waveform's Vpp ratio is not treated as filter gain. Students tune R and C to reduce disturbances, then explore when that tuning also attenuates or delays the useful signal.

Each category remembers its own example values, input selection, and waveform window. Clean/interference switching changes only the added tones. Custom sine/square/triangle controls remain shared across categories; step response stays separate. Reset, route departure, and reload restore defaults. The breadboard simulator and offline simulator behavior are unchanged by these learning examples.

Additional verification: `tests/rc-signals.test.ts` checks independent network equations, tone superposition, phase, loading, zero/coincident tones, and bounded sampling. `tests/rc-signals-integration.cjs` checks input controls, state retention, keyboard/navigation, tone tables, window limits, and layouts at 1512/1024/768/390 px. Run it with `APP_URL` and Playwright configured like the other browser suites.
