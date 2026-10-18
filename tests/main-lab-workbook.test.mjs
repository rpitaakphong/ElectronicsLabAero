import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createRecord, IDS, RESISTORS, CAPACITORS, VERSION, STORAGE_KEY, SCREENS, TASKS, PAGE_HISTORY, visitedPages, markPageVisited,
  number, signedDeviation, preservePrediction, updateField,
  validateRecord, parseRecord, comparisonRows, progress,
  designIssues, designReference, designForEntry, resistance, taskLabel,
  MAX_TEXT_LENGTH, MAX_RECORD_BYTES,
} from '../activities/555-main-lab/model.js';
import { screen, report, schematic, pinGuide, designSummary, designFeedback } from '../activities/555-main-lab/views.js';
import { timingEquations } from '../activities/555-main-lab/scientific.js';
import { monostableSchematic, conversionSchematic, monostableWaveforms } from '../activities/555-main-lab/diagrams.js';

// Trace the actual right-angle SVG wire geometry, not just its description.
const wireSegments = (svg) => [...svg.matchAll(/<path data-wire-net="([^"]+)" d="([^"]+)"/g)].flatMap(([, net, path]) => {
  const tokens = path.match(/[MHV]|-?\d+(?:\.\d+)?/g), segments = [];
  let i = 0, x = 0, y = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') { x = Number(tokens[i++]); y = Number(tokens[i++]); continue; }
    const next = Number(tokens[i++]);
    assert(['H', 'V'].includes(command), `Unsupported wire command: ${command}`);
    const endX = command === 'H' ? next : x, endY = command === 'V' ? next : y;
    segments.push({ net, left: Math.min(x, endX), right: Math.max(x, endX), top: Math.min(y, endY), bottom: Math.max(y, endY) });
    x = endX; y = endY;
  }
  return segments;
});
const wiredPoint = (segments, net, x, y) => segments.some((s) => s.net === net && x >= s.left && x <= s.right && y >= s.top && y <= s.bottom);
const independentNets = (segments) => {
  for (const a of segments) for (const b of segments) {
    if (a.net === b.net) continue;
    const intersect = Math.max(a.left, b.left) <= Math.min(a.right, b.right) && Math.max(a.top, b.top) <= Math.min(a.bottom, b.bottom);
    assert(!intersect, `Drawn ${a.net} and ${b.net} wires must not touch`);
  }
};

// Feasible examples are software-QA fixtures only, never student defaults.
const choices = {
  A0: { r1a: '10', r2a: '33', r2b: '33', capacitor: '10' },
  A1: { r1a: '33', r1b: '10', r2a: '33', r2b: '10', capacitor: '10' },
  M0: { r1a: '33', r1b: '33', capacitor: '10' },
  M1: { r1a: '33', capacitor: '10' },
};
const prepare = (r, id) => {
  Object.assign(r.configs[id].design, choices[id]);
  r.configs[id].prediction.reason = 'Synthetic QA calculation or uncertainty';
};
const first = (r) => {
  prepare(r, 'A0'); preservePrediction(r, 'A0');
  r.configs.A0.measurement.frequency = '1.02';
};

