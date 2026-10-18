/* Workbook-only vector drawings. Every IC uses the same DIP-8 top view.
 * Trigger and timing nets stay separate in monostable views. Timing values
 * are selected by students; only supply decoupling and trigger bias are fixed. */
const ink = '#254e5b', change = '#087f85', remove = '#b65b24';
const text = (x, y, label, extra = '') => `<text x="${x}" y="${y}" ${extra}>${label}</text>`;
const wire = (net, path, extra = '') => `<path data-wire-net="${net}" d="${path}" ${extra}/>`;
const dot = (x, y, color = ink) => `<circle data-junction="true" cx="${x}" cy="${y}" r="4" fill="${color}" stroke="none"/>`;
const resistor = (id, x, top, height, extra = '') => `<rect data-component="${id}" x="${x - 15}" y="${top}" width="30" height="${height}" rx="2" fill="#fcfefd" ${extra}/>`;
const capacitor = (id, x, y) => `<path data-component="${id}" d="M${x - 22} ${y}h44m-44 12h44"/>`;
const badge = (x, y, number, color) => `<g aria-hidden="true"><circle cx="${x}" cy="${y}" r="16" fill="${color}" stroke="none"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="19" font-weight="700" fill="#fff">${number}</text></g>`;

// Lead endpoints are shared by the pin guide, every circuit and connectivity tests.
export const DIP8_PINS = Object.freeze([
  { number: 1, name: 'GND', x: 320, y: 270 }, { number: 2, name: 'TRIG', x: 320, y: 360 },
  { number: 3, name: 'OUT', x: 320, y: 450 }, { number: 4, name: 'RESET', x: 320, y: 540 },
  { number: 8, name: 'VCC', x: 740, y: 270 }, { number: 7, name: 'DISCH', x: 740, y: 360 },
  { number: 6, name: 'THRES', x: 740, y: 450 }, { number: 5, name: 'CONT', x: 740, y: 540 },
].map((pin) => Object.freeze(pin)));
function dip8Chip(guide = false) {
  return `<g data-chip-layout="dip8-top" fill="none" stroke="${ink}" stroke-width="2.5">
    <rect x="380" y="180" width="300" height="440" rx="18" fill="#edf5f4"/>
    <path data-notch="top" d="M490 180a40 40 0 0 0 80 0"/>
    <circle data-pin1-dot="true" cx="405" cy="212" r="7" fill="${ink}" stroke="none"/>
    ${DIP8_PINS.map((p) => {
      const left = p.x === 320;
      const labelX = guide ? (left ? 310 : 750) : (left ? 397 : 663);
      const anchor = guide ? (left ? 'end' : 'start') : (left ? 'start' : 'end');
      return `<g data-pin="${p.number}" data-pin-x="${p.x}" data-pin-y="${p.y}"><path d="M${p.x} ${p.y}H${left ? 380 : 680}"/>${text(labelX, p.y + 8, `${p.number} · ${p.name}`, `fill="${ink}" stroke="none" font-size="${guide ? 30 : 24}" text-anchor="${anchor}"`)}</g>`;
    }).join('')}
    ${text(530, 417, 'NE555', 'fill="' + ink + '" stroke="none" text-anchor="middle" font-size="40"')}
  </g>`;
}
export function dip8PinGuide() {
  return `<svg class="dip8-pin-guide" viewBox="130 110 800 570" role="img" aria-label="NE555 DIP-8 top view, notch at the top. Left pins from top: 1 ground, 2 trigger, 3 output, 4 reset. Right pins from top: 8 VCC, 7 discharge, 6 threshold, 5 control." font-family="system-ui,sans-serif">
    ${dip8Chip(true)}
    <g fill="${ink}">${text(530, 145, 'DIP-8 · TOP VIEW', 'text-anchor="middle" font-size="30"')}${text(530, 658, 'Notch at top · dot identifies pin 1', 'text-anchor="middle" font-size="23"')}</g>
  </svg>`;
}

