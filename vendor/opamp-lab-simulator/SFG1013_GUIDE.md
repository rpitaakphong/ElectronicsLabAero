# GW Instek SFG-1013 practice guide

Reference: [manufacturer’s SFG-1000-series manual](https://www.gwinstek.com/en-global/download/downloadFile/5814), SFG-1013 controls, printed pages 12–14, 20–27 and 37. The panel layout follows the supplied photograph.

| Control | Operation |
|---|---|
| POWER / OUTPUT | Power the instrument, then enable output. |
| WAVE | Cycle sine, square, triangle. |
| Numeric keys | Enter frequency; finish with SHIFT → 8 (MHz), 9 (kHz), or 0 (Hz). |
| SHIFT → 4 / 5 | Select the frequency digit; turn FREQUENCY to adjust. |
| SHIFT → decimal | Toggle frequency/amplitude display. |
| AMPL | Adjust MAIN amplitude. |
| SHIFT → 3 | Toggle −40 dB attenuation. |
| DUTY | Pull to adjust; push for 50%. |
| OFFSET | Pull to apply DC offset; push to disable it. |
| SHIFT → WAVE | Enable TTL after OUTPUT is on. Repeat to leave TTL. |

Frequency limits are 0.1 Hz–3 MHz for sine/square/TTL and 0.1 Hz–1 MHz for triangle. Err-1, Err-2 and Err-4 clamp invalid entries. Duty adjustment spans 25–75% through 1 MHz. MAIN and TTL use separate connectors; amplitude and offset controls do not adjust TTL.

## Practice in this simulator

1. Load Voltage follower. Use MAIN and common return buttons if you want to relocate their leads; click their target breadboard holes.
2. Enter `3`, `7`, `SHIFT`, `9`. The generator frequency is now 37 kHz. Adjust the oscilloscope time/div and trigger until the waveform is stable.
3. Use SHIFT → decimal and AMPL to explore signal level. The trainer's numeric voltage display is nominal Vpp into 50 Ω; the extra output readout also gives the open-circuit value.
4. Add the external 50 Ω termination. Compare the measured amplitude with the unterminated signal. Remove that load, turn on −40 dB, and adjust the scope scale to recover the smaller trace.
5. Select square, pull DUTY and vary it. Use the oscilloscope Duty Cycle and +Width measurements. Push DUTY to restore 50%.
6. Pull OFFSET, move the signal vertically, and observe clipping at large amplitude plus offset. Push OFFSET to remove its contribution.
7. Connect TTL to a separate breadboard net and probe that net. Enable OUTPUT and SHIFT → WAVE. Change MAIN amplitude and offset: TTL stays at its fixed modeled levels.

Scroll a dial, drag it vertically, or focus it and use arrow keys. The explicit pull buttons replace the physical action of pulling knobs. The keypad also accepts digit/decimal keys while the panel has focus; Escape cancels an unfinished entry and Backspace edits it.

## Trainer-specific behavior

The extra readouts, connector buttons and external termination checkbox are teaching aids. MAIN uses a Thevenin source with 50 Ω series resistance. The voltage clips at ±10 V open circuit before the attenuator; the attenuator scales both the signal and offset. Actual breadboard voltage depends on its load.

TTL is represented as ideal 0–5 V without analog loading/edge behavior. The model allows MAIN and TTL concurrently, retains the selected MAIN waveform, and mutes MAIN triangle above 1 MHz while TTL can run faster. Duty is held at 50% above 1 MHz. These are explicit modeling choices, not claims about unspecified concurrent hardware behavior.

Cold power-up uses sine / 1 kHz with OUTPUT off in the trainer; loading a demonstration preset can enable output. Analog-knob settings persist through power toggles. The quick setup fields are shortcuts outside the front panel. Existing saved circuits remain readable and new preset saves preserve the generator's persistent settings. In-progress keypad entries and the selected editing digit are transient.

This deterministic simulation does not emulate accuracy tolerances, jitter, waveform distortion, warm-up/calibration, or TTL output-current limits. At high frequencies, use a sufficiently fast oscilloscope timebase; the educational solver does not reproduce the scope's physical sampling hardware.