test('v3 starts with no prescribed timing parts, predictions, or physical readings', () => {
  const r = createRecord();
  assert.equal(VERSION, 3); assert.equal(STORAGE_KEY, 'electronics-555-main-lab-v3');
  for (const id of IDS) {
    assert.equal(r.configs[id].original, null);
    for (const section of ['design', 'prediction', 'measurement'])
      assert(Object.values(r.configs[id][section]).every((v) => v === ''));
  }
  assert.deepEqual(progress(r), { preserved: 0, captures: 0, conclusions: 0 });
  r.configs.A0.prediction.high = 'test';
  assert.equal(createRecord().configs.A0.prediction.high, '');
  assert.equal(r.configs.A1.prediction.high, '');
});
test('first attempt requires available components and a genuine prediction, not a correct answer', () => {
  const r = createRecord();
  assert.throws(() => updateField(r, 'configs.A0.measurement.high', '.5'), /Save your initial design/);
  assert.throws(() => preservePrediction(r, 'A0'), /predicted values/);
  r.configs.A0.prediction.reason = 'Unsure about the waveform';
  assert.throws(() => preservePrediction(r, 'A0'), /resistance/);
  prepare(r, 'A0'); preservePrediction(r, 'A0');
  updateField(r, 'configs.A0.measurement.high', '.5');
  assert.equal(r.configs.A0.measurement.high, '.5');
  assert.throws(() => updateField(r, 'configs.A0.original.at', 'replacement'), /cannot be edited/);
});
test('series combinations respect two of each resistor across the complete circuit', () => {
  const r = createRecord(), d = r.configs.A0.design;
  Object.assign(d, { r1a: '33', r1b: '33', r2a: '33', capacitor: '10' });
  assert.match(designIssues('A0', d).join(' '), /Only two resistors/);
  assert.equal(resistance(d, 'r1'), 66);
  d.r1b = '10'; assert.deepEqual(designIssues('A0', d), []);
  assert.equal(resistance(d, 'r1'), 43);
  d.r1a = ''; assert.match(designIssues('A0', d).join(' '), /total resistance greater than zero/);
  assert.equal(resistance(d, 'r1'), null);
  assert.deepEqual(parseRecord(JSON.stringify(r)), r, 'Incomplete designs remain portable drafts');
});
test('Lab 2 carries over the Lab 1 capacitor on explicit save and freezes its reference', () => {
  const r = createRecord(); prepare(r, 'A1');
  assert.throws(() => preservePrediction(r, 'A1'), /Measure/);
  first(r); r.configs.A1.design.capacitor = '';
  assert.equal(designForEntry(r, 'A1').capacitor, '10');
  assert.equal(r.configs.A1.design.capacitor, '', 'Preview must not mutate a draft');
  preservePrediction(r, 'A1');
  assert.equal(r.configs.A1.design.capacitor, '10');
  assert.equal(r.configs.A1.original.design.capacitor, '10');
  const original = structuredClone(r.configs.A1.original);
  updateField(r, 'configs.A0.measurement.frequency', '1.1');
  updateField(r, 'configs.A0.design.capacitor', '1');
  updateField(r, 'configs.A1.prediction.high', '.6');
  updateField(r, 'configs.A1.design.r1a', '4.7');
  assert.equal(preservePrediction(r, 'A1'), false);
  assert.deepEqual(r.configs.A1.original, original);
  assert.deepEqual(designReference(r, 'A1'), { frequency: '1.02', capacitor: '10' });
  assert.deepEqual(validateRecord(r), r);
});
test('Lab 2 legacy capacitor entries round-trip unchanged until explicit save', () => {
  const r = createRecord(); first(r); prepare(r, 'A1');
  r.configs.A1.design.capacitor = '1';
  const before = JSON.stringify(r), restored = parseRecord(before);
  assert.equal(designForEntry(restored, 'A1').capacitor, '10');
  const html = screen(restored, 2);
  assert.match(html, /Earlier capacitor entry retained/);
  assert.match(html, /Saving the initial Lab 2 design will replace it with the Lab 1 capacitor/);
  assert.equal(JSON.stringify(restored), before);
  assert.deepEqual(parseRecord(JSON.stringify(restored)), r);
  restored.configs.A1.design.r1a = '';
  assert.throws(() => preservePrediction(restored, 'A1'), /resistance/);
  assert.equal(restored.configs.A1.design.capacitor, '1', 'A failed save must not change an earlier entry');
  restored.configs.A1.design.r1a = '33';
  preservePrediction(restored, 'A1');
  assert.equal(restored.configs.A1.design.capacitor, '10');
  // A previously recorded correction is not rewritten by rendering or saving again.
  restored.configs.A1.design.capacitor = '1';
  const saved = JSON.stringify(restored);
  assert.match(screen(restored, 2), /Your saved answers have not been changed/);
  assert.equal(preservePrediction(restored, 'A1'), false);
  assert.equal(JSON.stringify(restored), saved);
  assert.equal(designForEntry(restored, 'A1').capacitor, '1');
  assert.deepEqual(parseRecord(saved), restored);
});
test('required progress excludes optional extension and its evidence', () => {
  const r = createRecord(); first(r);
  for (const id of ['A1', 'M0']) { prepare(r, id); preservePrediction(r, id); }
  for (const id of ['A0', 'A1', 'M0trigger', 'M0capacitor'])
    Object.assign(r.evidence[id], { filename: id + '.png', annotation: 'Synthetic evidence' });
  assert.deepEqual(progress(r, ['A0', 'A1', 'M0trigger', 'M0capacitor']), { preserved: 3, captures: 3, conclusions: 0 });
  assert(!comparisonRows(r).some((row) => row.id === 'M1'));
  prepare(r, 'M1'); preservePrediction(r, 'M1');
  assert.equal(progress(r).preserved, 3);
  assert(!comparisonRows(r).some((row) => row.id === 'M1'));
});
test('partial and populated JSON round-trip without changing precision or units', () => {
  const r = createRecord(); r.group.id = 'Bench 3'; r.group.student1.name = 'Ada'; r.group.student2.name = 'Bo';
  prepare(r, 'M0'); r.configs.M0.prediction.pulse = '.72600'; preservePrediction(r, 'M0');
  r.configs.M0.measurement.pulse = '.741'; r.evidence.M0trigger.filename = 'trigger.png';
  assert.deepEqual(parseRecord(JSON.stringify(r)), r);
  const draft = createRecord(); assert.deepEqual(parseRecord(JSON.stringify(draft)), draft);
});
test('imports reject legacy, foreign, malformed, oversized, incomplete and hostile records', () => {
  assert.throws(() => parseRecord('{'), /JSON/);
  assert.throws(() => parseRecord(' '.repeat(MAX_RECORD_BYTES + 1)), /8 MB/);
  assert.throws(() => validateRecord({ activityId: '555-main-lab', schemaVersion: 1 }), /START_HERE-v1/);
  for (const mutate of [
    (r) => { r.activityId = 'prelab'; }, (r) => { r.schemaVersion = 999; },
    (r) => { delete r.analysis; }, (r) => { r.configs.A0.measurement.high = 0; },
    (r) => { r.visited = [99]; }, (r) => { r.visited = [0, 0]; },
    (r) => { r.configs.A1.design.capacitor = '999'; },
    (r) => { r.configs.A0.measurement.high = '.5'; },
    (r) => { r.createdAt = 'not-a-date'; },
  ]) { const r = createRecord(); mutate(r); assert.throws(() => validateRecord(r)); }
  const text = JSON.stringify(createRecord()).replace('"legacyMembers":""', '"legacyMembers":"","__proto__":{"polluted":true}');
  assert.throws(() => parseRecord(text), /fields/); assert.equal({}.polluted, undefined);
});
test('invalid originals and references cannot bypass import gates', () => {
  const r = createRecord(); first(r); prepare(r, 'A1'); preservePrediction(r, 'A1');
  const clean = structuredClone(r);
  r.configs.A1.original.reference.frequency = ''; assert.throws(() => validateRecord(r), /saved Lab 1 frequency/);
  Object.assign(r, structuredClone(clean)); r.configs.A0.original.design.r1a = '';
  assert.throws(() => validateRecord(r), /original component selection/);
  Object.assign(r, structuredClone(clean)); r.configs.A0.original.prediction.reason = '';
  assert.throws(() => validateRecord(r), /original predictions/);
});
test('missing values stay missing and duty differences use percentage points', () => {
  for (const val of ['', ' ', 'unknown', 'NaN', 'Infinity', '-1']) assert.equal(number(val), null);
  assert.equal(number('0'), 0); assert.equal(number('1.5e2'), 150);
  assert.equal(signedDeviation('', '10'), null); assert.equal(signedDeviation('0', '10'), null);
  assert.equal(signedDeviation('10', ''), null); assert.equal(signedDeviation('100', '110'), 10);
  assert.equal(signedDeviation('100', '90'), -10);
  const r = createRecord(); r.configs.A0.prediction.duty = '60'; r.configs.A0.measurement.duty = '63';
  assert.equal(comparisonRows(r).find((row) => row.id === 'A0' && row.key === 'duty').difference, 3);
  assert(comparisonRows(createRecord()).every((row) => row.measured === null && row.difference === null));
});
test('every nominal A0 solution has a feasible A1 within the resistor stock and same capacitor', () => {
  const parts = RESISTORS.flatMap((a, i) => [[a], ...RESISTORS.slice(i).map((b) => [a, b])]);
  const sum = (p) => p.reduce((a, b) => a + b, 0), all = [];
  for (const a of parts) for (const b of parts) for (const c of CAPACITORS) {
    const d = { ...createRecord().configs.A0.design, r1a: String(a[0]), r1b: a[1] ? String(a[1]) : '', r2a: String(b[0]), r2b: b[1] ? String(b[1]) : '', capacitor: String(c) };
    if (designIssues('A0', d).length) continue;
    const h = Math.log(2) * (sum(a) + sum(b)) * c / 1000, l = Math.log(2) * sum(b) * c / 1000;
    all.push({ c, f: 1 / (h + l), ratio: h / l });
  }
  const a0 = all.filter((t) => t.f >= .8 && t.f <= 1.3); assert.equal(a0.length, 24);
  for (const a of a0) assert(all.some((b) => b.c === a.c && b.ratio >= 1.8 && b.ratio <= 2.2 && b.f >= .8 * a.f && b.f <= 1.2 * a.f));
  const pulse = (r, c) => Math.log(3) * r * c / 1000;
  assert(pulse(66, 10) >= .55 && pulse(66, 10) <= .95);
  assert(pulse(33, 10) >= .25 && pulse(33, 10) <= .50);
});
test('five pages use the task titles without visible legacy codes or repeated specifications', () => {
  assert.deepEqual(SCREENS.map(([title]) => title), ['Before you begin', 'Lab 1 - Astable Circuit Design', 'Lab 2 - Astable Circuit Modification', 'Lab 3 - Monostable Circuit Design', 'Save lab data']);
  const r = createRecord(), before = JSON.stringify(r);
  for (let i = 0; i < SCREENS.length; i++) {
    const html = screen(r, i), text = html.replace(/<[^>]*>/g, ' ');
    assert(html.includes(`<h1>${SCREENS[i][0]}</h1>`));
    assert.equal((html.match(/class="goal-panel"/g) || []).length, i >= 1 && i <= 3 ? 1 : 0);
    if (i >= 1 && i <= 3) assert.match(html, /<h2>Lab Objective<\/h2>/);
    assert.doesNotMatch(text, /\bTask [123]\b/);
    assert.doesNotMatch(text, /\b(?:A0|A1|M0|M1)\b|shorter pulse|physical evidence|design brief|work backward|engineering argument|retain the pace/i);
    assert.doesNotMatch(html, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<math/);
    assert.doesNotMatch(html, /Two hours at the bench|troubleshooting allowance|\d+\s*–\s*\d+\s*min|<th>Minutes<\/th>|<iframe/);
  }
  assert.equal(JSON.stringify(r), before);
  assert.match(screen(r, 2), /Continuing from Lab 1, modify your circuit/);
  assert.match(screen(r, 3), /normally-open momentary pushbutton/);
  assert.match(screen(r, 3), /TRIG returns HIGH before OUT falls/);
  assert.match(screen(r, 4), /recommended transfer file/);
  assert.match(pinGuide(), /TOP VIEW/);
  assert.doesNotMatch(schematic(), /10 kΩ|33 kΩ|1 µF/);
});

