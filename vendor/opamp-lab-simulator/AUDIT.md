# Simulator audit — 5 September 2026

The original circuit editor collapsed every hole to an electrical net and then invented a drawing position. It offered selection and deletion, but no movement. The revised editor retains exact physical holes alongside net IDs, with component dragging, terminal reconnection, lead dragging, keyboard/field alternatives, undo/redo, zoom/pan and persistence. Selected components receive priority over overlaps; the IC is drawn above crossing leads.

Other corrected issues: preset selector did not match startup; saved IDs could collide with new IDs; numeric labels could strip meaningful zeros; engineering-value parsing confused M and m; ground warnings checked connectivity after ground clips were already shorted; color changes were omitted from undo; oversized minimum board width and disabled page zoom hindered mobile use. Passive parts bypassed by a common net now produce a warning.

## GDS-1202B comparison

Reference: [GW Instek GDS-1000B user manual](https://www.gwinstek.com/en-US/download/downloadFile/1679), covering GDS-1202B; printed pages 38–58, 79–80 and 103.

| Function | Manual behavior / revised simulator |
|---|---|
| Measure | Eight independently sourced slots; add/remove, gating, display-all, high/low estimation, statistics, reference levels. |
| Channels | First key press opens/activates; another press with its menu open deactivates. Yellow CH1, blue CH2. |
| Run/Stop | Hold acquisition while allowing viewing adjustments. |
| Single | Wait for trigger, then stop. Force can capture without an edge. |
| Autoset | Adjust enabled channels; support undo. Minimum input checks: 20 Hz and 10 mV. |
| Probe | Attenuation changes indicated voltage and vertical scale. |
| Acquisition | Sample; sampled extrema for Peak Detect; averaging across acquisitions. |

Measurement defects corrected in this implementation: records were cropped before analysis; trigger selection truncated the visible waveform; only five values were drawn; all measurements shared one mutable source; invalid values lacked explanations; side-menu options beyond five were inaccessible; Average incorrectly smoothed adjacent time samples. Cursor source had no visual distinction and voltage adjustment always used CH1 scale. Both are corrected.

Additional corrections: forced/single captures persist while stopped; false fixed 1 GSa/s readout replaced with solver rate; waveform clipping; functional graticule selection, 5× horizontal zoom, XY and arithmetic math; saved reference scaling; named and keyboard-accessible soft keys/knobs. FFT no longer silently draws subtraction. Unsupported controls no longer claim working behavior.

## UA741 model

Reference: [Texas Instruments UA741 datasheet Rev. H](https://www.ti.com/lit/ds/symlink/ua741.pdf) and [UA741 product page](https://www.ti.com/product/UA741).

UA741CP PDIP active pins are 2 (−IN), 3 (+IN), 4 (V−), 6 (OUT), 7 (V+). Rev. H lists pins 1, 5 and 8 as NC for this package; older packages may differ. Defaults: gain 200,000, 1 MHz gain-bandwidth dominant pole, 0.5 V/µs slew limit. The fixed 2 V output headroom is an approximation, not a guaranteed load-dependent datasheet limit. Recommended dual-supply guidance is ±5 to ±15 V. Gain and slew remain editable.

## Explicit limits

This is a deterministic, event-driven analog teaching simulation, not instrument firmware or transistor-level SPICE. Captures include simulated startup; full-record measurements include that startup. Changing timebase or circuit settings computes a new acquisition. There is no injected noise, so averaging identical inputs has no visual smoothing effect. Statistical sample counts increase on new simulated acquisitions, not wall-clock time.

The solver keeps at most 5,501 samples and flags undersampled measurements. It cannot reproduce 200 MHz analog bandwidth, 1 GSa/s acquisition, 10 Mpoint memory or nanosecond peak detection. Input offset/bias, thermal effects, output-current limiting and load-dependent output swing are not modeled. Each physical hole now permits only one terminal, including instrument leads and all IC pins. Legacy overlapping layouts are relocated within their original electrical strips when possible; impossible layouts are rejected atomically. Moving an IC does not automatically relocate its wiring.

Implemented measurement types exclude the four overshoot/preshoot functions. Threshold interpolation, histogram estimation and phase extraction are teaching algorithms, not proprietary firmware algorithms. Phase is reported in −180°…180°; positive means Source 2's edge occurs later than Source 1's. Math uses CH1 vertical scale. AC coupling removes the record mean; it is not a physical input-coupling network. Trigger support is edge triggering with DC/AC coupling, slope, level, Auto/Normal and holdoff; EXT has no connected source and requires Force. FFT, timed persistence, roll, deskew, advanced triggers, bus/search/APP and hardware interfaces are unavailable.

## Verification

Chromium regression scripts cover all five circuit presets, exact placement, dragging, individual reconnections, cancellation, lead movement, undo/redo, values, IC movement, zoom/pan, saved/reloaded positions, malformed saved JSON, saturation/slew bounds and mobile overflow.

Scope tests check analytical sine and square-wave measurements, independent channel slots, the eight-item limit, cursor gates, actual cursor pixel colors, stopped acquisitions, single/force behavior, menu paging, statistics and mobile layout. No browser JavaScript errors were observed in these runs. The standalone HTML is regenerated from the tested sources and checked independently.
