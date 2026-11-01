const equation = (body, label) =>
  `<div class="equation" role="group" aria-label="${label}"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${body}</math></div>`;
const sub = (x, y) => `<msub><mi>${x}</mi><mi>${y}</mi></msub>`;
const sq = (x) => `<msup><mrow>${x}</mrow><mn>2</mn></msup>`;
const frac = (x, y) => `<mfrac><mrow>${x}</mrow><mrow>${y}</mrow></mfrac>`;
const hatx = '<mover><mi>x</mi><mo>^</mo></mover>';
const a0 = sub('a', '0'),
  a1 = sub('a', '1');
export const EQUATIONS = {
  calibration: equation(
    `<mi>t</mi><mo>=</mo>${a0}<mo>+</mo>${a1}<mi>x</mi>`,
    'Calibration: echo time equals intercept plus sensitivity times distance',
  ),
  inverse: equation(
    `${hatx}<mo>=</mo>${frac(`<mi>t</mi><mo>−</mo>${a0}`, a1)}`,
    'Calibrated distance equals echo time minus intercept, divided by sensitivity',
  ),
  mean: equation(
    `<mover><mi>t</mi><mo>¯</mo></mover><mo>=</mo>${frac('<munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>t</mi><mi>j</mi></msub>', '<mi>n</mi>')}`,
    'Mean of n valid included echo times',
  ),
  sd: equation(
    `${sub('s', 't')}<mo>=</mo><msqrt>${frac(`<munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>${sq('<mo>(</mo><msub><mi>t</mi><mi>j</mi></msub><mo>−</mo><mover><mi>t</mi><mo>¯</mo></mover><mo>)</mo>')}`, '<mi>n</mi><mo>−</mo><mn>1</mn>')}</msqrt>`,
    'Sample standard deviation: square root of summed squared deviations divided by n minus one',
  ),
  uncertainty: equation(
    `<mi>u</mi><mo>(</mo><mover><mi>t</mi><mo>¯</mo></mover><mo>)</mo><mo>=</mo>${frac(sub('s', 't'), '<msqrt><mi>n</mi></msqrt>')}<mo>,</mo><mspace width="1em"/><mi>u</mi><mo>(</mo><mi>q</mi><mo>)</mo><mo>=</mo>${frac('<mi>a</mi>', '<msqrt><mn>3</mn></msqrt>')}`,
    'For independent repeats: standard uncertainty of the mean is s divided by square root of n. For a uniform bound plus or minus a: standard uncertainty is a divided by square root of three',
  ),
  sensitivity: equation(
    `${sub('S', '0')}<mo>=</mo>${frac('<mn>20000</mn>', sub('c', '0'))}<mo>,</mo><mspace width="1em"/>${sub('c', '0')}<mo>=</mo><mn>340</mn><mtext> m/s (assumed)</mtext>`,
    'Nominal echo-time sensitivity in microseconds per centimetre is 20000 divided by assumed sound speed c zero, 340 metres per second',
  ),
  propagation: equation(
    `${sq(sub('u', 'reg'))}<mo>=</mo>${frac(`${sq(sub('u', 't'))}<mo>+</mo>${sq(`<mi>u</mi><mo>(</mo>${a0}<mo>)</mo>`)}<mo>+</mo>${sq(hatx)}${sq(`<mi>u</mi><mo>(</mo>${a1}<mo>)</mo>`)}<mo>+</mo><mn>2</mn>${hatx}<mi>cov</mi><mo>(</mo>${a0}<mo>,</mo>${a1}<mo>)</mo>`, sq(a1))}`,
    'Calculate distance variance from the echo time and fitted parameters: echo-time variance plus intercept variance plus distance squared times slope variance plus twice distance times slope-intercept covariance, all divided by slope squared',
  ),
  expanded: equation(
    `<mi>U</mi><mo>=</mo><mi>k</mi>${sub('u', 'c')}`,
    'Expanded uncertainty equals stated coverage factor times combined standard uncertainty',
  ),
};
const xb = '<mover><mi>x</mi><mo>¯</mo></mover>',
  sum = '<mo>∑</mo>',
  sx = sub('S', 'xx'),
  se = sub('s', 'e');
