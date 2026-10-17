/* Shared NE555 teaching model. Actual RC netlist, persistent clock, adaptive
 * backward-Euler integration, and an event-driven comparator/latch. SI units. */
(function (root) {
  'use strict';
  const { UnionFind, gaussianSolve } = root.CircuitEngine;
  const pinNames = {
    1: 'GND',
    2: 'TRIG',
    3: 'OUT',
    4: 'RESET',
    5: 'CONT',
    6: 'THRES',
    7: 'DISCH',
    8: 'VCC',
  };
  const nodes = (ic) =>
    ic.pins || {
      1: `B:${ic.startCol}`,
      2: `B:${ic.startCol + 1}`,
      3: `B:${ic.startCol + 2}`,
      4: `B:${ic.startCol + 3}`,
      5: `T:${ic.startCol + 3}`,
      6: `T:${ic.startCol + 2}`,
      7: `T:${ic.startCol + 1}`,
      8: `T:${ic.startCol}`,
    };
  const holes = (ic) =>
    Object.entries(nodes(ic)).map(([pin]) => ({
      pin: Number(pin),
      function: pinNames[pin],
      hole: {
        row: Number(pin) <= 4 ? 'F' : 'E',
        col:
          ic.startCol + (Number(pin) <= 4 ? Number(pin) - 1 : 8 - Number(pin)),
      },
    }));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function transition(high, { supply, reset, trigger, threshold, control }) {
    if (supply < 4.5 || supply > 16 || reset < 0.7) return false;
    if (trigger < control / 2) return true;
    if (threshold > control) return false;
    return high;
  }
  function predictions({ mode, r1, r2, c }) {
    if (
      !['astable', 'monostable'].includes(mode) ||
      ![r1, c, ...(mode === 'astable' ? [r2] : [])].every(
        (v) => Number.isFinite(v) && v > 0,
      )
    )
      throw new Error('Use positive finite timing components.');
    const high =
      mode === 'astable' ? Math.LN2 * (r1 + r2) * c : Math.log(3) * r1 * c;
    const low = mode === 'astable' ? Math.LN2 * r2 * c : null;
    return {
      high,
      low,
      period: low === null ? null : high + low,
      frequency: low === null ? null : 1 / (high + low),
      duty: low === null ? null : (100 * high) / (high + low),
    };
  }
  function canonical(config) {
    const { mode, r1, r2, c, vcc } = config;
    predictions(config);
    const parts = [
      {
        id: 'U1',
        type: 'timer555',
        pins: {
          1: 'GND',
          2: 'TRIG',
          3: 'OUT',
          4: 'RESET',
          5: 'CONT',
          6: 'CAP',
          7: 'DISCH',
          8: 'VPLUS',
        },
      },
    ];
    const add = (id, type, a, b, value) =>
      parts.push({ id, type, a, b, ...(value == null ? {} : { value }) });
    add('Wground', 'wire', 'VMINUS', 'GND');
    add('Rreset', 'resistor', 'VPLUS', 'RESET', 10000);
    add('Sreset', 'pushbutton', 'RESET', 'GND');
    add('Ccontrol', 'capacitor', 'CONT', 'GND', 10e-9);
    add('Cbypass', 'capacitor', 'VPLUS', 'GND', 100e-9);
    add('Ctiming', 'capacitor', 'CAP', 'GND', c);
    add('R1', 'resistor', 'VPLUS', 'DISCH', r1);
    if (mode === 'astable') {
      add('R2', 'resistor', 'DISCH', 'CAP', r2);
      add('Wtrigger', 'wire', 'TRIG', 'CAP');
    } else {
      add('Wtiming', 'wire', 'DISCH', 'CAP');
      add('Rpullup', 'resistor', 'VPLUS', 'TRIG', 10000);
      add('S1', 'pushbutton', 'TRIG', 'GND');
    }
    return {
      components: parts,
      supply: { plus: vcc, minus: 0 },
      generator: { output: false, ttl: false },
      generatorNode: null,
      probes: {
        ch1: { tip: 'OUT', gnd: 'GND' },
        ch2: { tip: 'CAP', gnd: 'GND' },
      },
    };
  }
  function prepare(state) {
    const uf = new UnionFind(),
      plain = new UnionFind(),
      warnings = [];
    uf.union('GND', '0');
    plain.union('GND', '0');
    for (const c of state.components) {
      if (c.type === 'timer555')
        Object.values(nodes(c)).forEach((n) => {
          uf.add(n);
          plain.add(n);
        });
      else {
        uf.add(c.a);
        uf.add(c.b);
        plain.add(c.a);
        plain.add(c.b);
        if (c.type === 'wire') {
          uf.union(c.a, c.b);
          plain.union(c.a, c.b);
        }
      }
    }
    const grounds = [
      state.generator.groundNode,
      ...['ch1', 'ch2'].map((ch) => state.probes[ch].gnd),
    ].filter(Boolean);
    for (const g of grounds) {
      if (plain.find(g) !== plain.find('GND'))
        warnings.push(
          'Instrument ground joins this breadboard net to the supply return. Check common ground clips.',
        );
      uf.union(g, 'GND');
    }
    const r = (n) => uf.find(n),
      ground = r('GND'),
      positive = r('VPLUS'),
      negative = r('VMINUS');
    const voltage = state.supply.plus;
    if (!Number.isFinite(voltage) || voltage < 5 || voltage > 15)
      throw new Error('Set the 555 supply between 5 and 15 V.');
    if (positive === ground || positive === negative)
      throw new Error(
        'The positive supply is shorted to ground. Remove the short.',
      );
    const ics = state.components.filter((c) => c.type === 'timer555');
    if (ics.length > 1)
      throw new Error('This lab supports one NE555 per circuit.');
    const ic = ics[0],
      pins = ic
        ? Object.fromEntries(
            Object.entries(nodes(ic)).map(([p, n]) => [p, r(n)]),
          )
        : null;
    if (!ic) warnings.push('Place an NE555 across the breadboard center gap.');
    const parts = state.components
      .filter((c) => !['wire', 'timer555'].includes(c.type))
      .map((c) => ({ ...c, a: r(c.a), b: r(c.b) }));
    if (parts.length > 48)
      throw new Error(
        'Use at most 48 passive components in this teaching model.',
      );
    for (const c of parts) {
      if (!['resistor', 'capacitor', 'pushbutton'].includes(c.type))
        throw new Error('Unsupported 555 component.');
      if (c.a === c.b)
        warnings.push(
          `${c.id}: both terminals share one net; this component is bypassed.`,
        );
      if (
        c.type !== 'pushbutton' &&
        (!Number.isFinite(c.value) || c.value <= 0)
      )
        throw new Error('Use positive finite component values.');
    }
    const powered = !!pins && pins[8] === positive && pins[1] === ground;
    if (pins) {
      if (pins[8] !== positive)
        warnings.push('NE555 pin 8 (VCC) must connect to the positive supply.');
      if (pins[1] !== ground)
        warnings.push('NE555 pin 1 (GND) must connect to the supply return.');
    }
    const active =
      state.generator.powered &&
      state.generator.output &&
      state.generator.groundNode;
    const source =
      active && state.generatorNode ? r(state.generatorNode) : null;
    const ttl =
      active && state.generator.ttl && state.generator.ttlNode
        ? r(state.generator.ttlNode)
        : null;
    const connected = new UnionFind();
    connected.add(ground);
    connected.union(positive, ground);
    connected.union(negative, ground);
    for (const p of parts)
      if (p.type !== 'pushbutton') connected.union(p.a, p.b);
    if (pins && powered) {
      connected.union(pins[5], ground);
      connected.union(pins[3], ground);
    }
    if (source) connected.union(source, ground);
    if (ttl) connected.union(ttl, ground);
    const hasReturn = (n) => connected.find(n) === connected.find(ground);
    if (pins && powered) {
      for (const pin of [2, 4, 6])
        if (!hasReturn(pins[pin]))
          warnings.push(
            `NE555 pin ${pin} (${pinNames[pin]}) is floating. Connect it before measuring.`,
          );
      if (pins[7] === positive)
        warnings.push(
          'Pin 7 (DISCH) is wired directly to VCC. Add the timing resistor.',
        );
    }
    const status = {};
    for (const ch of ['ch1', 'ch2']) {
      const p = state.probes[ch];
      status[ch] = !p.tip
        ? 'Probe tip disconnected'
        : !p.gnd
          ? 'Probe ground disconnected'
          : !hasReturn(r(p.tip))
            ? 'Probe is on a floating network'
            : null;
    }
    if (ttl === ground)
      throw new Error('TTL is shorted to ground. Move its lead.');
    const all = new Set([
      ground,
      positive,
      negative,
      ...parts.flatMap((p) => [p.a, p.b]),
      ...Object.values(pins || {}),
      ...(source ? [source] : []),
      ...(ttl ? [ttl] : []),
    ]);
    if (all.size > 40)
      throw new Error('Use at most 40 electrical nets in this teaching model.');
    return {
      uf,
      r,
      ground,
      positive,
      negative,
      voltage,
      parts,
      pins,
      powered,
      warnings,
      channelStatus: status,
      all: [...all],
      source,
      ttl,
    };
  }
  function create(state, { sourceAt = () => 0 } = {}) {
    const net = prepare(state),
      { ground, positive, negative, parts, pins, voltage } = net;
    const caps = parts.filter((p) => p.type === 'capacitor' && p.a !== p.b),
      switches = new Map(
        parts.filter((p) => p.type === 'pushbutton').map((p) => [p.id, false]),
      );
    const fixed = new Map([
      [ground, 0],
      [positive, voltage],
      [negative, 0],
    ]);
    const unknown = net.all.filter((n) => !fixed.has(n)),
      ni = new Map(unknown.map((n, i) => [n, i]));
    let time = 0,
      high = false,
      capVolt = caps.map((c) =>
        fixed.has(c.a) && fixed.has(c.b)
          ? fixed.get(c.a) - fixed.get(c.b)
          : pins && c.a === pins[5] && c.b === ground
            ? (2 * voltage) / 3
            : 0,
      ),
      dt = 1e-6;
    let values = {},
      points = [],
      events = [],
      pending = [],
      cycle = null,
      cycles = [],
      rises = [],
      steps = 0;
    const value = (v, n) => (fixed.has(n) ? fixed.get(n) : (v[n] ?? 0));
    function solve(h, step, previous, t) {
      const n = unknown.length,
        A = Array.from({ length: n }, () => Array(n).fill(0)),
        rhs = Array(n).fill(0);
      // Floating nodes are diagnosed separately and never displayed as valid channels.
      for (let i = 0; i < n; i++) A[i][i] = 1e-13;
      function conduct(a, b, g, v = 0) {
        const ai = ni.get(a),
          bi = ni.get(b);
        if (ai !== undefined) {
          A[ai][ai] += g;
          if (bi !== undefined) A[ai][bi] -= g;
          else rhs[ai] += g * fixed.get(b);
          rhs[ai] += g * v;
        }
        if (bi !== undefined) {
          A[bi][bi] += g;
          if (ai !== undefined) A[bi][ai] -= g;
          else rhs[bi] += g * fixed.get(a);
          rhs[bi] -= g * v;
        }
      }
      for (const p of parts) {
        if (p.type === 'resistor') conduct(p.a, p.b, 1 / p.value);
        else if (p.type === 'pushbutton' && switches.get(p.id))
          conduct(p.a, p.b, 1 / 10);
      }
      caps.forEach((c, i) => conduct(c.a, c.b, c.value / step, previous[i]));
      if (net.powered) {
        conduct(pins[5], positive, 1 / 5000);
        conduct(pins[5], ground, 1 / 10000);
        conduct(pins[3], ground, 1 / 50, h ? Math.max(0, voltage - 1.2) : 0.1);
        if (!h) conduct(pins[7], ground, 1);
      }
      if (net.source) conduct(net.source, ground, 1 / 50, sourceAt(t, 'main'));
      if (net.ttl) conduct(net.ttl, ground, 1 / 1, sourceAt(t, 'ttl'));
      if (net.source && state.generator.termination)
        conduct(net.source, ground, 1 / 50);
      const solved = n ? gaussianSolve(A, rhs) : [],
        v = Object.fromEntries([
          ...fixed,
          ...unknown.map((node, i) => [node, solved[i]]),
        ]);
      return { v, c: caps.map((c) => value(v, c.a) - value(v, c.b)) };
    }
    function nextHigh(v) {
      return !net.powered
        ? false
        : transition(high, {
            supply: voltage,
            reset: value(v, pins[4]),
            trigger: value(v, pins[2]),
            threshold: value(v, pins[6]),
            control: value(v, pins[5]),
          });
    }
    function append(t, v, h) {
      points.push({ t, values: { ...v }, high: h });
      if (points.length > 60000) points.splice(0, 15000);
    }
    function settle() {
      let s = solve(high, 1e-12, capVolt, time);
      for (let pass = 0; pass < 3; pass++) {
        const h = nextHigh(s.v);
        if (h === high) break;
        high = h;
        events.push({ time, type: 'output', high });
        s = solve(high, 1e-12, capVolt, time);
      }
      values = s.v;
      append(time, values, high);
    }
    settle();
    function sampleList(list, t) {
      if (t <= list[0].t) return list[0];
      if (t >= list.at(-1).t) return list.at(-1);
      let lo = 0,
        hi = list.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (list[m].t <= t) lo = m;
        else hi = m;
      }
      const a = list[lo],
        b = list[hi],
        f = (t - a.t) / (b.t - a.t || 1);
      return {
        t,
        high: a.high,
        values: Object.fromEntries(
          Object.keys(a.values).map((n) => [
            n,
            a.values[n] + (b.values[n] - a.values[n]) * f,
          ]),
        ),
      };
    }
    function sample(t) {
      const segment = [...cycles]
        .reverse()
        .find((s) => t >= s.start && t <= s.end);
      if (segment) {
        const phase =
          segment.start +
          ((((t - segment.start) % segment.period) + segment.period) %
            segment.period);
        return { ...sampleList(segment.points, phase), t };
      }
      if (t < points[0].t - 1e-9)
        throw new Error(
          'This acquisition is older than the retained record. Restart acquisition.',
        );
      return sampleList(points, t);
    }
    function invalidateCycle() {
      if (cycle) {
        cycle.end = time;
        cycle = null;
      }
      rises = [];
    }
    function setButton(id, closed) {
      if (!switches.has(id))
        throw new Error('Select a connected pushbutton first.');
      if (switches.get(id) === closed) return;
      invalidateCycle();
      switches.set(id, closed);
      settle();
      events.push({ time, type: 'switch', id, closed });
    }
    function scheduleButton(id, closed, t) {
      if (!switches.has(id) || !Number.isFinite(t) || t < time)
        throw new Error('Invalid switch event.');
      pending.push({ id, closed, t });
      pending.sort((a, b) => a.t - b.t);
    }
    function cancelButtonEvents(id) {
      pending = pending.filter((e) => e.id !== id);
    }
    function advance(target) {
      if (!Number.isFinite(target) || target < time)
        throw new Error('Simulation time must move forward.');
      let budget = 0;
      while (time < target - 1e-13) {
        if (++budget > 40000)
          throw new Error(
            'This circuit needs more calculation time. Reduce frequency or restart with a shorter time window.',
          );
        if (pending[0] && pending[0].t <= time + 1e-12) {
          const e = pending.shift();
          setButton(e.id, e.closed);
          continue;
        }
        const boundary = Math.min(target, pending[0]?.t ?? Infinity);
        if (cycle) {
          const p = sample(boundary);
          time = boundary;
          values = p.values;
          high = p.high;
          capVolt = caps.map((c) => value(values, c.a) - value(values, c.b));
          append(time, values, high);
          continue;
        }
        let h = Math.min(
            dt,
            boundary - time,
            net.source || net.ttl ? 1 / (state.generator.frequency * 100) : 1,
          ),
          accepted;
        for (let attempt = 0; attempt < 25; attempt++) {
          const full = solve(high, h, capVolt, time + h),
            half = solve(high, h / 2, capVolt, time + h / 2),
            fine = solve(high, h / 2, half.c, time + h);
          const error = Math.max(
            0,
            ...fine.c.map(
              (v, i) =>
                Math.abs(v - full.c[i]) /
                (2e-6 * voltage +
                  2e-4 * Math.max(Math.abs(v), Math.abs(capVolt[i]))),
            ),
          );
          const corrected = {
            c: fine.c.map((v, i) => 2 * v - full.c[i]),
            v: Object.fromEntries(
              Object.entries(fine.v).map(([n, v]) => [n, 2 * v - full.v[n]]),
            ),
          };
          if (error <= 1 || h < 1e-12) {
            // Locate switching crossings instead of quantizing them to a sample.
            if (net.powered && nextHigh(corrected.v) !== high && h > 1e-12) {
              const distance = (v) =>
                value(v, pins[4]) < 0.7
                  ? value(v, pins[4]) - 0.7
                  : high
                    ? value(v, pins[6]) - value(v, pins[5])
                    : value(v, pins[2]) - value(v, pins[5]) / 2;
              const a = distance(values),
                b = distance(corrected.v),
                fraction = -a / (b - a);
              if (
                fraction > 0 &&
                fraction < 0.99999 &&
                Math.abs(b) > voltage * 1e-8
              ) {
                h *= clamp(fraction * 1.000001, 0.01, 0.99999);
                continue;
              }
            }
            accepted = corrected;
            dt = Math.min(
              1,
              h * clamp(0.9 / Math.sqrt(Math.max(error, 0.01)), 0.5, 2),
            );
            break;
          }
          h *= Math.max(0.15, 0.8 / Math.sqrt(error));
        }
        if (!accepted)
          throw new Error(
            'The RC timing calculation did not converge. Check component values and connections.',
          );
        time += h;
        capVolt = accepted.c;
        values = accepted.v;
        steps++;
        append(time, values, high);
        const next = nextHigh(values);
        if (next !== high) {
          high = next;
          events.push({ time, type: 'output', high });
          settle();
          if (
            high &&
            !net.source &&
            !net.ttl &&
            ![...switches.values()].some(Boolean)
          ) {
            rises.push({ time, c: capVolt.slice() });
            if (rises.length >= 3) {
              const a = rises.at(-2),
                b = rises.at(-1),
                period = b.time - a.time;
              if (
                period > 1e-8 &&
                b.c.every((v, i) => Math.abs(v - a.c[i]) < voltage * 0.0005)
              ) {
                const wave = points.filter(
                  (p) => p.t >= a.time - 1e-12 && p.t <= b.time + 1e-12,
                );
                cycle = { start: a.time, end: Infinity, period, points: wave };
                cycles.push(cycle);
              }
            }
          }
        }
      }
      while (pending[0] && pending[0].t <= time + 1e-12) {
        const e = pending.shift();
        setButton(e.id, e.closed);
      }
      return { time, high, values: { ...values } };
    }
    function trace(start, end = time, count = 1800) {
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end > time + 1e-9 ||
        end <= start ||
        !Number.isInteger(count) ||
        count < 2 ||
        count > 12000
      )
        throw new Error('Choose a valid acquisition window.');
      const step = (end - start) / count;
      const times = new Set(
        Array.from({ length: count + 1 }, (_, i) => start + i * step),
      );
      // A uniform grid alone can miss an entire narrow pulse. Keep both sides
      // of solved switching events, including repetitions of a cached cycle.
      const edge = (t) => {
        if (t < start || t > end) return;
        const epsilon = Math.max(
          step * 1e-6,
          Number.EPSILON * Math.max(1, Math.abs(t)) * 4,
        );
        for (const value of [t - epsilon, t, t + epsilon])
          if (value >= start && value <= end) times.add(value);
      };
      for (const event of events) edge(event.time);
      for (const segment of cycles) {
        if (segment.end < start || segment.start > end) continue;
        for (let i = 1; i < segment.points.length; i++) {
          if (segment.points[i].high === segment.points[i - 1].high) continue;
          const base = segment.points[i].t;
          const first = Math.max(0, Math.ceil((start - base) / segment.period));
          const last = Math.floor(
            (Math.min(end, segment.end) - base) / segment.period,
          );
          if (last - first > 1000)
            throw new Error(
              'Too many switching edges. Reduce the acquisition window.',
            );
          for (let n = first; n <= last; n++) edge(base + n * segment.period);
        }
      }
      return [...times].sort((a, b) => a - b).map((t) => sample(t));
    }
    function record(start, end = time, count = 1800) {
      const traces = { t: [], ch1: [], ch2: [], gen: [] };
      const points = trace(start, end, count);
      const step = (end - start) / count;
      for (const p of points) {
        const t = p.t;
        traces.t.push(t);
        traces.gen.push(net.source ? sourceAt(t, 'main') : 0);
        for (const ch of ['ch1', 'ch2']) {
          const probe = state.probes[ch];
          traces[ch].push(
            net.channelStatus[ch]
              ? 0
              : value(p.values, net.r(probe.tip)) -
                  value(p.values, net.r(probe.gnd)),
          );
        }
      }
      return {
        traces,
        dt: step,
        window: end - start,
        frequency: cycle ? 1 / cycle.period : 0,
        edgeAware: true,
        warnings: net.warnings,
        uf: net.uf,
        channelStatus: net.channelStatus,
        lastSol: null,
      };
    }
    return {
      advance,
      setButton,
      scheduleButton,
      cancelButtonEvents,
      record,
      trace,
      sample,
      net,
      get time() {
        return time;
      },
      get high() {
        return high;
      },
      get values() {
        return { ...values };
      },
      get events() {
        return events.slice();
      },
      get period() {
        return cycle?.period ?? null;
      },
      get steps() {
        return steps;
      },
    };
  }
  const api = {
    nodes,
    holes,
    pinNames,
    transition,
    predictions,
    canonical,
    prepare,
    create,
  };
  root.Timer555Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