test('Lab 1 explains its lab objective with one frequency range and an illustrative pulse signal', () => {
  const r = createRecord(), before = JSON.stringify(r), html = screen(r, 1);
  const objective = html.match(/<section class="goal-panel"[\s\S]*?<\/section>/)?.[0];
  assert(objective);
  assert.match(objective, /<h2>Lab Objective<\/h2>/);
  assert.match(objective, /Lab 1 lab objective/);
  assert.match(objective, /main objective of this lab task is to design a repeating pulse signal/);
  assert.match(objective, /select a suitable combination of timing resistors and a timing capacitor/);
  assert.equal((objective.match(/<mn>0\.8<\/mn>/g) || []).length, 1);
  assert.equal((objective.match(/<mn>1\.3<\/mn>/g) || []).length, 1);
  assert.match(objective, /class="signal-illustration"/);
  assert.match(objective, /Illustration only, not to scale/);
  assert.match(objective, /No specific duty cycle or voltage level is prescribed/);
  assert.doesNotMatch(objective, /Design specifications|<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<math/);
  for (const i of [0, 2, 3, 4]) assert.doesNotMatch(screen(r, i), /signal-illustration/);
  assert.match(screen(r, 3), /<h2>Lab Objective<\/h2>/);
  assert.equal(JSON.stringify(r), before);
});

test('Lab 3 objective explains single-pulse design, construction and measurement without prescribing parts', () => {
  const r = createRecord(), before = JSON.stringify(r), html = screen(r, 3);
  const objective = html.match(/<section class="goal-panel"[\s\S]*?<\/section>/)?.[0];
  assert(objective);
  assert.equal(taskLabel('A0'), 'Lab 1');
  assert.equal(taskLabel('M0'), 'Lab 3');
  assert.match(objective, /<h2>Lab Objective<\/h2>/);
  assert.match(objective, /instead of oscillating continuously/);
  assert.match(objective, /one HIGH output pulse/);
  assert.match(objective, /In simple words, design a circuit that produces one HIGH output pulse when you press a button/);
  assert.match(objective, /normally-open momentary pushbutton: press and release it briefly/);
  assert.match(objective, /output stays LOW between pulses/);
  assert.match(objective, /from the output’s rising edge to its falling edge/);
  assert.match(objective, /not for as long as you hold the button/);
  assert.match(objective, /Choose a timing resistance R and timing capacitor C/);
  assert.match(objective, /save your initial design before building/);
  assert.match(objective, /Wire with the power off/);
  assert.match(objective, /Brief trigger input and complete output pulse/);
  assert.match(objective, /\(Screenshot 3\)/);
  assert.match(objective, /class="monostable-waveforms"/);
  assert.doesNotMatch(objective, /save both screenshots|timing-capacitor voltage with the output/);
  assert.equal((objective.match(/<mn>0\.55<\/mn>/g) || []).length, 1);
  assert.equal((objective.match(/<mn>0\.95<\/mn>/g) || []).length, 1);
  assert.doesNotMatch(objective, /Design specifications|(?:33|66) kΩ|(?:1|10) µF/);
  assert.equal(JSON.stringify(r), before);
});

