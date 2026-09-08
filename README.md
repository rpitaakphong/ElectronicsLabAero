# Electronics Learning Lab

A Vite, React, and TypeScript learning app with separate voltage-divider and operational-amplifier labs. Choose a topic from the home page and adjust components to see the circuit, equations, plots, and measurements update together.

## Learning topics

- `/`: topic home page
- `/voltage-divider`: basic, loaded, potentiometer, and adjustable-resistance sensor dividers, with DC response curves and short experiments
- `/operational-amplifier`: topic landing page with Interactive Learning and the Op-Amp Lab Simulator
- `/operational-amplifier/learn`: the six existing ideal op-amp simulations
- `/operational-amplifier/simulator`: UA741 breadboard workspace with a function generator and oscilloscope

The divider lab uses an ideal 0–24 V DC source and 100 Ω–1 MΩ resistors. Potentiometer position runs from ground (0%) to the supply (100%). Loaded circuits account for the load in parallel with the lower resistor. Sensor resistance is adjusted directly without assuming a specific sensor. Settings persist while switching configurations, but leaving a lab or refreshing restores defaults.

Client-side routes support browser Back/Forward and direct links. Hosts must serve `index.html` for route requests; the included Vercel configuration already does so.

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
- `src/App.tsx`: topic home page and application routes
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

The homepage opens `/operational-amplifier`, a two-tool topic page. Interactive Learning is at `/operational-amplifier/learn`; the breadboard lab is at `/operational-amplifier/simulator`. Both have breadcrumbs back to the topic and homepage.

The maintained simulator source is in `vendor/opamp-lab-simulator`, imported from https://github.com/vtaerodoctor-hokie/gds1202b_opamp_sim with our local layout, pinout, routing, and schematic changes. Make simulator changes there; the `tmp` checkout is no longer an integration dependency. Runtime assets retain their bundled font license and original documentation.

`npm run dev` and `npm run build` first run `scripts/package-simulator.mjs`. This Node-only step copies runtime files and assets into the generated, ignored `public/simulators/opamp/` directory and generates the downloadable offline HTML from the same inputs. Run `npm run package:simulator` after editing vendor files during an already-running dev session. Do not edit generated public files. Vite copies this directory into `dist`; the existing Vercel SPA rewrite serves application routes while real simulator assets are served as files.

The React simulator page embeds `/simulators/opamp/index.html?embed=1` on the same origin. Embedded mode hides duplicate branding and the introduction, retaining Challenge mode and Reset lab. A parent ResizeObserver sizes the iframe to the body, and viewport updates keep board scrolling and notifications aligned with the visible page. The iframe is removed when leaving the page. Simulation state, presets, and history are independent of the learning tool; Save/Recall remains explicit. Localhost and deployed-domain saves are separate browser storage. This release adds no automatic save or migration between origins.

The **Download offline simulator** link downloads a self-contained HTML file. Opening `/simulators/opamp/index.html` directly retains the standalone header. Neither version needs a backend or external runtime assets.

For simulator regression checks, run all `vendor/opamp-lab-simulator/tests/*.cjs` from that vendor directory with `SIMULATOR_URL=http://127.0.0.1:3000/simulators/opamp/` (trailing slash required). Browser scripts use Playwright; set `NODE_PATH` to its installation if necessary. `tests/integration.cjs` checks the integrated app, including routing, iframe resizing, storage, responsive layouts, and the downloadable file; set `APP_URL` to the dev or production-preview origin. Deployment is separate from this local integration.
