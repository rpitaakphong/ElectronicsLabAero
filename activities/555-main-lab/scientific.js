// Native MathML keeps every equation available offline, including in print.
const safe = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const n = (value) => `<mn>${safe(value)}</mn>`;
export const v = (name, sub = '') => sub ? `<msub><mi>${safe(name)}</mi><mtext>${safe(sub)}</mtext></msub>` : `<mi>${safe(name)}</mi>`;
export const op = (symbol) => `<mo>${safe(symbol)}</mo>`;
export const unit = (text) => `<mspace width="0.25em"/><mtext>${safe(text)}</mtext>`;
export const row = (...parts) => `<mrow>${parts.join('')}</mrow>`;
export const frac = (a, b) => `<mfrac>${row(a)}${row(b)}</mfrac>`;
export const parens = (content) => row(op('('), content, op(')'));
export const math = (content, label) => `<div class="display-equation" role="group" aria-label="${safe(label)}"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${row(content)}</math></div>`;
export const valueLine = (symbol, sub, value, units) => math(row(v(symbol, sub), op('='), n(value), unit(units)), `${symbol}${sub ? ' ' + sub : ''} equals ${value} ${units}`);
export const range = (low, symbol, sub, high, units) => math(row(n(low), op('≤'), v(symbol, sub), op('≤'), n(high), unit(units)), `${symbol} ${sub} from ${low} to ${high} ${units}`);
export function timingEquations(astable) {
  const h = v('t', 'H'), l = v('t', 'L'), r1 = v('R', '1'), r2 = v('R', '2'), c = v('C');
  const formula = (body, label) => math(body, label);
  const forward = astable
    ? formula(row(h, op('≈'), n('0.693'), parens(row(r1, op('+'), r2)), c), 'HIGH time is approximately 0.693 multiplied by the sum of R1 and R2, multiplied by C')
      + formula(row(l, op('≈'), n('0.693'), r2, c), 'LOW time is approximately 0.693 times R2 times C')
      + formula(row(v('T'), op('='), h, op('+'), l), 'Period equals HIGH time plus LOW time')
      + formula(row(v('f'), op('='), frac(n(1), v('T'))), 'Frequency equals one divided by period')
      + formula(row(v('D', 'H'), op('='), n(100), frac(h, v('T')), unit('%')), 'HIGH duty cycle in percent is one hundred times HIGH time divided by period')
    : formula(row(v('t', 'W'), op('≈'), n('1.1'), v('R'), c), 'Pulse duration is approximately 1.1 times R times C');
  const inverse = astable
    ? ''
    : formula(row(v('R'), op('≈'), frac(v('t', 'W'), row(n('1.1'), c))), 'R is approximately the pulse duration divided by 1.1 times C');
  return `<section class="formula-sheet"><h3>Equations for the ${astable ? 'astable' : 'monostable'} circuit</h3><p>Use ohms, farads, and seconds. ${astable ? 'Select a capacitor and suitable HIGH and LOW times, calculate the required resistances, then recalculate the output using the resistor values you select.' : 'Select a capacitor and a pulse duration within the specified range. Calculate the required resistance, then recalculate the pulse duration using the resistor values you select.'}</p><div class="equation-grid">${forward}${inverse}</div></section>`;
}
export function analysisEquations() {
  return `<div class="equation-grid">${math(row(v('δ', 'timing'), op('='), n(100), frac(row(v('x', 'meas'), op('−'), v('x', 'pred')), v('x', 'pred')), unit('%')), 'Signed timing deviation in percent')}${math(row(v('Δ', 'duty'), op('='), v('D', 'H, meas'), op('−'), v('D', 'H, pred'), unit('pp')), 'Duty cycle difference in percentage points')}${math(row(v('k', 'frequency'), op('='), frac(v('f', 'Lab 2, meas'), v('f', 'Lab 1, meas'))), 'Ratio of the measured Lab 2 frequency to the measured Lab 1 frequency')}</div>`;
}
