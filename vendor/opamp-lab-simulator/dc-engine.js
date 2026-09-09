/* Ideal DC instruments. Numerical references never connect separate islands. */
(function (root) {
  'use strict';
  const { UnionFind, gaussianSolve } =
    root.CircuitEngine || require('./engine.js');
  function operatingPoint(resistors, sources, nodes) {
    const groups = new UnionFind();
    for (const n of nodes) groups.add(n);
    for (const r of resistors) groups.union(r.a, r.b);
    for (const s of sources) groups.union(s.p, s.n);
    const islands = new Map();
    for (const n of groups.p.keys()) {
      const key = groups.find(n);
      if (!islands.has(key)) islands.set(key, []);
      islands.get(key).push(n);
    }
    const voltages = {},
      currents = {};
    for (const ns of islands.values()) {
      const ground = ns[0],
        active = ns.slice(1),
        index = new Map(active.map((n, i) => [n, i]));
      const ss = sources.filter(
        (s) => groups.find(s.p) === groups.find(ground),
      );
      const count = active.length + ss.length;
      const A = Array.from({ length: count }, () => Array(count).fill(0)),
        b = Array(count).fill(0);
      const add = (a, c, v) => {
        if (a !== ground && c !== ground) A[index.get(a)][index.get(c)] += v;
      };
      for (const r of resistors.filter(
        (r) => groups.find(r.a) === groups.find(ground),
      )) {
        const g = 1 / r.value;
        add(r.a, r.a, g);
        add(r.b, r.b, g);
        add(r.a, r.b, -g);
        add(r.b, r.a, -g);
      }
      ss.forEach((s, i) => {
        const k = active.length + i;
        for (const [n, sign] of [
          [s.p, 1],
          [s.n, -1],
        ])
          if (n !== ground) {
            A[index.get(n)][k] += sign;
            A[k][index.get(n)] += sign;
          }
        b[k] = s.value;
      });
      const x = count ? gaussianSolve(A, b) : [];
      if (x.some((v) => !Number.isFinite(v)))
        throw new Error('The circuit has no finite solution.');
      for (let i = 0; i < count; i++) {
        const residual = Math.abs(
          A[i].reduce((s, v, j) => s + v * x[j], 0) - b[i],
        );
        const scale =
          1 +
          Math.abs(b[i]) +
          A[i].reduce((s, v, j) => s + Math.abs(v * x[j]), 0);
        if (residual > 1e-9 * scale)
          throw new Error('The circuit could not be solved accurately.');
      }
      voltages[ground] = 0;
      active.forEach((n, i) => (voltages[n] = x[i]));
      ss.forEach((s, i) => (currents[s.id] = x[active.length + i]));
    }
    for (const r of resistors)
      currents[r.id] = (voltages[r.a] - voltages[r.b]) / r.value;
    return { voltages, currents, groups };
  }
  function solve(board) {
    const mode = board.meter.mode;
    const unit = { voltage: 'V', current: 'A', resistance: 'Ω' }[mode];
    const result = {
      status: 'unavailable',
      value: null,
      unit,
      message: 'Connect both meter probes.',
      warnings: [],
      nodeVoltages: {},
      branchCurrents: {},
    };
    const uf = new UnionFind(),
      resistors = [],
      sources = [];
    const addR = (id, a, b, value) => resistors.push({ id, a, b, value });
    for (const c of board.components) {
      uf.add(c.a);
      uf.add(c.b);
      if (c.type === 'wire') uf.union(c.a, c.b);
      if (c.type === 'potentiometer') {
        uf.add(c.w);
        if (c.position === 0) uf.union(c.w, c.b);
        if (c.position === 1) uf.union(c.w, c.a);
      }
    }
    for (const n of Object.values(board.leads)) if (n != null) uf.add(n);
    for (const c of board.components) {
      if (c.type === 'resistor')
        addR(c.id, uf.find(c.a), uf.find(c.b), c.value);
      if (c.type === 'potentiometer') {
        if (c.position !== 1)
          addR(
            c.id + ':upper',
            uf.find(c.a),
            uf.find(c.w),
            (1 - c.position) * c.value,
          );
        if (c.position !== 0)
          addR(
            c.id + ':lower',
            uf.find(c.w),
            uf.find(c.b),
            c.position * c.value,
          );
      }
      if (c.type === 'resistor' && uf.find(c.a) === uf.find(c.b))
        result.warnings.push(
          `${c.id} is bypassed: both terminals share a net.`,
        );
    }
    const lead = (k) =>
      board.leads[k] == null ? null : uf.find(board.leads[k]);
    const red = lead('meterRed'),
      black = lead('meterBlack'),
      positive = lead('supplyPositive'),
      negative = lead('supplyNegative');
    if (!board.supply.enabled) result.warnings.push('Supply output off.');
    if (positive === null || negative === null)
      result.warnings.push(
        'Connect both DC supply leads to power the circuit.',
      );
    if (mode === 'resistance' && board.supply.enabled) {
      result.message = 'Turn supply output OFF before measuring resistance.';
      return result;
    }
    if (board.supply.enabled && positive !== null && negative !== null) {
      if (positive === negative && board.supply.voltage !== 0) {
        result.status = 'fault';
        result.message = 'Supply short circuit. Reconnect the wires or meter.';
        return result;
      }
      if (positive !== negative)
        sources.push({
          id: 'supply',
          p: positive,
          n: negative,
          value: board.supply.voltage,
        });
    }
    const missing = red === null || black === null;
    if (mode === 'resistance') {
      if (missing) {
        result.status = 'open';
        result.message = 'Open circuit. Connect both probes.';
        return result;
      }
      if (red === black) {
        result.status = 'ok';
        result.value = 0;
        result.message = 'Probes share the same electrical net.';
        return result;
      }
      const passive = new UnionFind();
      resistors.forEach((r) => passive.union(r.a, r.b));
      if (passive.find(red) !== passive.find(black)) {
        result.status = 'open';
        result.message = 'Open circuit: no resistive path between probes.';
        return result;
      }
      sources.push({ id: 'ohmmeter', p: red, n: black, value: 1 });
    }
    let ambiguous = false;
    if (mode === 'current' && !missing) {
      if (red === black) ambiguous = true;
      else if (
        sources.some(
          (s) =>
            (s.p === red && s.n === black) || (s.p === black && s.n === red),
        )
      ) {
        if (board.supply.voltage !== 0) {
          result.status = 'fault';
          result.message =
            'Current mode shorts the supply. Insert the meter in series.';
          return result;
        }
        ambiguous = true;
      } else sources.push({ id: 'ammeter', p: red, n: black, value: 0 });
      result.warnings.push(
        'Current mode connects the probes through an ideal ammeter. Insert it in series.',
      );
    }
    if (board.supply.enabled && positive !== null && negative !== null) {
      const returnPaths = new UnionFind();
      resistors.forEach((r) => returnPaths.union(r.a, r.b));
      sources
        .filter((s) => s.id === 'ammeter')
        .forEach((s) => returnPaths.union(s.p, s.n));
      if (returnPaths.find(positive) !== returnPaths.find(negative))
        result.warnings.push(
          'No closed return path to the supply: source current is zero.',
        );
    }
    try {
      const solved = operatingPoint(
        resistors,
        sources,
        [...uf.p.keys()].map((n) => uf.find(n)),
      );
      result.nodeVoltages = Object.fromEntries(
        [...uf.p.keys()].map((n) => [n, solved.voltages[uf.find(n)]]),
      );
      result.branchCurrents = solved.currents;
      if (missing) return result;
      if (ambiguous) {
        result.message =
          'Current is undetermined through parallel ideal short circuits.';
        return result;
      }
      if (solved.groups.find(red) !== solved.groups.find(black)) {
        result.message =
          'No defined voltage between separate electrical groups.';
        return result;
      }
      result.value =
        mode === 'voltage'
          ? solved.voltages[red] - solved.voltages[black]
          : mode === 'current'
            ? solved.currents.ammeter
            : -1 / solved.currents.ohmmeter;
      if (!Number.isFinite(result.value))
        throw new Error('Measurement is undetermined. Check the connections.');
      if (Object.is(result.value, -0)) result.value = 0;
      result.status = 'ok';
      result.message =
        mode === 'resistance'
          ? 'Equivalent resistance between probes; parallel paths are included.'
          : mode === 'current'
            ? 'Positive current enters the red probe.'
            : 'Red probe voltage relative to black; ideal, unloaded measurement.';
    } catch (error) {
      result.status = 'fault';
      result.value = null;
      result.message = error.message;
    }
    return result;
  }
  root.DCEngine = { solve, operatingPoint };
  if (typeof module !== 'undefined') module.exports = root.DCEngine;
})(globalThis);
