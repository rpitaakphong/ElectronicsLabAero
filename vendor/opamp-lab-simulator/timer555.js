/* 555-specific presentation, presets, persistence boundary, and live clock.
 * The breadboard editor, generator, oscilloscope and access gate remain shared. */
(function (root) {
  'use strict';
  const E = root.Timer555Engine,
    V = root.Timer555Visuals;
  function setup() {
    document.documentElement.dataset.lab = 'timer555';
    document.title = '555 Timer Lab Simulator';
    document.querySelector('.lab-intro h1').textContent =
      '555 Timer Lab Simulator';
    document.querySelector('.lab-intro p').textContent =
      'Build an oscillator or one-shot. Connect power, trigger a pulse, and measure its timing.';
    document.querySelector('#measurementPanel > .small').textContent =
      'Virtual leads are 1X; the channel Probe setting changes indicated voltage. Adaptive captures retain solved switching edges, including narrow pulses. Mean and RMS are time-weighted. Average mode aligns captures to the selected trigger before combining them. These are simulated records, not hardware ADC samples; advanced hardware-only functions are unavailable.';
    const select = document.getElementById('presetSelect');
    select.replaceChildren(
      new Option('Blank board', 'blank'),
      new Option('Astable oscillator · 68.7 Hz', 'astable'),
      new Option('Monostable one-shot · 1.1 s', 'monostable'),
    );
    [...select.options].slice(1).forEach((o) => (o.disabled = true));
    const op = document.querySelector('[data-tool="opamp"]');
    op.dataset.tool = 'timer555';
    op.textContent = 'NE555';
    const button = document.createElement('button');
    button.dataset.tool = 'pushbutton';
    button.textContent = 'Pushbutton';
    button.setAttribute('aria-pressed', 'false');
    op.after(button);
    document.querySelector('#pinGuide summary span').textContent =
      'Circuit schematics & NE555 pin guide';
    document.getElementById('ua741Guides').innerHTML = V.guide();
    document.querySelector('.pin-reference > p').innerHTML =
      'NE555 · all eight pins have a function.<br><a href="https://www.ti.com/lit/ds/symlink/ne555.pdf" target="_blank" rel="noopener">TI pinout ↗</a>';
    const supply = document.getElementById('vplusInput');
    supply.min = '5';
    supply.max = '15';
    supply.value = '5';
    document.getElementById('vminusInput').value = '0';
    document.getElementById('vminusInput').closest('label').hidden = true;
    supply.closest('.control-group').querySelector('h3').textContent =
      'Single DC supply · 5–15 V';
    supply.closest('.control-group').querySelector('p').textContent =
      'Top red rail is VCC. Both ground rails and the bottom blue rail are 0 V. Scope and generator returns share ground.';
    const controls = document.createElement('div');
    controls.className = 'control-group timer555-live-controls';
    controls.innerHTML =
      '<h3>Timing and pushbuttons</h3><p id="timerClock" class="small" role="status">Simulation clock: 0 s</p><button id="timerPulseBtn">Pulse selected button</button><button id="timerHoldBtn" aria-pressed="false">Hold selected button</button><button id="timerRestartBtn">Power cycle / restart timing</button><p class="small">Select a pushbutton in Parts and leads. Pulse closes it for 10 ms. Hold keeps it closed until released. Editing circuit connections restarts timing; scope controls preserve it.</p>';
    document.querySelector('.circuit-controls').append(controls);
    document.querySelector('.learning-section').innerHTML =
      '<h2>4. 555 timer model and experiments</h2><div class="learning-grid"><div><h3>Build and measure</h3><p>Construct either reference circuit using the NE555, resistors, capacitors, and a normally open two-terminal pushbutton. CH1 measures pin 3 output; CH2 measures the timing capacitor at pin 6. Grounds connect to the supply return.</p><p>Astable: change R2 or C and measure high/low times, frequency, and duty cycle. Monostable: arm Single, then pulse the trigger button and measure +Width. A lone pulse has no repeating frequency or duty cycle.</p></div><div><h3>Model notes</h3><p>Nominal 5 kΩ internal divider, comparator/latch/reset behavior, 1 Ω discharge switch, and approximate 50 Ω output drive (VCC − 1.2 V high, 0.1 V low). Pin 5 controls the comparison thresholds. No switch bounce, temperature, component tolerance, or transistor-level effects. All waveforms and measurements are simulated.</p><p>The circuit clock continues while the scope is stopped or powered off. Scope scales and menus never trigger the circuit. Save/Recall preserves construction and instrument settings, but starts a new timing run with buttons released.</p></div></div>';
    document.querySelector('.challenge-score').hidden = true;
    document.querySelector('[for="challengeMode"]')?.remove();
    document.getElementById('challengeMode')?.closest('label')?.remove();
    const schematic = document.getElementById('schematicSelect');
    schematic.replaceChildren(
      new Option('Astable oscillator', 'astable'),
      new Option('Monostable one-shot', 'monostable'),
    );
    const render = () => {
      const mode = schematic.value;
      document.getElementById('schematicDiagram').innerHTML = V.schematic({
        mode,
        r1: mode === 'astable' ? 1000 : 100000,
        r2: 10000,
        c: mode === 'astable' ? 1e-6 : 10e-6,
        vcc: 5,
      });
      document.getElementById('schematicDescription').textContent =
        mode === 'astable'
          ? 'R1 = 1 kΩ, R2 = 10 kΩ, C = 1 µF: nominal 68.7 Hz, 52.38% duty. Reset is pulled high; pin 5 uses a 10 nF bypass and the supply uses 100 nF.'
          : 'R = 100 kΩ, C = 10 µF: nominal 1.099 s pulse. Pull TRIG high through 10 kΩ and use a normally open pushbutton to ground. A long held-low trigger can extend the output.';
    };
    schematic.onchange = render;
    render();
  }
  function layout(mode) {
    const parts = [
      ['wire', 'A:14', 'VPLUS:14', '#bb4d54'],
      ['wire', 'J:14', 'GND_BOTTOM:14', '#586d71'],
      ['resistor', 'J:17', 'VPLUS:17', 10000],
      ['capacitor', 'A:17', 'GND_TOP:17', 10e-9],
      ['capacitor', 'VPLUS:27', 'GND_TOP:27', 100e-9],
      ['capacitor', 'A:16', 'GND_TOP:16', mode === 'astable' ? 1e-6 : 10e-6],
      ['resistor', 'VPLUS:10', 'A:15', mode === 'astable' ? 1000 : 100000],
    ];
    if (mode === 'astable')
      parts.push(
        ['resistor', 'B:15', 'B:16', 10000],
        ['wire', 'I:15', 'C:16', '#569bab'],
      );
    else
      parts.push(
        ['wire', 'B:15', 'B:16', '#569bab'],
        ['resistor', 'I:15', 'VPLUS:21', 10000],
        ['pushbutton', 'H:15', 'GND_BOTTOM:21', null],
      );
    return {
      startCol: 14,
      parts,
      leads: {
        ch1tip: 'J:16',
        ch1gnd: 'GND_BOTTOM:5',
        ch2tip: 'D:16',
        ch2gnd: 'GND_BOTTOM:6',
      },
    };
  }
  function validate(data, prepareLayout, validateScope) {
    const object = (v) => v && typeof v === 'object' && !Array.isArray(v),
      range = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
    const node = (n) =>
      typeof n === 'string' &&
      (['GND', 'VPLUS', 'VMINUS'].includes(n) ||
        /^[TB]:([1-9]|[12][0-9]|30)$/.test(n));
    const hole = (h) =>
      object(h) &&
      ['VPLUS', 'VMINUS', 'GND_TOP', 'GND_BOTTOM', ...'ABCDEFGHIJ'].includes(
        h.row,
      ) &&
      Number.isInteger(h.col) &&
      range(h.col, 1, 30);
    if (
      !object(data) ||
      data.lab !== 'timer555' ||
      data.version !== 1 ||
      !object(data.state) ||
      !object(data.scope)
    )
      throw new Error('Unsupported 555 timer save.');
    const s = structuredClone(data.state),
      g = s.generator;
    if (
      !Array.isArray(s.components) ||
      s.components.length > 64 ||
      !object(s.supply) ||
      !range(s.supply.plus, 5, 15) ||
      s.supply.minus !== 0 ||
      !object(s.probes) ||
      !object(g) ||
      !object(s.leadHoles)
    )
      throw new Error('Invalid 555 circuit or instruments.');
    if (
      !['sine', 'square', 'triangle'].includes(g.waveform) ||
      !range(g.frequency, 0.1, g.waveform === 'triangle' ? 1e6 : 3e6) ||
      !range(g.amplitude, 0.2, 10) ||
      !range(g.offset, -10, 10) ||
      !range(g.duty, 25, 75)
    )
      throw new Error('Invalid generator setting.');
    for (const key of [
      'powered',
      'output',
      'ttl',
      'attenuated',
      'dutyEnabled',
      'offsetEnabled',
      'termination',
    ])
      if (typeof g[key] !== 'boolean')
        throw new Error('Invalid generator switch.');
    const ids = new Set();
    for (const c of s.components) {
      if (
        !object(c) ||
        !['timer555', 'wire', 'resistor', 'capacitor', 'pushbutton'].includes(
          c.type,
        ) ||
        typeof c.id !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9]*$/.test(c.id) ||
        ids.has(c.id)
      )
        throw new Error('Invalid or duplicate component.');
      ids.add(c.id);
      if (c.type === 'timer555') {
        if (
          !Number.isInteger(c.startCol) ||
          !range(c.startCol, 1, 27) ||
          c.pins
        )
          throw new Error('Invalid NE555 position.');
      } else if (
        !node(c.a) ||
        !node(c.b) ||
        !hole(c.aHole) ||
        !hole(c.bHole) ||
        (c.type === 'resistor' && !range(c.value, 1000, 1e6)) ||
        (c.type === 'capacitor' && !range(c.value, 1e-9, 100e-6)) ||
        (c.type === 'wire' && !/^#[0-9a-f]{6}$/i.test(c.color))
      )
        throw new Error('Invalid component value or position.');
    }
    if (s.components.filter((c) => c.type === 'timer555').length > 1)
      throw new Error('Use one NE555 per circuit.');
    const leads = {
      generator: s.generatorNode,
      gengnd: g.groundNode,
      genttl: g.ttlNode,
    };
    for (const ch of ['ch1', 'ch2']) {
      if (!object(s.probes[ch])) throw new Error('Invalid probes.');
      for (const end of ['tip', 'gnd']) leads[ch + end] = s.probes[ch][end];
    }
    for (const [key, n] of Object.entries(leads))
      if (n !== null && (!node(n) || !hole(s.leadHoles[key])))
        throw new Error('Invalid instrument lead.');
    for (const [key, h] of Object.entries(s.leadHoles))
      if (!(key in leads) || !hole(h))
        throw new Error('Invalid lead position.');
    validateScope(data.scope);
    const board = prepareLayout(s, false).board;
    return {
      envelope: {
        lab: 'timer555',
        version: 1,
        state: board,
        scope: {
          ...data.scope,
          frozenRecord: null,
          frozenFrame: null,
          running: true,
          singleArmed: false,
        },
      },
      converted: false,
      relocated: 0,
    };
  }
  function createRuntime({
    state,
    boardSnapshot,
    toast,
    getScope,
    render,
    drawBoard,
  }) {
    let session = null,
      signature = '',
      lastNow = performance.now(),
      armedAt = 0,
      heldId = null,
      stopped = false;
    function sync() {
      const key = boardSnapshot();
      if (key !== signature) {
        const candidate = E.create(JSON.parse(key), {
          sourceAt: (t, port) => SFG1013.voltage(state.generator, t, port),
        });
        signature = key;
        session = candidate;
        lastNow = performance.now();
        heldId = null;
        document
          .getElementById('timerHoldBtn')
          .setAttribute('aria-pressed', 'false');
        armedAt = session.time;
      }
    }
    function advance() {
      sync();
      const now = performance.now(),
        delta = Math.min((now - lastNow) / 1000, 2);
      lastNow = now;
      session.advance(session.time + Math.max(0, delta));
      document.getElementById('timerClock').textContent =
        `Simulation clock: ${session.time.toFixed(3)} s · output ${session.high ? 'HIGH' : 'LOW'}`;
      return session;
    }
    function acquire() {
      const s = advance(),
        window = getScope().horizontal.timeDiv * 10;
      const duration = Math.max(window * 2.4, s.period ? s.period * 6 : 0.05),
        start = Math.max(0, s.time - duration),
        end = Math.max(s.time, 1e-9);
      const samples = Math.min(
        12000,
        Math.max(
          2400,
          Math.ceil(((end - start) / (s.period || duration)) * 200),
        ),
      );
      if (s.period && duration / s.period > 500)
        throw new Error(
          'Too many cycles in this time window. Reduce TIME/DIV or press Autoset.',
        );
      const record = s.record(start, end, samples);
      record.window = window;
      record.armedAt = armedAt;
      return record;
    }
    function autoRecord() {
      const s = advance(),
        events = s.events.filter((e) => e.type === 'output');
      const rise = events.findLast((e) => e.high),
        fall = events.findLast(
          (e) => !e.high && e.time > (rise?.time ?? Infinity),
        );
      const width = rise && fall ? fall.time - rise.time : null;
      if (!s.period && !width)
        throw new Error(
          'Wait for two oscillator cycles, or trigger and complete a one-shot pulse, then press Autoset.',
        );
      const span = s.period ? s.period * 6 : width * 3,
        start = s.period
          ? Math.max(0, s.time - span)
          : Math.max(0, rise.time - width),
        end = s.period ? s.time : Math.min(s.time, fall.time + width);
      return {
        ...s.record(start, end, 6000),
        timing: s.period || width,
        periodic: !!s.period,
      };
    }
    function selectedButton() {
      const p = state.components.find(
        (c) => c.id === state.selectedId && c.type === 'pushbutton',
      );
      if (!p) throw new Error('Select a pushbutton in Parts and leads first.');
      return p;
    }
    function buttonAction(hold) {
      try {
        const p = selectedButton(),
          s = advance();
        s.cancelButtonEvents(p.id);
        if (heldId && heldId !== p.id) s.setButton(heldId, false);
        if (hold) {
          const closed = heldId !== p.id;
          s.setButton(p.id, closed);
          heldId = closed ? p.id : null;
        } else {
          s.setButton(p.id, true);
          s.scheduleButton(p.id, false, s.time + 0.01);
          heldId = null;
        }
        document
          .getElementById('timerHoldBtn')
          .setAttribute('aria-pressed', String(!!heldId));
        drawBoard();
        render();
      } catch (e) {
        toast(e.message, 3500);
      }
    }
    document.getElementById('timerPulseBtn').onclick = () =>
      buttonAction(false);
    document.getElementById('timerHoldBtn').onclick = () => buttonAction(true);
    document.getElementById('timerRestartBtn').onclick = () => {
      signature = '';
      try {
        sync();
        drawBoard();
        render();
        toast('Timing restarted; all pushbuttons released.');
      } catch (e) {
        toast(e.message);
      }
    };
    const timer = setInterval(() => {
      if (stopped || document.hidden) {
        lastNow = performance.now();
        return;
      }
      try {
        advance();
        render();
      } catch (e) {
        state.sim.error = e.message;
        document.getElementById('timerClock').textContent = e.message;
      }
    }, 120);
    window.addEventListener(
      'pagehide',
      () => {
        stopped = true;
        clearInterval(timer);
      },
      { once: true },
    );
    return {
      acquire,
      autoRecord,
      restart() {
        signature = '';
      },
      arm() {
        advance();
        armedAt = session.time;
      },
      get armedAt() {
        return armedAt;
      },
      get session() {
        return session;
      },
      get heldId() {
        return heldId;
      },
    };
  }
  root.Timer555Profile = { layout, validate };
  root.Timer555Runtime = { create: createRuntime };
  setup();
})(globalThis);