test('each objective lists four deliverable groups before its illustration or reference without changing answers', () => {
  const r = createRecord(), before = JSON.stringify(r);
  let captures = 0;
  for (const [id, index] of [['A0', 1], ['A1', 2], ['M0', 3]]) {
    const html = screen(r, index), objective = html.match(/<section class="goal-panel"[\s\S]*?<\/section>/)?.[0];
    assert(objective);
    const block = objective.match(new RegExp(`<div class="objective-deliverables" data-lab-deliverables="${id}">[\\s\\S]*?<\\/div>`))?.[0];
    assert(block);
    assert.equal((objective.match(/<h3>Key deliverable<\/h3>/g) || []).length, 1);
    assert.equal((block.match(/<li>/g) || []).length, 4);
    for (const label of ['Screenshot', 'Timing readings', 'Voltage readings', 'Component readings']) assert(block.includes(`<strong>${label}:</strong>`));
    for (const text of ['readable scales', 'timing readouts or cursors', 'Enter readings and method below', 'explain any missing readings', 'Do not use marked values as measurements', 'Submit the report', 'one screenshot per lab (three total)', 'JSON is a backup']) assert(block.includes(text), `Missing ${text} for ${id}`);
    assert.doesNotMatch(block, /data-field=|<input|<select|<textarea|CH1|CH2|probe|pin [1-8]/);
    const following = id === 'A0' ? 'class="signal-illustration"' : id === 'A1' ? 'class="goal-reference"' : 'class="monostable-waveforms"';
    assert(objective.indexOf('class="objective-deliverables"') < objective.indexOf(following));
    captures += (html.match(/data-image-file=/g) || []).length;
  }
  for (const i of [0, 4]) assert.doesNotMatch(screen(r, i), /objective-deliverables/);
  assert.equal(captures, 3);
  assert.equal(JSON.stringify(r), before);
  assert.doesNotMatch(report(r), /Key deliverable|objective-deliverables/);
});

test('astable deliverables include the required image evidence, timings, transition voltages and component units', () => {
  const r = createRecord();
  for (const [index, capture] of [[1, 1], [2, 2]]) {
    const block = screen(r, index).match(/<div class="objective-deliverables"[\s\S]*?<\/div>/)?.[0];
    assert(block);
    assert(block.includes(`Screenshot ${capture}`));
    assert.match(block, /[Oo]utput and timing-capacitor voltage over two steady cycles/);
    for (const symbol of ['<var>t<sub>H</sub></var>', '<var>t<sub>L</sub></var>', '<var>T</var>', '<var>f</var>', '<var>D<sub>H</sub></var>']) assert(block.includes(symbol));
    assert.match(block, /Supply; output HIGH\/LOW/);
    assert.match(block, /capacitor just before both output transitions \(V\)/);
    assert.match(block, /R<sub>1<\/sub>[\s\S]*R<sub>2<\/sub>[\s\S]*\(kΩ\)/);
    assert.match(block, /<var>C<\/var> \(µF\), if measurable/);
    if (index === 1) assert.match(block, /Show <var>f<\/var> or <var>T<\/var>/);
    else assert.match(block, /Show <var>t<sub>H<\/sub><\/var>/);
    assert.doesNotMatch(block, /trigger LOW duration|between repeated button presses/);
  }
});

test('monostable deliverables require a complete trigger/output capture and distinguish press spacing from pulse duration', () => {
  const block = screen(createRecord(), 3).match(/<div class="objective-deliverables"[\s\S]*?<\/div>/)?.[0];
  assert(block);
  assert.match(block, /Brief trigger input and complete output pulse, including its return LOW/);
  assert.match(block, /Show <var>t<sub>W<\/sub><\/var>/);
  assert.match(block, /Pulse duration <var>t<sub>W<\/sub><\/var>/);
  assert.match(block, /trigger LOW duration; time between presses \(not the output period\)/);
  assert.match(block, /Supply; output HIGH\/LOW; trigger HIGH\/LOW/);
  assert.match(block, /Measured <var>R<\/var> \(kΩ\)/);
  assert.doesNotMatch(block, /capacitor voltage|two steady cycles|R<sub>[12]|CH1|CH2|Screenshot 4/);
});

test('key deliverables stay concise and omit timing units without removing input-field units', () => {
  const r = createRecord();
  for (const [id, index] of [['A0', 1], ['A1', 2], ['M0', 3]]) {
    const html = screen(r, index), block = html.match(/<div class="objective-deliverables"[\s\S]*?<\/div>/)?.[0];
    assert(block);
    const timings = block.match(/<li><strong>Timing readings:<\/strong>([\s\S]*?)<\/li>/)?.[1];
    assert(timings);
    assert.doesNotMatch(timings, /\(s\)|\(Hz\)|\(%\)|seconds|hertz/i);
    const words = block.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    assert(words < 165, `Key deliverable too long for ${id}: ${words} words`);
    assert.doesNotMatch(block, /What to record and submit/);
    for (const group of ['prediction', 'measurement']) {
      const key = id === 'M0' ? 'pulse' : 'high';
      assert(html.includes(`for="field-configs-${id}-${group}-${key}"`));
      assert.match(html.match(new RegExp(`<label for="field-configs-${id}-${group}-${key}">[\\s\\S]*?<\\/label>`))?.[0] || '', /\(s\)/);
    }
  }
});