// Local supply/ground symbols are named nets, avoiding wires across the input/output leads.
function commonConnections() {
  return `
    ${wire('vcc', 'M80 80H1110M780 80V270H740', 'data-pins="8"')}
    ${wire('vcc', 'M320 540H250V500', 'data-pins="4"')}
    <path d="M241 510L250 500L259 510"/>
    ${wire('ground', 'M320 270H270V300', 'data-pins="1"')}
    <path d="M256 300H284M260 308H280M265 316H275"/>
    ${wire('ground', 'M80 740H1110M900 572V740M1110 242V740')}
    ${wire('vcc', 'M1110 80V230')}
    ${capacitor('supply-bypass', 1110, 230)}
    ${wire('output', 'M320 450H220', 'data-pins="3"')}
    <circle data-open-pin="5" cx="780" cy="540" r="4" fill="#fcfefd"/><path data-unused-pin="5" d="M740 540H776"/>
    ${dot(780, 80)}${dot(900, 80)}${dot(900, 740)}
  `;
}
function circuit(mode, conversion = false) {
  const mono = mode === 'monostable';
  const description = `${mono ? 'Monostable' : 'Astable'} schematic, NE555 DIP-8 top view, notch at top. ${mono
    ? 'R connects VCC to the timing node shared by pins 6 and 7. Pin 2 TRIG is separate, pulled up to VCC through 10 kiloohms, with a normally-open pushbutton to ground.'
    : 'R1 connects VCC to pin 7. R2 connects pin 7 to the timing node shared by pins 2 and 6.'} Timing capacitor C connects the timing node to ground. Pins 8 and 4 connect to +5 V; pin 1 connects to GND. Matching power and ground labels denote connected nets. Pin 5 CONT is unused and open. C_supply, 100 nanofarads, connects VCC to GND. Output is pin 3.`;
  return `<svg class="${conversion ? 'conversion-schematic' : mono ? 'monostable-schematic' : 'astable-schematic'}" ${conversion ? `data-conversion-mode="${mode}"` : ''} viewBox="0 0 1280 810" role="img" aria-label="${description}">
    <g fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      ${commonConnections()}
      ${wire('vcc', 'M900 80V160')}
      ${resistor(mono ? 'timing-r' : 'r1', 900, 160, 60)}
      ${wire(mono ? 'timing' : 'discharge', 'M900 220V330M900 300H810V360H740', 'data-pins="7"')}
      ${wire('timing', 'M740 450H900V560', 'data-pins="6"')}
      ${capacitor('timing-c', 900, 560)}
      ${mono ? `
        ${wire('timing', 'M900 330V450', conversion ? 'stroke="' + change + '" stroke-width="4" data-change="2"' : '')}
        ${wire('vcc', 'M100 80V160')}
        ${resistor('trigger-pullup', 100, 160, 60, 'stroke="' + change + '"')}
        ${wire('trigger', 'M100 220V420M100 360H320', 'data-pins="2" stroke="' + change + '"')}
        <g data-component="trigger-switch" data-state="normally-open" stroke="${change}"><circle cx="100" cy="420" r="4" fill="#fcfefd"/><circle cx="100" cy="470" r="4" fill="#fcfefd"/><path d="M100 466L123 430"/></g>
        ${wire('ground', 'M100 470V740')}
        ${dot(100, 80)}${dot(100, 360, change)}${dot(100, 740)}
      ` : `
        ${resistor('r2', 900, 330, 60, conversion ? 'stroke="' + remove + '"' : '')}
        ${wire('timing', 'M900 390V450')}
        ${wire('timing', 'M320 360H100V650H850V450', 'data-pins="2"' + (conversion ? ' data-change="1" stroke="' + remove + '" stroke-dasharray="7 5"' : ''))}
        ${dot(850, 450)}
        ${conversion ? '<rect x="872" y="318" width="56" height="84" rx="6" stroke="' + remove + '" stroke-dasharray="6 5"/>' : ''}
      `}
      ${dot(900, 300)}${dot(900, 450)}
    </g>
    <g font-family="system-ui,sans-serif">
      ${dip8Chip()}
      <g fill="${ink}" font-size="23">
        ${text(80, 52, 'VCC = +5 V')}${text(80, 780, 'GND')}
        ${text(530, 145, 'DIP-8 · TOP VIEW', 'text-anchor="middle"')}
        ${text(270, 342, 'GND', 'text-anchor="middle" font-size="20"')}
        ${text(250, 482, '+5 V', 'text-anchor="middle" font-size="20"')}
        ${text(220, 430, 'OUT', 'text-anchor="middle"')}
        ${text(740, 585, 'Unused', 'font-size="21"')}
        ${text(940, 198, mono ? 'R (timing)' : 'R1')}
        ${text(940, 578, 'C (timing)')}
        ${text(1140, 230, 'C_supply', 'font-size="22"')}
        ${text(1140, 260, '100 nF', 'font-size="22"')}
        ${mono ? text(140, 180, '10 kΩ', 'font-size="22"') + text(140, 208, 'Pull-up', 'font-size="21"') + text(140, 432, 'S1', 'font-size="22"') + text(140, 478, 'Brief', 'font-size="20"') + text(140, 507, 'press', 'font-size="20"') : text(940, 370, 'R2')}
        ${text(530, 705, 'Same labels = connected nets', 'text-anchor="middle" font-size="21"')}
      </g>
    </g>
    ${conversion ? (mono ? badge(865, 390, 2, change) + badge(55, 360, 3, change) : badge(530, 650, 1, remove) + badge(865, 360, 2, remove)) : ''}
  </svg>`;
}
export const astableSchematic = () => circuit('astable');
export const monostableSchematic = () => circuit('monostable');
export const conversionSchematic = (mode) => circuit(mode, true);

