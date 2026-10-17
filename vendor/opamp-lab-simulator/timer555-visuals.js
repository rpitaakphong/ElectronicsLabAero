/* Code-native reference drawings, shared by the lesson and breadboard profile. */
(function (root) {
  'use strict';
  const eng = (v, u) => {
    const [s, p] = [
      [1e6, 'M'],
      [1e3, 'k'],
      [1, ''],
      [1e-3, 'm'],
      [1e-6, 'µ'],
      [1e-9, 'n'],
    ].find(([s]) => Math.abs(v) >= s) || [1, ''];
    return `${Number((v / s).toPrecision(3))} ${p}${u}`;
  };
  function guide() {
    const labels = [
      'GND',
      'TRIG',
      'OUT',
      'RESET',
      'CONT',
      'THRES',
      'DISCH',
      'VCC',
    ];
    return `<svg viewBox="0 0 320 270" role="img" aria-label="NE555 DIP-8 top view, notch left on the breadboard. Upper pins left to right: 8 VCC, 7 DISCH, 6 THRES, 5 CONT. Lower pins: 1 GND, 2 TRIG, 3 OUT, 4 RESET."><g font-family="Inter,system-ui,sans-serif" font-size="12" text-anchor="middle" fill="#dbe7ec"><text x="160" y="25">NE555 · BREADBOARD TOP VIEW</text><rect x="65" y="95" width="190" height="70" rx="9" fill="#101a24" stroke="#9db3c2"/><path d="M65 117a13 13 0 0 1 0 26" fill="none" stroke="#9db3c2"/><circle cx="80" cy="153" r="3"/><text x="160" y="136" font-size="20">NE555</text>${Array.from(
      { length: 4 },
      (_, i) => {
        const x = 90 + i * 46;
        return `<path d="M${x} 95V75M${x} 165V185" stroke="#9db3c2"/><text x="${x}" y="64" fill="#74d8c0">${8 - i} ${labels[7 - i]}</text><text x="${x}" y="204" fill="#efcb73">${i + 1} ${labels[i]}</text>`;
      },
    ).join(
      '',
    )}<text x="160" y="240" fill="#9db3c2">Notch left · pin 1 beside the dot</text></g></svg>`;
  }
  function schematic(config, high = null) {
    const { mode, r1, r2, c, vcc } = config,
      astable = mode === 'astable';
    const text = (x, y, s, extra = '') =>
      `<text x="${x}" y="${y}" fill="currentColor" stroke="none" ${extra}>${s}</text>`;
    const resistor = (x, y, label) =>
      `<path d="M${x} ${y - 36}v12h-9v48h18v-48h-9m0 48v12"/>${text(x - 18, y + 4, label, 'text-anchor="end"')}`;
    const capacitor = (x, y, label) =>
      `<path d="M${x} ${y - 32}v26m-18 0h36m-36 12h36m-18 0v26"/>${text(x + 24, y + 5, label)}`;
    const accent = high === null ? '#91b3c1' : high ? '#75dfb6' : '#65bbf5';
    return `<svg class="timer555-schematic" viewBox="0 0 820 470" role="img" aria-label="${astable ? 'Astable oscillator' : 'Monostable one-shot'} complete NE555 schematic, including reset pull-up, control bypass, and supply bypass. Output is pin 3; timing capacitor is measured at pin 6."><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="350" y="135" width="210" height="175" rx="8"/><path d="M75 40H745M430 40V135M390 40V58M390 130V135M430 310V420H75M75 420H745M510 310V333M510 397V420M745 40V83M745 147V420M560 220H705"/>${resistor(390, 94, '10 kΩ')}${capacitor(510, 365, '10 nF')}${capacitor(745, 115, '100 nF')}
    <g stroke="${accent}"><path d="M160 40V59M160 131V175H350M160 175V${astable ? '189' : '295'}M350 225H260V295H160M350 265H260"/>${resistor(160, 95, `${astable ? 'R1' : 'R'} · ${eng(r1, 'Ω')}`)}${astable ? `${resistor(160, 225, `R2 · ${eng(r2, 'Ω')}`)}<path d="M160 261V323M260 265V295"/>` : '<path d="M160 295V323"/>'}${capacitor(160, 355, `C · ${eng(c, 'F')}`)}<path d="M160 387V420"/></g>
    ${astable ? '' : `<path d="M260 265H300V131M300 59V40M300 265V330m0 32v58M280 330h40m-35 32l26-20"/>${resistor(300, 95, '10 kΩ')}${text(325, 365, 'Trigger · N.O.')}`}
    <circle cx="160" cy="175" r="3" fill="currentColor"/><circle cx="260" cy="295" r="3" fill="currentColor"/>
    </g><g fill="currentColor" font-family="Inter,system-ui,sans-serif" font-size="13">${text(75, 27, `+${vcc} V · VCC`)}${text(75, 446, '0 V · supply return and both scope grounds')}${text(365, 170, '7 DISCH')}${text(365, 220, '6 THRES')}${text(365, 260, '2 TRIG')}${text(390, 155, '4', 'text-anchor="middle"')}${text(430, 155, '8', 'text-anchor="middle"')}${text(430, 298, '1 GND', 'text-anchor="middle"')}${text(510, 298, '5 CONT', 'text-anchor="middle"')}${text(546, 215, '3', 'text-anchor="end"')}${text(455, 195, 'NE555', 'text-anchor="middle" font-size="21"')}${text(585, 203, 'CH1 · output')}${text(190, 312, 'CH2 · capacitor')}${text(390, 122, 'RESET', 'text-anchor="end" font-size="10"')}</g></svg>`;
  }
  root.Timer555Visuals = { guide, schematic };
})(globalThis);