test('redundant standalone monostable and unchanged-power sections are omitted', () => {
  const svg = monostableSchematic(), segments = wireSegments(svg);
  independentNets(segments);
  for (const [net, x, y] of [['timing', 470, 245], ['timing', 470, 300], ['trigger', 680, 380], ['vcc', 520, 180], ['vcc', 580, 180], ['ground', 545, 470], ['control', 635, 470], ['output', 680, 245]])
    assert(wiredPoint(segments, net, x, y), `Missing pin connection ${net} at ${x},${y}`);
  for (const id of ['timing-r', 'timing-c', 'trigger-pullup', 'trigger-switch', 'control-bypass', 'supply-bypass']) assert(svg.includes(`data-component="${id}"`));
  assert.match(svg, /normally-open/);
  assert.match(svg, /10 kΩ/); assert.match(svg, /10 nF/); assert.match(svg, /100 nF/);
  assert.doesNotMatch(svg, /33 kΩ|66 kΩ|10 µF|1 µF/);
  const r = createRecord(), before = JSON.stringify(r), html = screen(r, 3);
  assert.match(html, /Circuit Schematic - Transforming Astable Circuit to Monostable Circuit/);
  assert.doesNotMatch(html, /Monostable circuit schematic|For Screenshot 4|complete schematic above/);
  assert.match(html, /functional, not the physical DIP-8 layout/);
  assert.match(html, /ne555\.pdf#page=11/);
  assert.doesNotMatch(html, /Keep these connections unchanged|data-expand="unchanged-connections"|class="power-connections"/);
  assert.equal((html.match(/class="monostable-schematic"/g) || []).length, 0);
  for (const i of [0, 1, 2, 4]) assert.doesNotMatch(screen(r, i), /monostable-schematic|conversion-schematic/);
  assert.doesNotMatch(report(r), /monostable-schematic|conversion-schematic/);
  assert.equal(JSON.stringify(r), before);
});

test('before/after diagrams show the actual three conversion changes without prescribing timing values', () => {
  for (const mode of ['astable', 'monostable']) {
    const svg = conversionSchematic(mode), segments = wireSegments(svg);
    independentNets(segments);
    assert(wiredPoint(segments, mode === 'astable' ? 'timing' : 'trigger', 470, 300));
    assert(wiredPoint(segments, 'timing', 280, 260));
    assert(wiredPoint(segments, mode === 'astable' ? 'discharge' : 'timing', 280, 180));
    assert.equal(svg.includes('data-component="r2"'), mode === 'astable');
    assert.equal(svg.includes('data-component="trigger-switch"'), mode === 'monostable');
    assert.equal(svg.includes('data-component="trigger-pullup"'), mode === 'monostable');
    assert.doesNotMatch(svg, /µF|1 kΩ|33 kΩ|66 kΩ/);
  }
  const html = screen(createRecord(), 3);
  assert.match(html, /Before · Astable/); assert.match(html, /After · Monostable/);
  assert.match(html, /Replace R2 with a wire/);
  assert.doesNotMatch(html, /Retain the power, RESET, and bypass wiring in both circuits/);
  assert.match(html, /data-expand="conversion-astable"/);
  assert.match(html, /data-expand="conversion-monostable"/);
});

test('Lab 1 and 2 omit live component-value strips while retaining stock feedback and saved summaries', () => {
  const r = createRecord(); first(r); prepare(r, 'A1'); preservePrediction(r, 'A1');
  const before = JSON.stringify(r);
  for (const [i, id] of [[1, 'A0'], [2, 'A1']]) {
    const feedback = screen(r, i).match(new RegExp(`<div class="design-feedback" data-design-feedback="${id}"[^>]*>([\\s\\S]*?)<\\/div>`))?.[1];
    assert(feedback);
    assert.match(feedback, /class="design-status ready"/);
    assert.doesNotMatch(feedback, /parameter-grid|display-equation|<math/);
    assert.doesNotMatch(designFeedback(id, createRecord().configs[id].design), /parameter-grid|<math/);
    assert.doesNotMatch(designFeedback(id, r.configs[id].design), /parameter-grid|<math/);
    assert.match(screen(r, i), /View your original design and predictions/);
    assert.match(designSummary(id, r.configs[id].original.design), /parameter-grid/);
  }
  assert.match(designFeedback('M0', r.configs.M0.design), /parameter-grid/);
  assert.match(report(r), /Original design and predicted values/);
  assert.doesNotMatch(report(r), /\bTask [123]\b/);
  assert.equal(JSON.stringify(r), before);
});

test('Lab 2 explains the time ratio, points to the frequency field and has no capacitor choice', () => {
  const r = createRecord(), before = JSON.stringify(r), html = screen(r, 2);
  assert.equal(taskLabel('A1'), 'Lab 2');
  assert.match(html, /<h1>Lab 2 - Astable Circuit Modification<\/h1>/);
  assert.match(html, /<h2>Lab Objective<\/h2>/);
  assert.match(html, /HIGH time about twice the LOW time/);
  assert.match(html, /how long the output stays HIGH/);
  assert.match(html, /Divide the HIGH time by the LOW time/);
  assert.match(html, /80% to 120% of your Lab 1 reading/);
  assert.match(html, /Measured results → Frequency \(Hz\)/);
  assert.match(html, /data-go-task1-frequency/);
  assert.match(html, /same physical timing capacitor/);
  const capacitorParagraph = html.match(/data-fixed-capacitor><strong>[^<]*<\/strong><p>([^<]*)<\/p>/)?.[1];
  assert.equal(capacitorParagraph, 'Keep the same physical timing capacitor that you used in Lab 1.');
  assert.doesNotMatch(html, /not either bypass capacitor|Do not select a new capacitor for Lab 2/);
  assert.match(html, /First record your timing capacitor in Lab 1/);
  assert.doesNotMatch(html, /data-field="configs\.A1\.design\.capacitor"|C<\/mi><mtext>unchanged|Task 2/);
  assert.equal(JSON.stringify(r), before);
  first(r);
  assert.match(screen(r, 2), /<mn>0\.816<\/mn>/);
  assert.match(screen(r, 2), /<mn>1\.224<\/mn>/);
  prepare(r, 'A1'); preservePrediction(r, 'A1');
  r.configs.A0.measurement.frequency = '2';
  r.configs.A0.design.capacitor = '1';
  const savedHtml = screen(r, 2);
  assert.match(savedHtml, /<mn>0\.816<\/mn>/);
  assert.match(savedHtml, /<mn>1\.224<\/mn>/);
  assert.match(savedHtml, /frequency limits and capacitor reference were fixed/);
  assert.doesNotMatch(savedHtml, /Earlier capacitor entry retained/);
  assert.doesNotMatch(report(r), /Task 2/);
});

test('each task has calculations and measurements together with no repeated references', () => {
  const r = createRecord();
  for (const [i, id] of [[1, 'A0'], [2, 'A1'], [3, 'M0']]) {
    const html = screen(r, i);
    assert(html.includes(`configs.${id}.design.r1a`));
    assert(html.includes(`configs.${id}.prediction.${id.startsWith('A') ? 'high' : 'pulse'}`));
    assert(html.includes(`configs.${id}.measurement.${id.startsWith('A') ? 'high' : 'pulse'}`));
    assert.equal((html.match(/data-design-feedback=/g) || []).length, 1);
    assert.equal((html.match(/class="voltage-goals"/g) || []).length, 0);
  }
  assert.equal((screen(r, 0).match(/class="voltage-goals"/g) || []).length, 1);
  assert.equal((screen(r, 0).match(/diagram-pins/g) || []).length, 1);
  assert.equal((screen(r, 1).match(/class="formula-sheet"/g) || []).length, 1);
  assert.equal((screen(r, 2).match(/class="formula-sheet"/g) || []).length, 0);
  assert.match(screen(r, 2), /data-reference="astable-equations"/);
  assert.doesNotMatch(screen(r, 2), /<svg/);
  assert.doesNotMatch(screen(r, 3), /Connections to change for the monostable circuit|Plan the connection changes|Before you leave the lab|How to use the switch/);
  assert.doesNotMatch(screen(r, 3), /One kiloohm|diagram-pins/);
  assert.equal((screen(r, 3).match(/data-image-file=/g) || []).length, 1);
  assert.doesNotMatch(screen(r, 4), /goal-panel|configs\.M1|evidence\.M1/);
});

test('astable reference keeps five timing equations without conversion or rearranged-resistance cards', () => {
  const equations = timingEquations(true);
  assert.equal((equations.match(/class="display-equation"/g) || []).length, 5);
  assert.equal((equations.match(/class="equation-grid"/g) || []).length, 1);
  for (const label of ['HIGH time is approximately', 'LOW time is approximately', 'Period equals', 'Frequency equals', 'HIGH duty cycle in percent']) assert(equations.includes(label));
  const removed = /One kiloohm|One microfarad|R2 is approximately the LOW time|R1 is approximately the HIGH time/;
  assert.doesNotMatch(equations, removed);
  assert.doesNotMatch(screen(createRecord(), 1), removed);
  const monostable = timingEquations(false);
  assert.equal((monostable.match(/class="display-equation"/g) || []).length, 2);
  assert.match(monostable, /R is approximately the pulse duration/);
  assert.doesNotMatch(monostable, removed);
});

test('typed resistance totals save predictions without calculation-work or sketch answers', () => {
  const r = createRecord();
  for (const [key, value] of Object.entries({ r1a: '10', r2a: '66', capacitor: '10' })) updateField(r, `configs.A0.design.${key}`, value);
  r.configs.A0.prediction.frequency = '1.016';
  assert.deepEqual(designIssues('A0', r.configs.A0.design), []);
  preservePrediction(r, 'A0');
  assert.equal(r.configs.A0.original.prediction.reason, '');
  assert.equal(r.configs.A0.original.prediction.sketch, '');
  assert.equal(resistance(r.configs.A0.design, 'r2'), 66);
  assert.deepEqual(parseRecord(JSON.stringify(r)), r);
  r.configs.A0.design.r1a = '33';
  assert.match(designIssues('A0', r.configs.A0.design).join(' '), /Only two resistors/);
});

test('invalid or partial typed resistance values remain portable drafts without becoming valid designs', () => {
  for (const value of ['', '.', 'not sure', '-1', '999', '1e309']) {
    const r = createRecord();
    Object.assign(r.configs.A0.design, { r1a: value, r2a: '33', capacitor: '10' });
    r.configs.A0.prediction.frequency = '1';
    assert.deepEqual(parseRecord(JSON.stringify(r)), r);
    assert.throws(() => preservePrediction(r, 'A0'), /resistance|supplied resistor/);
  }
});

test('older series parts and removed answers survive rendering, export and explicit total edits', () => {
  const r = createRecord(); first(r);
  r.configs.A0.prediction.sketch = 'Earlier sketch filename';
  r.configs.A0.original.prediction.sketch = 'Earlier sketch filename';
  Object.assign(r.configs.A0.measurement, { timebase: 'Earlier timebase', voltsPerDiv: 'Earlier voltage scale', probe: 'Earlier probe setting' });
  r.evidence.A0.annotation = 'Earlier screenshot description';
  const before = JSON.stringify(r), restored = parseRecord(before), html = screen(restored, 1);
  assert.match(html, /data-field="configs\.A0\.design\.r2a"[^>]*value="66"/);
  assert.equal(JSON.stringify(restored), before);
  assert.deepEqual(parseRecord(JSON.stringify(restored)), r);
  const printed = report(restored);
  for (const value of ['Earlier sketch filename', 'Earlier timebase', 'Earlier voltage scale', 'Earlier probe setting', 'Earlier screenshot description']) assert(printed.includes(value));
  updateField(restored, 'configs.A0.design.r2a', '43');
  assert.equal(restored.configs.A0.design.r2b, '');
  assert.equal(resistance(restored.configs.A0.design, 'r2'), 43);
  assert.equal(restored.configs.A0.original.design.r2a, '33');
  assert.equal(restored.configs.A0.original.design.r2b, '33');
  assert.equal(restored.evidence.A0.annotation, 'Earlier screenshot description');
  assert.deepEqual(parseRecord(JSON.stringify(restored)), restored);
});

test('task forms omit the marked fields and use explicit component and cursor guidance', () => {
  const r = createRecord();
  for (const [i, id] of [[1, 'A0'], [2, 'A1'], [3, 'M0']]) {
    const html = screen(r, i);
    assert.match(html, /<h3>Predicted Values<\/h3>/);
    assert.match(html, new RegExp(`<input[^>]*data-field="configs\\.${id}\\.design\\.r1a"`));
    assert.doesNotMatch(html, /<select[^>]*data-field="configs\.[^.]+\.design\.r[12]a"/);
    assert.doesNotMatch(html, /data-field="configs\.[^.]+\.(?:design\.r[12]b|prediction\.(?:reason|sketch)|measurement\.(?:timebase|voltsPerDiv|probe))"|data-field="evidence\.[^.]+\.annotation"/);
    assert.match(html, id === 'M0' ? /between the rising and falling edges at mid-level/ : /halfway between the LOW and HIGH voltage levels/);
    assert.match(html, /if any/);
  }
  assert.match(screen(r, 1), /why you chose R1, R2, and C/);
  assert.match(screen(r, 1), /two consecutive rising edges/);
  const printed = report(r);
  assert.doesNotMatch(printed, /Calculation steps and assumptions|Waveform sketch description|Oscilloscope timebase and acquisition settings|Voltage scales and coupling|Probe attenuation setting|Previously recorded screenshot description/);
});

test('screenshot progress counts actual attachments, never legacy filenames', () => {
  const r = createRecord();
  for (const id of ['A0', 'A1', 'M0trigger', 'M0capacitor']) r.evidence[id].filename = `${id}.png`;
  assert.equal(progress(r).captures, 0);
  assert.equal(progress(r, ['A0', 'A1', 'M0trigger', 'M0capacitor']).captures, 3);
  assert(Object.values(r.evidence).every((evidence) => evidence.annotation === ''));
});

test('Lab 3 capacitance uses manual numeric entry and retains partial drafts without weakening original checks', () => {
  const r = createRecord(), html = screen(r, 3);
  assert.match(html, /<input[^>]*data-field="configs.M0.design.capacitor"[^>]*inputmode="decimal"[^>]*data-positive="true"/);
  assert.doesNotMatch(html, /<select[^>]*data-field="configs.M0.design.capacitor"/);
  assert.match(html, /Timing capacitor C[^<]*<span class="unit">\(µF\)/);
  assert.match(html, /Output pulse duration <var>t<sub>W<\/sub><\/var>/);
  prepare(r, 'M0');
  for (const draft of ['0', '-1', '3.3', '1e', 'not a value']) {
    updateField(r, 'configs.M0.design.capacitor', draft);
    assert.deepEqual(parseRecord(JSON.stringify(r)), r);
    assert.throws(() => preservePrediction(r, 'M0'), /supplied timing capacitor/);
    assert.equal(r.configs.M0.original, null);
  }
  updateField(r, 'configs.M0.design.capacitor', '10.00');
  preservePrediction(r, 'M0');
  assert.equal(r.configs.M0.original.design.capacitor, '10.00');
  assert.deepEqual(parseRecord(JSON.stringify(r)), r);
  const invalid = structuredClone(r); invalid.configs.M0.original.design.capacitor = '5';
  assert.throws(() => validateRecord(invalid), /original component selection/);
});

test('Lab 3 example traces share trigger timing and distinguish button duration from output t_W', () => {
  const svg = monostableWaveforms();
  assert.match(svg, /not measured data/); assert.match(svg, /Both traces share a time axis/);
  assert.match(svg, /mid-level/); assert.match(svg, /Button input/); assert.match(svg, /Output pulse/);
  assert.doesNotMatch(svg, /CH1|CH2|probe tip|pin [23]/);
  assert.match(svg, /data-trace="trigger" d="M190 110H320V175H410V110H860"/);
  assert.match(svg, /data-trace="output" d="M190 335H320V260H690V335H860"/);
  // Both events start at x=320; release x=410 precedes pulse-end x=690.
  assert(320 < 410 && 410 < 690);
  assert.doesNotMatch(svg, /µF|kΩ|0\.7\d* s/);
});

test('Lab 3 omits scope-connection teaching and its enlarged views while retaining signals and result fields', () => {
  const r = createRecord(), before = JSON.stringify(r), html = screen(r, 3);
  assert.doesNotMatch(html, /Oscilloscope setup and capture|Connect the two channels|scope-setup|capture-steps|unchanged-connections|power-connections|CH1|CH2|Probe tips/);
  assert.match(html, /class="monostable-waveforms"/);
  assert.equal((html.match(/class="conversion-schematic"/g) || []).length, 2);
  assert.match(html, /configs.M0.measurement.pulse/);
  assert.match(html, /data-image-file="M0trigger"/);
  assert.match(html, /Measure t_W on the output waveform/);
  assert.equal(JSON.stringify(r), before);
  assert.doesNotMatch(html, /conversion\.checked|configs.M0.measurement.capHigh|configs.M0.measurement.capLow|evidence.M0capacitor/);
});

test('removed Lab 3 forms stay absent while nonblank earlier answers remain portable and identified in reports', () => {
  const r = createRecord(), emptyPrint = report(r);
  assert.doesNotMatch(emptyPrint, /Previously recorded notes|Earlier connection notes|Earlier bench notes|Screenshot 4|Checks before leaving the lab/);
  first(r); prepare(r, 'M0'); preservePrediction(r, 'M0');
  Object.assign(r.conversion, { pin2: 'Old connection plan', checked: true });
  Object.assign(r.handoff, { notes: 'Old bench note', poweredDown: true });
  Object.assign(r.evidence.M0capacitor, { filename: 'old-capacitor.png', annotation: 'Earlier capture' });
  Object.assign(r.configs.M0.measurement, { capHigh: '3.25', capLow: '.05' });
  const saved = JSON.stringify(r), restored = parseRecord(saved), print = report(restored);
  assert.equal(JSON.stringify(restored), saved);
  assert.equal(progress(restored).captures, 0);
  assert.match(print, /Previously recorded notes/); assert.match(print, /no longer required/);
  for (const value of ['Old connection plan', 'Old bench note', 'old-capacitor.png', 'Earlier capture', '3.25']) assert(print.includes(value));
  const html = screen(restored, 3);
  assert.doesNotMatch(html, /Old connection plan|Old bench note|old-capacitor.png|data-field="conversion\.|data-field="handoff\./);
  assert.doesNotMatch(print, /class="monostable-waveforms"|class="scope-setup"|class="power-connections"/);
});

test('version-2 page history maps to the combined pages without rewriting saved history', () => {
  const r = createRecord(); r.visited = Array.from({ length: 11 }, (_, i) => i);
  const before = JSON.stringify(r);
  assert.deepEqual(parseRecord(before), r);
  assert.deepEqual(visitedPages(r), [0, 1, 2, 3, 4]);
  assert.equal(JSON.stringify(r), before);
  r.visited = [2, 5, 10, 6];
  assert.deepEqual(visitedPages(r), [1, 3, 4]);
  markPageVisited(r, 2);
  assert.deepEqual(r.visited, [2, 5, 10, 6, 3]);
  assert.deepEqual(PAGE_HISTORY.map(([first]) => first), [0, 1, 3, 4, 8]);
  assert.deepEqual(parseRecord(JSON.stringify(r)), r);
  assert.equal(VERSION, 3); assert.equal(STORAGE_KEY, 'electronics-555-main-lab-v3');
});

test('retired shorter-pulse answers survive JSON but never appear in tasks, charts or reports', () => {
  const r = createRecord(); prepare(r, 'M1'); r.configs.M1.prediction.pulse = '.363'; preservePrediction(r, 'M1');
  r.configs.M1.measurement.pulse = '.370'; r.evidence.M1.filename = 'retired-only.png';
  const backup = JSON.stringify(r), print = report(r);
  assert.deepEqual(parseRecord(backup), r);
  assert(!comparisonRows(r).some((row) => row.id === 'M1'));
  assert.doesNotMatch(print, /retired-only.png|shorter pulse|optional activity|class="goal-panel"|class="formula-sheet"/i);
  assert.deepEqual(progress(r), { preserved: 0, captures: 0, conclusions: 0 });
  for (let i = 0; i < 5; i++) assert.doesNotMatch(screen(r, i), /configs\.M1|evidence\.M1/);
  assert(Object.values(TASKS).every((task) => print.includes(task.title)));
});

test('print report retains originals and only changed corrections without teaching instructions', () => {
  const r = createRecord(); first(r); r.group.student1.name = '<img src=x onerror=alert(1)>';
  r.configs.A0.original.prediction.high = '.5268'; r.configs.A0.prediction.high = '.5300';
  r.analysis.conclusionM = 'Evidence-backed conclusion'; const html = report(r);
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img src=x|<script/);
  assert.match(html, /\.5268/); assert.match(html, /\.5300/); assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /Evidence-backed conclusion/); assert.match(html, /Screenshot 1 - Lab 1/);
  assert.match(html, /IC orientation and pin numbers/);
  assert.doesNotMatch(html, /Locate the notch and pin 1 on the IC|Before switching on the supply, check/);
  assert.doesNotMatch(html, /class="goal-panel"|class="formula-sheet"|<svg[^>]*viewBox="0 0 1000 540"/); assert.match(html, /<math/);
});
test('reports embed current screenshots under each lab without changing the answer record', () => {
  const r = createRecord();
  for (const [slot, index] of [['A0', 1], ['A1', 2], ['M0trigger', 3]]) r.evidence[slot].filename = `Screenshot_${index}_Lab_${index}.png`;
  r.evidence.A0.annotation = 'Earlier screenshot note';
  const before = JSON.stringify(r);
  const html = report(r, { A0: 'blob:qa-one', A1: 'blob:qa-two', M0trigger: 'blob:qa-three', M0capacitor: 'blob:not-required' });
  assert.equal((html.match(/data-report-image=/g) || []).length, 3);
  assert.equal((html.match(/Image not attached/g) || []).length, 0);
  for (const [slot, id] of [['A0', 'A0'], ['A1', 'A1'], ['M0trigger', 'M0']]) {
    const section = html.match(new RegExp(`<section class="report-config"><h2>${TASKS[id].title}[\\s\\S]*?<\\/section>`))?.[0];
    assert(section?.includes(`data-report-image="${slot}"`));
    assert(section.indexOf('Measured results') < section.indexOf('class="report-image"'));
    assert(section.includes(`<figcaption>${r.evidence[slot].filename}</figcaption>`));
  }
  assert(html.includes('Earlier screenshot note'));
  assert(!html.includes('blob:not-required'));
  assert.equal(JSON.stringify(r), before);
});
test('reports distinguish missing image data from filenames and never load images from a filename or remote URL', () => {
  const r = createRecord(); r.evidence.A0.filename = 'legacy.png';
  const empty = report(r), single = report(r, { A1: 'blob:qa-one' });
  assert.equal((empty.match(/Image not attached/g) || []).length, 3);
  assert(!empty.includes('<img'));
  assert(empty.includes('legacy.png'));
  assert.equal((single.match(/data-report-image=/g) || []).length, 1);
  assert.equal((single.match(/Image not attached/g) || []).length, 2);
  const unsafe = report(r, { A0: 'https://example.com/remote.png', A1: 'file:///legacy.png' });
  assert(!unsafe.includes('<img'));
  assert(!unsafe.includes('https://example.com/remote.png'));
});
test('report captions and image attributes remain escaped', () => {
  const r = createRecord(); r.evidence.A0.filename = '<script>QA</script>.png';
  const html = report(r, { A0: 'blob:qa" onerror="alert(1)' });
  assert.match(html, /&lt;script&gt;QA&lt;\/script&gt;\.png/);
  assert.match(html, /src="blob:qa&quot; onerror=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /<script>|src="blob:qa" onerror=/);
});
test('packaged file is standalone, protects v1 and contains no hidden timing solutions', async () => {
  const html = await readFile(new URL('../public/worksheets/555-main-lab.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=|<link\b[^>]*href="(?!data:)|<iframe\b|fetch\(|XMLHttpRequest|WORKBOOK_JS|WORKBOOK_CSS/);
  assert.match(html, /555-main-lab-v2/); assert.doesNotMatch(html, /0\.52679|0\.45747|0\.72508|1\.01598/);
  assert.match(html, /Download answers from the earlier lab/);
  assert.match(html, /555-main-lab-v1/);
});
test('maximum-length text stays portable and nonfinite derived results remain missing', () => {
  const r = createRecord(), long = '\u0000'.repeat(MAX_TEXT_LENGTH); first(r);
  for (const id of IDS) {
    prepare(r, id); const c = r.configs[id];
    for (const k of Object.keys(c.prediction)) c.prediction[k] = long;
    for (const k of ['measuredR1', 'measuredR2', 'measuredC', 'tolerance', 'rationale']) c.design[k] = long;
    preservePrediction(r, id);
    for (const k of Object.keys(c.measurement)) if (id !== 'A0' || k !== 'frequency') c.measurement[k] = long;
  }
  for (const object of [r.group.student1, r.group.student2, r.analysis, r.optional, ...Object.values(r.evidence)])
    for (const k of Object.keys(object)) object[k] = long;
  const bytes = JSON.stringify(r); assert(new TextEncoder().encode(bytes).length < MAX_RECORD_BYTES);
  assert.deepEqual(parseRecord(bytes), r);
  assert.throws(() => updateField(r, 'group.student1.name', 'a'.repeat(MAX_TEXT_LENGTH + 1)), /4,000/);
  assert.equal(signedDeviation('1e-300', '1e300'), null);
});
