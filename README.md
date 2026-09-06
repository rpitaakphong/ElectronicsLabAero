# Op-Amp Learning Lab

A local interactive learning tool for exploring six ideal operational-amplifier circuits. Adjust signals and components to see the schematic, equation, waveform, and measured values update together.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal, normally [http://localhost:3000](http://localhost:3000). The app runs without an account, API key, or external service.

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
- Change the circuit's relevant resistance, capacitance, reference-voltage, or comparator-output values.
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
- Comparator: HIGH when `Vin ≥ Vref`, LOW otherwise

The low-pass filter includes the external resistor-capacitor response. Sines are evaluated analytically; square and triangle waves use a periodic first-order filter calculation to avoid arbitrary startup transients.

This is a teaching model rather than a chip-specific SPICE simulator. It assumes infinite input impedance, zero output impedance, unlimited amplifier speed, and unlimited output swing. It does not simulate noise, input bias current, source loading, common-mode restrictions, output-current limits, bandwidth, slew rate, clipping, stability, hysteresis, propagation delay, or overload recovery.

## Project structure

- `lib/opamp/simulator.ts`: typed configuration, validation, ideal circuit equations, filtering, and metrics
- `lib/opamp/content.ts`: circuit explanations and displayed equations
- `components/lab/`: schematic, oscilloscope, mathematical display, and parameter controls
- `app/page.tsx`: shared application state and interface
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