export function monostableWaveforms() {
  return `<svg class="monostable-waveforms" viewBox="0 0 900 420" role="img" aria-label="Example oscilloscope traces, not measured data. The TRIG input normally reads HIGH. A brief button press pulls TRIG LOW; release returns it HIGH. The OUT signal rises when TRIG falls, stays HIGH after release, then returns LOW automatically. Output pulse duration t_W is measured between its rising and falling edges at mid-level. Both traces share a time axis; vertical positions are offset and no voltage or time scale is prescribed.">
    <rect x="1" y="1" width="898" height="418" rx="12" fill="#122b35"/>
    <g fill="none" stroke="#36505a" stroke-width="1">
      ${[190, 260, 330, 400, 470, 540, 610, 680, 750, 820, 860].map((x) => `<path d="M${x} 80V355"/>`).join('')}
      ${[90, 125, 160, 195, 230, 265, 300, 335].map((y) => `<path d="M190 ${y}H860"/>`).join('')}
    </g>
    <g fill="none" stroke="#9db3bb" stroke-width="1.5" stroke-dasharray="4 6"><path d="M320 65V355M410 75V205M690 230V355"/></g>
    <path data-trace="trigger" d="M190 110H320V175H410V110H860" fill="none" stroke="#73dce9" stroke-width="3"/>
    <path data-trace="output" d="M190 335H320V260H690V335H860" fill="none" stroke="#ffe28b" stroke-width="3"/>
    <g fill="none" stroke="#ffe28b" stroke-width="1.5"><path d="M320 298H690M329 292L320 298L329 304M681 292L690 298L681 304"/><circle cx="320" cy="298" r="4" fill="#ffe28b"/><circle cx="690" cy="298" r="4" fill="#ffe28b"/></g>
    <path d="M190 370H860M853 365L860 370L853 375" fill="none" stroke="#b3c9ce" stroke-width="1.5"/>
    <g font-family="system-ui,sans-serif" font-size="18" fill="#e7f1f4">
      ${text(320, 37, 'Press', 'text-anchor="middle"')}${text(410, 62, 'Release', 'text-anchor="middle"')}
      ${text(24, 109, 'TRIG', 'fill="#73dce9" font-weight="700"')}${text(24, 134, 'Button input', 'font-size="16"')}
      ${text(176, 105, 'HIGH', 'text-anchor="end" font-size="15"')}${text(176, 180, 'LOW', 'text-anchor="end" font-size="15"')}
      ${text(24, 277, 'OUT', 'fill="#ffe28b" font-weight="700"')}${text(24, 302, 'Output pulse', 'font-size="16"')}
      ${text(176, 255, 'HIGH', 'text-anchor="end" font-size="15"')}${text(176, 340, 'LOW', 'text-anchor="end" font-size="15"')}
      ${text(505, 286, 't<tspan baseline-shift="sub" font-size="13">W</tspan>', 'text-anchor="middle" fill="#ffe28b" font-style="italic" font-size="22"')}
      ${text(860, 402, 'Time →', 'text-anchor="end"')}${text(190, 402, 'Two traces · same time axis', 'font-size="16"')}
    </g>
  </svg>`;
}
