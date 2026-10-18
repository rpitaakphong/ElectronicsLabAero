/* Workbook-only vector drawings. Pin positions are functional, not a DIP layout.
 * Keep trigger and timing nets separate in every monostable view. No timing
 * component answers are supplied here; students select R and C themselves. */
const ink = '#254e5b', change = '#087f85', remove = '#b65b24';
const text = (x, y, label, extra = '') => `<text x="${x}" y="${y}" ${extra}>${label}</text>`;
const wire = (net, path, extra = '') => `<path data-wire-net="${net}" d="${path}" ${extra}/>`;
const dot = (x, y, color = ink) => `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="none"/>`;
const resistor = (id, x, top, height, extra = '') => `<rect data-component="${id}" x="${x - 15}" y="${top}" width="30" height="${height}" rx="2" fill="#fcfefd" ${extra}/>`;
const capacitor = (id, x, y) => `<path data-component="${id}" d="M${x - 22} ${y}h44m-44 12h44"/>`;
const badge = (x, y, number, color) => `<g aria-hidden="true"><circle cx="${x}" cy="${y}" r="15" fill="${color}" stroke="none"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">${number}</text></g>`;

export function monostableSchematic() {
  return `<svg class="monostable-schematic" viewBox="0 0 1000 640" role="img" aria-label="Complete 555 monostable schematic. Timing resistor R connects VCC to the timing node shared by pins 6 and 7. Timing capacitor C connects that node to ground. Pin 2 TRIG is separate, pulled up to VCC through 10 kiloohms, with a normally-open pushbutton to ground. Pins 8 and 4 connect to VCC; pin 1 connects to ground. Pin 5 has a 10 nanofarad bypass; the supply has a 100 nanofarad bypass. Output is pin 3.">
    <g fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <rect x="470" y="180" width="210" height="290" rx="10" fill="#edf5f4"/>
      ${wire('vcc', 'M80 60H940M210 60V120M520 60V180M580 60V180M790 60V120M940 60V330')}
      ${wire('timing', 'M210 180V425M210 245H470M210 300H470', 'data-pins="6 7"')}
      ${wire('trigger', 'M790 180V424M680 380H790', 'data-pins="2" stroke="#087f85"')}
      ${wire('ground', 'M80 570H940M210 437V570M545 470V570M635 512V570M790 472V570M940 342V570')}
      ${wire('control', 'M635 470V500', 'data-pins="5"')}
      ${wire('output', 'M680 245H745', 'data-pins="3"')}
      ${resistor('timing-r', 210, 120, 60)}
      ${resistor('trigger-pullup', 790, 120, 60, 'stroke="#087f85"')}
      ${capacitor('timing-c', 210, 425)}
      ${capacitor('control-bypass', 635, 500)}
      ${capacitor('supply-bypass', 940, 330)}
      <g data-component="trigger-switch" data-state="normally-open" stroke="#087f85">
        <circle cx="790" cy="424" r="4" fill="#fcfefd"/><circle cx="790" cy="472" r="4" fill="#fcfefd"/>
        <path d="M790 468L813 435"/>
      </g>
      ${dot(210, 245)}${dot(210, 300)}${dot(790, 380, change)}
      ${dot(520, 60)}${dot(580, 60)}${dot(790, 60)}
    </g>
    <g fill="${ink}" font-family="system-ui,sans-serif" font-size="18">
      ${text(80, 38, 'VCC = +5 V')}${text(80, 608, 'GND · common supply return and oscilloscope grounds')}
      ${text(170, 150, 'R (timing)', 'text-anchor="end"')}
      ${text(245, 447, 'C (timing)')}
      ${text(485, 250, '7 DISCH')}${text(485, 305, '6 THRES')}
      ${text(663, 385, '2 TRIG', 'text-anchor="end" fill="#087f85"')}
      ${text(520, 203, '4', 'text-anchor="middle" font-size="16"')}${text(520, 224, 'RESET', 'text-anchor="middle" font-size="15"')}
      ${text(580, 203, '8', 'text-anchor="middle" font-size="16"')}${text(580, 224, 'VCC', 'text-anchor="middle" font-size="15"')}
      ${text(575, 345, 'NE555', 'text-anchor="middle" font-size="28"')}
      ${text(545, 455, '1 GND', 'text-anchor="middle" font-size="16"')}
      ${text(635, 455, '5 CONT', 'text-anchor="middle" font-size="16"')}
      ${text(663, 240, '3 OUT', 'text-anchor="end"')}${text(695, 280, 'CH1: OUT', 'font-size="16"')}
      ${text(820, 145, '10 kΩ')}${text(820, 170, 'pull-up', 'font-size="16"')}
      ${text(820, 442, 'S1')}${text(820, 467, 'Normally-open', 'font-size="16"')}${text(820, 490, 'pushbutton', 'font-size="16"')}
      ${text(670, 512, '10 nF')}${text(900, 340, '100 nF', 'text-anchor="end"')}
    </g>
  </svg>`;
}
export function conversionSchematic(mode) {
  const mono = mode === 'monostable';
  const label = mono
    ? 'After: monostable timing connections. Pins 6 and 7 share the timing capacitor node; R2 is replaced by a wire. Pin 2 is independent, connected to a 10 kiloohm pull-up and normally-open switch. R and C are selected for the required pulse.'
    : 'Before: astable timing connections. Pins 2 and 6 share the timing capacitor node. Orange numbered highlights show the pin 2 link to disconnect and R2 to remove. R1 and R2 set the repeating timing.';
  return `<svg class="conversion-schematic" data-conversion-mode="${mode}" viewBox="0 0 600 470" role="img" aria-label="${label}">
    <g fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <rect x="280" y="100" width="190" height="240" rx="10" fill="#edf5f4"/>
      ${wire('vcc', `M60 45H550M100 45V80${mono ? 'M530 45V80' : ''}`)}
      ${wire('ground', `M60 430H560M100 362V430${mono ? 'M530 398V430' : ''}`)}
      ${wire('timing', 'M100 300H220V260H280M100 300V350', 'data-pins="6"')}
      ${wire('output', 'M470 180H500', 'data-pins="3"')}
      ${resistor(mono ? 'timing-r' : 'r1', 100, 80, 50)}
      ${capacitor('timing-c', 100, 350)}
      ${mono ? `
        ${wire('timing', 'M100 130V300M100 180H280', 'data-pins="7"')}
        ${wire('timing', 'M100 180V300', 'stroke="#087f85" stroke-width="4" data-change="2"')}
        ${wire('trigger', 'M530 130V350M470 300H530', 'data-pins="2" stroke="#087f85"')}
        ${resistor('trigger-pullup', 530, 80, 50, 'stroke="#087f85"')}
        <g data-component="trigger-switch" data-state="normally-open" stroke="#087f85"><circle cx="530" cy="350" r="3"/><circle cx="530" cy="398" r="3"/><path d="M530 395L548 362"/></g>
        ${dot(530, 300, change)}
      ` : `
        ${wire('discharge', 'M100 130V215M100 180H280', 'data-pins="7"')}
        ${resistor('r2', 100, 215, 50, 'stroke="#b65b24"')}
        ${wire('timing', 'M100 265V300')}
        ${wire('timing', 'M180 300V385H515V300H470', 'data-pins="2" data-change="1" stroke="#b65b24" stroke-dasharray="6 5"')}
        <rect x="74" y="203" width="52" height="74" rx="6" stroke="#b65b24" stroke-dasharray="5 5"/>
        ${dot(180, 300)}
      `}
      ${dot(100, 180)}${dot(100, 300)}
    </g>
    <g fill="${ink}" font-family="system-ui,sans-serif" font-size="18">
      ${text(60, 30, 'VCC')}${text(60, 457, 'GND')}
      ${text(70, 110, mono ? 'R' : 'R1', 'text-anchor="end"')}${text(133, 373, 'C')}
      ${text(295, 185, '7 DISCH')}${text(295, 265, '6 THRES')}
      ${text(455, 305, '2 TRIG', 'text-anchor="end"')}${text(480, 207, 'OUT', 'font-size="16"')}
      ${text(375, 140, 'NE555', 'text-anchor="middle" font-size="23"')}
      ${mono ? text(493, 73, '10 kΩ', 'text-anchor="end" font-size="16"') + text(547, 332, 'S1', 'font-size="16"') + text(375, 385, 'Pin 2 is separate', 'text-anchor="middle" fill="#087f85" font-size="16"') : text(140, 247, 'R2', 'fill="#b65b24"')}
    </g>
    ${mono ? badge(45, 240, 2, change) + badge(562, 300, 3, change) : badge(340, 385, 1, remove) + badge(45, 240, 2, remove)}
  </svg>`;
}

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
