import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASELINE,
  EDGE,
  defaults,
  simulate,
  rawAt,
  rms,
  magnitude,
  response,
  rcStep,
  familyGain,
  aliasFrequency,
  quantize,
  sampleDemo,
  validate,
  METHODS,
  type Settings,
} from '../lib/noise-learning/model';
import { LESSONS, SYMBOLS } from '../lib/noise-learning/content';
import katex from 'katex';
const close = (a: number, b: number, tol = 1e-9) =>
  assert(Math.abs(a - b) <= tol, `${a} should be ${b}`);
test('MA matches direct causal convolution for all signal and disturbance types, including prehistory', () => {
  for (const wave of ['steady', 'step', 'pulse', 'sine'] as const)
    for (const noise of ['random', 'periodic', 'drift'] as const) {
      const s = { ...defaults(), wave, noise, window: 17, rate: 125 },
        r = simulate(s);
      for (const k of [0, 1, 12, 63, 70, 150, 250])
        close(
          r.traces.ma.values[k],
          Array.from({ length: s.window }, (_, i) =>
            rawAt((k - i) / s.rate, s),
          ).reduce((a, b) => a + b, 0) / s.window,
          1e-10,
        );
    }
});
test('EMA follows its recurrence at every point with correct settled initialization', () => {
  for (const wave of ['steady', 'step', 'pulse', 'sine'] as const)
    for (const alpha of [0.01, 0.2, 1]) {
      const s = { ...defaults(), wave, alpha },
        r = simulate(s);
      let previous = r.previousEma;
      r.traces.raw.values.forEach((v, k) => {
        const y = alpha * v + (1 - alpha) * previous;
        close(r.traces.ema.values[k], y, 1e-10);
        previous = y;
      });
    }
});
test('RC cutoff, continuous-time step, time constant, delay and pulse peak have independent analytical values', () => {
  const s = { ...defaults(), wave: 'step' as const, noiseRms: 0 },
    r = simulate(s),
    tau = s.resistance * s.capacitance;
  close(magnitude(response('rc', 1 / (2 * Math.PI * tau), s)), 1 / Math.SQRT2);
  close(
    r.traces.rc.values[Math.round((EDGE + tau) * s.rate)],
    BASELINE + s.amplitude * (1 - Math.exp(-1)),
  );
  close(rcStep(tau, tau), 1 - Math.exp(-1));
  close(rcStep(-0.1, tau), 0);
  const expected =
    Math.ceil((EDGE + Math.log(10) * tau) * s.rate - 1e-10) / s.rate - EDGE;
  close(r.metrics.rc.delay!, expected * 1000);
  const p = simulate({ ...s, wave: 'pulse', pulseWidth: 0.02 });
  close(p.metrics.rc.pulse!, 100 * (1 - Math.exp(-0.02 / tau)));
  const slower = simulate({ ...s, capacitance: s.capacitance * 2 });
  assert(slower.metrics.rc.delay! > r.metrics.rc.delay!);
});
test('Digital all-pass limits preserve RAW, MA has theoretical tone zeros and EMA has its DC gain', () => {
  const s = { ...defaults(), wave: 'sine' as const, window: 1, alpha: 1 },
    r = simulate(s);
  for (const method of ['ma', 'ema'] as const)
    r.traces[method].values.forEach((v, k) => close(v, r.traces.raw.values[k]));
  close(magnitude(response('ma', 50, { ...s, window: 10, rate: 500 })), 0);
  close(magnitude(response('ema', 0, { ...s, alpha: 0.01 })), 1);
  close(familyGain('lowpass', 10, 10), 1 / Math.SQRT2);
  close(familyGain('highpass', 10, 10), 1 / Math.SQRT2);
  close(familyGain('notch', 10, 10), 0);
  assert(familyGain('bandpass', 10, 10) > familyGain('bandpass', 0.2, 10));
});
test('Inputs remain identical across filter edits and noise changes only on explicit seed changes', () => {
  const a = simulate(defaults()),
    b = simulate({ ...defaults(), window: 51, alpha: 0.02, capacitance: 1e-5 });
  assert.deepEqual(a.traces.raw, b.traces.raw);
  const fresh = simulate({ ...defaults(), seed: 43 });
  assert.notDeepEqual(a.traces.raw.noise, fresh.traces.raw.noise);
  assert.deepEqual(a.traces.raw.clean, fresh.traces.raw.clean);
  for (const rate of [125, 500]) {
    const s = { ...defaults(), rate };
    const r = simulate(s);
    for (const i of [0, 25, 100])
      close(r.traces.raw.values[i], rawAt(i / rate, s));
  }
});
test('Noise RMS excludes DC; SNR uses separately filtered useful and disturbance components', () => {
  close(rms([2, 2, 2], true), 0);
  close(rms([2, 2, 2]), 2);
  close(rms([1, -1], true), 1);
  const r = simulate({
    ...defaults(),
    wave: 'sine',
    noise: 'periodic',
    noiseFrequency: 70,
  });
  for (const method of METHODS) {
    const t = r.traces[method],
      m = r.metrics[method];
    close(m.noise, rms(t.noise, true));
    close(
      m.signal!,
      rms(
        t.clean.map((v) => v - BASELINE),
        true,
      ),
    );
    close(m.snr!, 20 * Math.log10(m.signal! / m.noise));
  }
  close(r.metrics.raw.signal!, defaults().amplitude / Math.SQRT2, 0.001);
  for (const s of [
    { ...defaults(), wave: 'sine' as const, noiseRms: 0 },
    { ...defaults(), wave: 'sine' as const, amplitude: 0 },
  ])
    for (const method of METHODS)
      assert.equal(simulate(s).metrics[method].snr, null);
});
test('Step and pulse measurements use noise-free output; an unseen threshold stays unavailable', () => {
  const a = simulate({ ...defaults(), wave: 'step' }),
    b = simulate({ ...defaults(), wave: 'step', noiseRms: 0.5, seed: 99 });
  for (const method of METHODS)
    assert.equal(a.metrics[method].delay, b.metrics[method].delay);
  assert.equal(
    simulate({
      ...defaults(),
      wave: 'step',
      resistance: 100000,
      capacitance: 1e-5,
    }).metrics.rc.delay,
    null,
  );
  const short = simulate({ ...defaults(), pulseWidth: 0.01 }),
    long = simulate({ ...defaults(), pulseWidth: 0.5 });
  for (const method of ['rc', 'ma', 'ema'] as const)
    assert(short.metrics[method].pulse! < long.metrics[method].pulse!);
});
test('Aliasing folds correctly; analog attenuation precedes ADC, digital smoothing follows it', () => {
  close(aliasFrequency(60, 80), 20);
  close(aliasFrequency(180, 200), 20);
  close(aliasFrequency(10, 80), 10);
  close(aliasFrequency(80, 80), 0);
  const a = sampleDemo({
      frequency: 60,
      rate: 80,
      bits: 12,
      amplitude: 1,
      analog: false,
      digital: false,
    }),
    b = sampleDemo({
      frequency: 60,
      rate: 80,
      bits: 12,
      amplitude: 1,
      analog: false,
      digital: true,
    });
  assert.deepEqual(a.adc, b.adc);
  const c = sampleDemo({
    frequency: 60,
    rate: 80,
    bits: 12,
    amplitude: 1,
    analog: true,
    digital: true,
  });
  assert(c.gain < 0.15);
  assert.notDeepEqual(a.adc, c.adc);
  assert.equal(c.alias, a.alias);
  // At all sample instants, 60 Hz and a sign-reversed 20 Hz sine coincide.
  a.times.forEach((t, i) =>
    close(a.input[i], BASELINE - Math.sin(2 * Math.PI * 20 * t), 1e-10),
  );
});
test('Quantizer rounds levels, clips at rails and reports error including clipping', () => {
  close(quantize(0, 2), 0);
  close(quantize(3.3, 2), 3.3);
  close(quantize(1.2, 2), 1.1);
  close(quantize(-2, 12), 0);
  close(quantize(10, 12), 3.3);
  const a = sampleDemo({
    frequency: 4,
    rate: 80,
    bits: 12,
    amplitude: 1,
    analog: false,
    digital: false,
  });
  const b = sampleDemo({
    frequency: 4,
    rate: 80,
    bits: 2,
    amplitude: 1,
    analog: false,
    digital: false,
  });
  assert(a.error < b.error);
  const clipped = sampleDemo({
    frequency: 4,
    rate: 80,
    bits: 12,
    amplitude: 3,
    analog: false,
    digital: false,
  });
  assert(clipped.clipped > 0);
  assert(clipped.adc.every((v) => v >= 0 && v <= 3.3));
  close(clipped.error, rms(clipped.adc.map((v, i) => v - clipped.input[i])));
});
test('Parameter bounds reject invalid inputs; extremes stay finite and records remain bounded', () => {
  for (const patch of [
    { window: 0 },
    { window: 3.5 },
    { rate: Infinity },
    { alpha: 0 },
    { capacitance: -1 },
    { seed: NaN },
    { wave: 'broken' },
    { noise: 'broken' },
  ])
    assert.throws(() => validate({ ...defaults(), ...patch } as Settings));
  for (const patch of [
    {
      rate: 25,
      window: 101,
      alpha: 0.01,
      resistance: 100000,
      capacitance: 1e-5,
    },
    { rate: 2000, window: 1, alpha: 1, resistance: 1000, capacitance: 1e-8 },
  ]) {
    const r = simulate({ ...defaults(), ...patch });
    assert(r.times.length <= 4001);
    for (const m of METHODS) assert(r.traces[m].values.every(Number.isFinite));
  }
  assert(
    simulate({ ...defaults(), rate: 25 }).warnings.some((v) =>
      v.includes('aliases'),
    ),
  );
  assert(
    simulate({ ...defaults(), rate: 25, pulseWidth: 0.01 }).warnings.some((v) =>
      v.includes('pulse'),
    ),
  );
  assert.throws(() =>
    sampleDemo({
      frequency: 60,
      rate: NaN,
      bits: 6,
      amplitude: 1,
      analog: false,
      digital: false,
    }),
  );
});
test('Every authored equation renders as mathematics and concept content is independent', () => {
  assert.equal(LESSONS.length, 7);
  for (const lesson of LESSONS) {
    for (const [tex] of lesson.equations)
      assert(
        katex
          .renderToString(tex, { strict: 'error', throwOnError: true })
          .includes('<math'),
      );
    assert(
      !/pre.?lab|PRE-P|UC-W12|student id|submit/i.test(JSON.stringify(lesson)),
    );
  }
});

test('Every visible symbol key renders as mathematics', () => {
  for (const entries of Object.values(SYMBOLS))
    for (const [tex] of entries)
      assert(
        katex
          .renderToString(tex, { strict: 'error', throwOnError: true })
          .includes('<math'),
      );
});