Object.assign(EQUATIONS, {
  spread: equation(
    `${sx}<mo>=</mo>${sum}${sq(`<mo>(</mo>${sub('x', 'j')}<mo>−</mo>${xb}<mo>)</mo>`)}`,
    'S xx is the sum of squared distances from their mean',
  ),
  slope: equation(
    `${a1}<mo>=</mo>${frac(`${sum}<mo>(</mo>${sub('x', 'j')}<mo>−</mo>${xb}<mo>)</mo><mo>(</mo>${sub('y', 'j')}<mo>−</mo><mover><mi>y</mi><mo>¯</mo></mover><mo>)</mo>`, sx)}`,
    'Fitted slope is the sum of products of centred distance and mean echo time, divided by S xx',
  ),
  intercept: equation(
    `${a0}<mo>=</mo><mover><mi>y</mi><mo>¯</mo></mover><mo>−</mo>${a1}${xb}`,
    'Fitted intercept is mean output minus slope times mean distance',
  ),
  residual: equation(
    `${sub('e', 'j')}<mo>=</mo>${sub('y', 'j')}<mo>−</mo><mo>(</mo>${a0}<mo>+</mo>${a1}${sub('x', 'j')}<mo>)</mo>`,
    'Residual is measured mean echo time minus fitted echo time',
  ),
  residualSD: equation(
    `${sq(se)}<mo>=</mo>${frac(`${sum}${sq(sub('e', 'j'))}`, '<mi>N</mi><mo>−</mo><mn>2</mn>')}`,
    'Residual variance estimate is the sum of squared residuals divided by the number of fitted means minus two',
  ),
  uSlope: equation(
    `<mi>u</mi><mo>(</mo>${a1}<mo>)</mo><mo>=</mo>${frac(se, `<msqrt>${sx}</msqrt>`)}`,
    'Standard uncertainty of slope for ordinary least squares',
  ),
  uIntercept: equation(
    `<mi>u</mi><mo>(</mo>${a0}<mo>)</mo><mo>=</mo>${se}<msqrt>${frac('<mn>1</mn>', '<mi>N</mi>')}<mo>+</mo>${frac(sq(xb), sx)}</msqrt>`,
    'Standard uncertainty of intercept for ordinary least squares',
  ),
  covariance: equation(
    `<mi>cov</mi><mo>(</mo>${a0}<mo>,</mo>${a1}<mo>)</mo><mo>=</mo><mo>−</mo>${frac(`${xb}${sq(se)}`, sx)}`,
    'Covariance of fitted intercept and slope for ordinary least squares',
  ),
  inverseSensitivity: equation(
    `<mi>S</mi><mo>=</mo>${a1}<mo>,</mo><mspace width="1em"/><mi>K</mi><mo>=</mo>${frac('<mn>1</mn>', a1)}`,
    'Echo-time sensitivity is the slope; the inverse conversion factor is one divided by slope',
  ),
  deviation: equation(
    `<mi>D</mi><mo>=</mo><mn>100</mn>${frac(`${a1}<mo>−</mo>${sub('S', '0')}`, sub('S', '0'))}<mtext> %</mtext>`,
    'Signed sensitivity deviation as a percentage of nominal sensitivity',
  ),
  span: equation(
    `${sub('r', 'o')}<mo>=</mo><mo>|</mo>${a1}<mo>|</mo><mo>(</mo>${sub('x', 'max')}<mo>−</mo>${sub('x', 'min')}<mo>)</mo>`,
    'Fitted output span is the magnitude of slope times the fitted distance range',
  ),
  offset: equation(
    `<mi>O</mi><mo>=</mo><mn>100</mn>${frac(`<mo>|</mo>${a0}<mo>|</mo>`, sub('r', 'o'))}<mtext> %FSO</mtext>`,
    'Extrapolated offset magnitude as a percentage of fitted output span',
  ),
  linearity: equation(
    `<mi>L</mi><mo>=</mo><mn>100</mn>${frac(`<mi>max</mi><mo>|</mo>${sub('e', 'j')}<mo>|</mo>`, sub('r', 'o'))}<mtext> %FSO</mtext>`,
    'Largest absolute mean-response residual as a percentage of output span',
  ),
  repeatability: equation(
    `<mi>R</mi><mo>=</mo><mn>100</mn>${frac(`<mn>2</mn>${sub('s', 't')}`, sub('r', 'o'))}<mtext> %FSO</mtext>`,
    'Optional two-standard-deviation repeatability convention as a percentage of output span',
  ),
  signedError: equation(
    `<mi>E</mi><mo>=</mo>${hatx}<mo>−</mo>${sub('x', 'ref')}`,
    'Signed error is calibrated distance minus ruler reference distance',
  ),
  ruler: equation(
    `<mi>u</mi><mo>(</mo><mi>q</mi><mo>)</mo><mo>=</mo>${frac('<mi>Δ</mi>', '<msqrt><mn>12</mn></msqrt>')}`,
    'For uniform rounding within half a ruler division, standard uncertainty is division spacing divided by square root of twelve',
  ),
  combined: equation(
    `${sq(sub('u', 'c'))}<mo>=</mo>${sum}${sq(sub('c', 'i'))}${sq(`<mi>u</mi><mo>(</mo>${sub('q', 'i')}<mo>)</mo>`)}<mo>+</mo><mn>2</mn><munder><mo>∑</mo><mrow><mi>i</mi><mo>&lt;</mo><mi>j</mi></mrow></munder>${sub('c', 'i')}${sub('c', 'j')}<mi>cov</mi><mo>(</mo>${sub('q', 'i')}<mo>,</mo>${sub('q', 'j')}<mo>)</mo>`,
    'First-order combined variance includes squared sensitivity coefficients times input variances and covariance terms',
  ),
});
export function repeatGuide() {
  return `<p>For each run and position, use the n valid readings you included. Each tⱼ is an echo duration in µs. Calculate their mean t̄ and sample standard deviation sₜ, both in µs. The standard deviation describes the spread of individual readings. It needs at least two included readings.</p>${EQUATIONS.mean}${EQUATIONS.sd}<p>Keep failed and excluded attempts in the CSV, state the number included, and explain exclusions. Calculate these results in your chosen software; the worksheet does not calculate them.</p>`;
}
export function mainFitGuide() {
  return `<ol><li><strong>Calculate a mean and sample standard deviation for each set.</strong>${repeatGuide()}</li><li><strong>Fit a line through the run-and-position means.</strong> Use one mean from each run and position as a point. Keep the three runs separate, with actual ruler distance x in cm on the horizontal axis and mean echo time in µs on the vertical axis. Leave the two check distances and tilted-target measurements out of the fit.${EQUATIONS.calibration}<p>Use your software to fit this straight line, allowing both the slope and intercept to vary. Here, t is the fitted echo time in µs, a₀ is the intercept in µs, and a₁ is the slope in µs/cm. Show the measured means and fitted line, identify the three runs, and label both axes with units.</p></li><li><strong>Find the sensitivity and inverse conversion factor.</strong>${EQUATIONS.inverseSensitivity}<p>The sensitivity S = a₁ tells you how much echo time changes for a 1 cm increase in distance. The inverse conversion factor K = 1/a₁ is in cm/µs and converts a change in echo time into a change in distance. Keep the full coefficient precision for later calculations.</p></li><li><strong>Record the results and prepare your files.</strong> Write the fitted equation and coefficients below, including units. Paste your analysis code if you used any. Save the calibration graph for upload with the original measurement CSV. Calculate the parameter uncertainties and covariance, and prepare the residual plot, in the individual post-lab.</li></ol>`;
}
export function fitGuide() {
  return `<ol><li><strong>Prepare the points for fitting.</strong> Use one point for each run and position. Let xⱼ be the actual ruler distance in cm and yⱼ be the mean echo time in µs. N is the total number of these points across all three runs; x̄ and ȳ are their averages. Keep the three runs identifiable and leave validation and tilted-target readings out of the fit.</li><li><strong>Fit the line and plot it.</strong> Fit both the slope and intercept using your chosen software.${EQUATIONS.calibration}<p>The slope a₁ is in µs/cm and the intercept a₀ is in µs. For ordinary least squares, use the equations below with more than two fitted points at distinct distances.</p>${EQUATIONS.spread}${EQUATIONS.slope}${EQUATIONS.intercept}<p>Calculate Sₓₓ from the distances, then the slope, then the intercept. Sₓₓ is in cm². Plot ruler distance horizontally and mean echo time vertically. Show the measured means and fitted line, identify the runs, and label both axes with units.</p></li><li><strong>Calculate and plot the residuals.</strong> Subtract the fitted echo time from each measured mean.${EQUATIONS.residual}${EQUATIONS.residualSD}<p>Each residual eⱼ is in µs. Plot residuals against ruler distance and look for patterns or differences among runs. Calculate the residual variance sₑ² using N − 2 because the line has two fitted parameters. Its square root, sₑ, is in µs.</p></li><li><strong>Estimate the coefficient uncertainties and covariance.</strong> Use sₑ and Sₓₓ from the same fit in these equations.${EQUATIONS.uSlope}${EQUATIONS.uIntercept}${EQUATIONS.covariance}<p>Report u(a₁) in µs/cm, u(a₀) in µs and cov(a₀,a₁) in µs²/cm. Keep the covariance sign: it describes how the fitted slope and intercept vary together. These formulas assume independent errors of approximately equal variance in the fitted means, an adequate straight-line model, and reference distances treated as fixed. Explain whether unequal repetition counts or shared run effects challenge those assumptions. Justify another fitting method if you use it. These coefficient uncertainties do not include every ruler or positioning uncertainty.</p></li><li><strong>Report sensitivity and the inverse conversion factor.</strong>${EQUATIONS.inverseSensitivity}<p>S = a₁ is the change in echo time for a 1 cm increase in distance, in µs/cm. K = 1/a₁ is in cm/µs and converts a time change into a distance change. Record the results, show your calculations or code, explain your fitting assumptions, and upload both plots. Retain coefficient precision for later calculations.</p></li></ol>`;
}
