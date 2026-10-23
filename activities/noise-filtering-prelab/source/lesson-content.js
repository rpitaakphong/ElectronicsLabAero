function equation(id, compact = false) {
  const item = EQUATIONS[id];
  if (!item) throw new Error('Unknown authored equation: ' + id);
  return `<div class="lesson-equation${compact ? ' compact' : ''}" data-equation="${id}" aria-label="${item.label}">${item.html}</div>`;
}

function fig(key, caption) {
  const settings = {
    mechanism: ['diagramMA'],
    rc: ['comparisonRC'],
    step: ['comparisonRC', 'comparisonMA', 'comparisonEMA'],
    pulse: ['comparisonRC', 'comparisonMA', 'comparisonEMA'],
    'rc-pred': ['rcExerciseA', 'rcExerciseB'],
    'ema-pred': ['emaExerciseA', 'emaExerciseB'],
    choice: ['choiceA', 'choiceB', 'choiceC'],
  };
  const legend = settings[key]
    ? `<div class="figure-equations">${settings[key].map((id) => equation(id, true)).join('')}</div>`
    : '';
  return `<figure class="lesson-figure ${['chain', 'mechanism', 'predict', 'handoff', 'export'].includes(key) ? 'diagram' : ''}" aria-label="${key} teaching figure">${FIGURES[key]}${legend}<figcaption>${caption}</figcaption></figure>`;
}

const sharedNote = `<div class="source-note"><p>SIMULATION: 1,000 samples/s; 2.00 V baseline; +0.50 V step at 0.300 s; +0.50 V pulse from 1.100 to 1.125 s. Added two-tone disturbance, with time in seconds:</p>${equation('sharedNoise')}<p>This is not general random noise. Two seconds of baseline prehistory settle the filters.</p></div>`;

function screen0() {
  return (
    head(
      0,
      'Implementation v1.0.0',
      'Keep the useful signal. Reduce the unwanted variation.',
      'Your goal: defend a filtering choice against noise, response-time and event requirements.',
    ) +
    `<div class="paper sheet"><div class="callout"><strong>Version 1.0.0 · approved pre-lab design.</strong> Hardware-free preparation for Monday 26 October 2026. Allow about 45–60 minutes. Follow the separately published assignment for deadline and submission requirements.</div>
    ${fig('input', 'The dashed reference contains a real sustained change and a short event. The noisy input is the same signal plus an unwanted disturbance. All values are synthetic.')}
    <p>We will ask whether reducing the ripple is worth delaying the change or hiding the pulse. You will see an example, calculate a few samples, predict a new result, then make a choice for a different signal.</p>
    <div class="grid2">${field('studentId', 'University student ID', '', 'input')}${field('studentName', 'Full name', '', 'input')}</div>
    <p>Save JSON regularly. This implementation starts a separate browser record from R3 and R4. Use Restore to import a compatible R4 JSON backup explicitly. R3 exercises differ and cannot be imported. Keep your original files and backups.</p>
    <details><summary>How the individual evidence works</summary><p>Preserve your two first predictions before optional coaching and comparison plots. Revise in your own words. Close AI for the independent choice. Finalize only after reviewing; finalization locks responses. Downloading is not LMS submission. Follow the published assignment for deadlines.</p></details>
    <p>No hardware work is required or authorized. Your measurement instructor selects the actual apparatus and procedures. This pre-lab does not certify laboratory skill or independent mastery.</p></div>`
  );
}

function screen1() {
  return (
    head(
      1,
      'Where to intervene',
      'Analog before sampling. Digital after sampling.',
      'The location matters because information lost at the ADC may be unrecoverable.',
    ) +
    `<div class="paper sheet">${fig('chain', 'Three alternatives can be compared: an RC before the ADC, or MA/EMA on raw ADC samples. Cascading filters is a separate design; the worked curves here compare alternatives.')}
    <p>First investigate the source: a bad connection, clipping or an offset calls for a different remedy from unwanted ripple. A short genuine event is useful signal even if it changes quickly.</p>
    <details><summary>Why digital smoothing cannot generally undo aliasing</summary>
    <p>At 1,000 samples/s, a 900 Hz cosine and a 100 Hz cosine give identical sample values at integer sample times. Once sampled, those values alone cannot tell which frequency was present. Reducing out-of-band content before the ADC can prevent ambiguity; filtering afterward cannot generally recover the missing distinction.</p>
    ${equation('alias')}
    <p>The Nyquist frequency here is:</p>${equation('nyquist')}
    <p>An RC is not a brick-wall filter. Choosing its cutoff below 500 Hz does not establish sufficient anti-alias attenuation. Adequacy depends on the actual unwanted spectrum, required bandwidth and allowed error.</p></details>
    <div class="callout">The worked disturbance is 65 and 110 Hz, both below 500 Hz. This example shows smoothing costs; it does not test or certify anti-alias protection.</div>${sharedNote}</div>`
  );
}

function screen2() {
  return (
    head(
      2,
      'Worked evidence',
      'Measure variation in a steady window',
      'Keep the real step and pulse out of your noise-estimation window.',
    ) +
    `<div class="paper sheet">${fig('steady', 'The steady mean is 2 V. Variation about that mean estimates disturbance here. Total voltage RMS would mainly describe the baseline.')}
    <h2>Mean and RMS variation</h2>${equation('mean')}${equation('noiseRMS')}
    <p>For a record of N samples, subtract the steady mean before estimating noise. The sample values and their RMS variation have the same units.</p>
    <h3>Worked small record</h3>${equation('workedRecord')}${equation('workedMean')}
    <p>This is finite-record RMS variation, not the unbiased sample-standard-deviation estimator.</p>
    <p>For our shared simulation, the 0.050–0.250 s steady window gives input noise RMS <strong>0.0825 V</strong>. Compare the same window, input, units and sampling conditions for every output.</p>
    <details><summary>SNR: useful, but not the whole decision</summary>${equation('snr')}
    <p>Use consistently defined useful-signal and noise RMS amplitudes, in the same units. For a 0.20 V RMS signal and 0.020 V RMS noise:</p>${equation('snrExample')}
    <p>If both are halved, SNR stays the same. Specify the useful component and bandwidth; do not call the DC baseline the signal amplitude without saying so. A brief pulse also needs its own height and delay check. Zero observed variation means a resolution or record limit, not proven noiseless hardware.</p></details>
    ${field('practiceNoise', 'Optional: why is total RMS unsuitable as noise RMS here?')}</div>`
  );
}

function screen3() {
  return (
    head(
      3,
      'Worked RC example',
      'The capacitor smooths ripple and rounds real changes',
      'This ideal analog model acts on the continuous voltage before the ADC.',
    ) +
    `<div class="paper sheet">${fig('rc', 'Same noisy input and known reference. The RC output rises gradually even though the reference changes abruptly.')}
    <h2>Time constant and cutoff</h2>${equation('rcTime')}${equation('rcCutoff')}
    <h3>Step response</h3>${equation('rcStep')}
    <p>Here, Δt is the elapsed time since the step. At one time constant (20 ms), the output has completed 63.2% of an ideal step. The continuous response reaches 90% at approximately:</p>${equation('rc90')}
    <p>On a 1 ms sampling grid, the first sample at or above 90% is 47 ms after the step. A short event can end before the output reaches its true height.</p>
    <details><summary>Exact model and limits</summary>${equation('rcParameters')}
    <p>Assume negligible loading and ideal components. The curves use exact continuous-time step/pulse responses plus each sine’s amplitude ratio and phase shift:</p>${equation('rcGain')}${equation('rcPhase')}
    <p>The result is then sampled at 1 ms. We do not use an arbitrary sketched curve or assume a real lab circuit has these values. Source resistance, tolerances and ADC loading are excluded.</p></details>${sharedNote}</div>`
  );
}

function screen4() {
  return (
    head(
      4,
      'Work through the mechanism',
      'Average a window, or retain a fading memory',
      'Both digital filters use only present and past samples.',
    ) +
    `<div class="paper sheet">${fig('mechanism', 'Different memory rules produce different responses. State startup conditions before calculating.')}
    <h2>Moving average</h2>${equation('ma')}
    <h2>Exponential moving average</h2>${equation('ema')}
    <h3>Worked example, not your exercise</h3>
    <p>A 5-point trailing MA window contains 2, 2, 2, 2 and 6 V:</p>${equation('maExample')}
    <p>For the EMA, start with a previous output of 2 V. The next two inputs are both 6 V:</p>${equation('emaExample')}
    <details><summary>Your different hand-calculation exercise</summary>
    <p>Use this sample rate and these three input samples:</p>${equation('handRate')}${equation('handSamples')}
    <p>For the moving average, use the following window and defined prehistory. Divide by the full window size from the first output:</p>${equation('handMA')}
    <p>For the EMA, use this coefficient and initial output:</p>${equation('handEMA')}
    <p>Calculate the following outputs for each method, with substitutions:</p>${equation('handOutputs')}
    <p>Explain why the two memories differ. This is a numerical teaching stream, not a specified ADC voltage range.</p>
    ${field('maWork', 'Your 3-point MA calculations (required)')}${field('emaWork', 'Your EMA calculations and memory explanation (required)')}</details>
    <details><summary>Compare the shared simulation after the mechanism</summary>
    ${fig('step', 'All three settings have approximately 20 ms low-frequency delay, but different step shapes. This does not mean identical threshold delay.')}
    ${fig('pulse', 'The pulse begins and ends at the same times in every case. The 80% line is an illustrative event requirement, not a bench specification.')}
    <div class="scrolltable"><table><thead><tr><th>Method</th><th>Noise RMS (V)</th><th>Step to 90% (ms)</th><th>Pulse height retained</th></tr></thead><tbody>
    <tr><td>Input</td><td>0.0825</td><td>0</td><td>100%</td></tr>
    <tr><td>${equation('comparisonRC', true)}</td><td>0.0091</td><td>47</td><td>71.3%</td></tr>
    <tr><td>${equation('comparisonMA', true)}</td><td>0.0080</td><td>36</td><td>61.0%</td></tr>
    <tr><td>${equation('comparisonEMA', true)}</td><td>0.0090</td><td>47</td><td>70.5%</td></tr>
    </tbody></table></div>
    <p>If the example requires both of the following:</p>${equation('comparisonNoise')}${equation('comparisonPulse')}
    <p>None of these illustrative settings is acceptable. Retune or reconsider the treatment. A smoother trace alone is insufficient.</p>
    <p>The MA uses 41 trailing samples. The EMA is initialized to 2 V with 2 s prehistory. Their low-frequency delays are:</p>${equation('maDelay')}${equation('emaDelay')}
    <p class="source-note">Matching that one property does not match bandwidth or step shape. Settings are illustrative, not optimized; these two tones can favor a window length. No method is universally superior. Noise RMS uses the steady window; timing and pulse retention use the known noise-free output component, not noisy peaks. Loading, clipping and quantization are omitted.</p>${sharedNote}</details></div>`
  );
}

function prediction(n) {
  const p = 'p' + n;
  const f = state.frozen[p];
  const one = n === 1;
  const context = one
    ? `<p><strong>New RC exercise:</strong> use the same shared input with these two component settings:</p>${equation('rcExerciseA')}${equation('rcExerciseB')}<p>Assume ideal negligible loading. Calculate the time constant and cutoff for both, with units. Before viewing the outputs, predict the effect on steady ripple, the step and the 25 ms pulse. Would smoother alone justify B?</p>`
    : `<p><strong>New EMA prediction:</strong> use the same shared sampled input at 1,000 samples/s and these two coefficients:</p>${equation('emaExerciseA')}${equation('emaExerciseB')}<p>Both begin at the 2 V baseline with 2 s prehistory. Predict ripple, step response and the 25 ms pulse before viewing outputs. State which observation would challenge your prediction. No extra arithmetic is required.</p>`;
  return (
    head(
      one ? 5 : 6,
      one ? 'Predict RC' : 'Predict EMA',
      'Predict → preserve → inspect → revise',
      'Keep the initial prediction even when the plot changes your mind.',
    ) +
    `<div class="paper sheet">${fig('predict', 'The comparison becomes available only after you preserve the first attempt. It is evidence for revision, not an answer prefilled into your work.')}${context}
    ${
      f
        ? `<h2>Original preserved</h2><div class="locked">Prediction: ${esc(f.first)}\nReason: ${esc(f.reason)}\nAssumption: ${esc(f.assumption)}\nUncertainty: ${esc(f.uncertainty)}</div>
    <details><summary>Inspect the simulated comparison</summary>${fig(one ? 'rc-pred' : 'ema-pred', 'Both outputs receive the same synthetic input. Compare with the dashed clean reference; then write what the evidence supports and what remains uncertain.')}<p>These are the stated ideal models. No measured lab behavior is implied. A sinusoidal steady-state response is used for RC; EMA follows the causal recurrence. The same baseline prehistory is used.</p></details>
    <section class="coach-support" aria-label="Optional AI coaching">
    <p>Optional AI help: the full coach instructions and your preserved reasoning are included in one prompt. Paste it into your chosen AI tool; no separate file is needed.</p>
    <div class="coach-actions">
      <button class="btn light" data-coach-show="${p}" aria-controls="coach-panel-${p}" aria-expanded="false">Show full coach prompt</button>
      <button class="btn light" data-coach-copy="${p}" aria-controls="coach-panel-${p}">Copy full coach prompt</button>
    </div>
    <div id="coach-panel-${p}" class="coach-panel" hidden>
      <label class="field" for="prompt-${p}">Full coach prompt for PRE-P0${n}</label>
      <textarea id="prompt-${p}" class="coach-prompt" readonly rows="12" spellcheck="false" wrap="soft" aria-describedby="coach-help-${p} coach-status-${p}"></textarea>
      <p id="coach-help-${p}" class="source-note">The coach rules come first, followed by this case’s preserved reason and uncertainty. Check your own wording before pasting. You can select the text and use your device’s normal Copy command.</p>
      <button class="btn light" data-coach-select="${p}">Select all</button>
      <p id="coach-status-${p}" class="status-line" role="status" aria-live="polite"></p>
    </div>
    </section>
    ${field(p + 'help', 'Support used (or none)')}${field(p + 'revision', 'Your revision after inspecting the comparison', 'Describe agreement or disagreement with your first attempt, evidence and remaining uncertainty.')}`
        : `${field(p + 'first', '1 · Your prediction and calculation where requested')}${field(p + 'reason', '2 · Why should that happen?')}${field(p + 'assumption', '3 · Model assumption')}${field(p + 'uncertainty', '4 · Uncertainty or missing information')}
    <button class="btn primary" data-freeze="${p}">Preserve my first attempt</button><p>Write an honest uncertainty where needed. No automatic correctness mark is assigned.</p>`
    }</div>`
  );
}

function screen7() {
  return (
    head(
      7,
      'Independent transfer',
      'Choose settings for a different signal',
      'Close AI. Use your own reasoning and the supplied evidence; do not paste this check into AI.',
    ) +
    `<div class="paper sheet"><p><strong>New simulated case:</strong> 1,000 samples/s, 1 V baseline; +0.4 V step at 0.200 s, +0.4 V pulse lasting 100 ms from 0.800 s. The disturbance is:</p>${equation('transferNoise')}
    <p>Time is in seconds. All options use identical raw samples and 2 s baseline prehistory.</p>
    ${fig('choice', 'Identical axes and input; three supplied candidate settings. No option is selected for you.')}
    <p><strong>Illustrative requirements:</strong> steady noise RMS, first sampled 90% step response and pulse height must satisfy all three limits:</p>
    ${equation('transferNoiseLimit')}${equation('transferDelayLimit')}${equation('transferPulseLimit')}
    <p>These are exercise requirements, not approved apparatus specifications.</p>
    <div class="scrolltable"><table><thead><tr><th>Candidate</th><th>Noise RMS (V)</th><th>90% time (ms)</th><th>Pulse retained (%)</th></tr></thead><tbody>
    <tr><td>${equation('choiceA', true)}</td><td>0.0220</td><td>10</td><td>100.0</td></tr>
    <tr><td>${equation('choiceB', true)}</td><td>0.0043</td><td>56</td><td>98.3</td></tr>
    <tr><td>${equation('choiceC', true)}</td><td>0.0037</td><td>9</td><td>100.0</td></tr>
    </tbody></table></div>
    <p class="source-note">Noise: 0.050–0.150 s, mean removed. Event metrics: known noise-free model components, first sample crossing and peak fraction. EMA output starts at 1 V; MA uses its full trailing window after 2 s warmup. Noise tones are below Nyquist; no clipping/quantization or actual sensor dynamics are included.</p>
    <h2>UC-W12-01</h2><p>Choose a candidate, or reject all, against <em>each</em> requirement. Cite evidence and one limitation. Would your decision necessarily hold for a different disturbance spectrum? Explain.</p>
    <h2>UC-W12-02</h2><p>A teammate reports total voltage RMS as noise RMS and proposes digital smoothing after an aliased ADC record. Explain both issues and name a comparison you would request before accepting the treatment.</p>
    ${
      state.frozen.check
        ? `<div class="locked">${esc(state.frozen.check.check1)}\n\n${esc(state.frozen.check.check2)}</div>`
        : `${field('check1', 'Your independent choice and justification')}${field('check2', 'Your independent measurement/placement explanation')}<button class="btn primary" data-freeze="check">Preserve my independent responses</button>`
    }
    <p>If an answer was exposed, disclose that on screen 9 and ask the instructor for an alternative check. Completion is not proof of independent mastery.</p></div>`
  );
}

function screen8() {
  return (
    head(
      8,
      'Verify and hand off',
      'What evidence would change your decision?',
      'A simulation supports a model-based prediction. It is not a measurement of Monday’s apparatus.',
    ) +
    `<div class="paper sheet">${fig('handoff', 'Bring a comparison to discuss. The measurement instructor keeps control of the actual sensor, circuit, safety procedure and sampling plan.')}
    ${field('aiUsed', 'AI use (none, or tool and topics)')}${field('aiExposure', 'Assigned-answer exposure / independence status (none, or explain)')}${field('claim', 'One claim you relied on')}${field('verification', 'How you checked the claim', 'Show a separate calculation, principle, or reliable source; AI agreement is not verification.')}${field('limitation', 'What the simulation cannot establish')}${field('handoff', 'A proposed in-class comparison', 'Name raw/processed evidence, units, window, event and a criterion. Label proposals as proposals; do not invent measured results.')}</div>`
  );
}

function screen9() {
  return legacyScreen9()
    .replace(
      '<div class="paper sheet">',
      '<div class="paper sheet">' +
        fig(
          'export',
          'Download and inspect your evidence. Saving is not LMS submission.',
        ),
    )
    .replace(
      'Teaching basis: approved Week 12',
      'Implementation v1.0.0. Teaching basis: Week 12',
    );
}

function renderReport(container) {
  container.replaceChildren();
  container.classList.add('report-preview');
  const text = (tag, value) => {
    const element = document.createElement(tag);
    element.textContent = value;
    container.appendChild(element);
  };
  const math = (id) => {
    // Only pre-rendered, author-controlled MathML enters HTML. Student writing stays literal.
    container.insertAdjacentHTML('beforeend', equation(id));
  };
  const printed = container.id === 'print-report';
  const sectionHeading = printed ? 'h2' : 'h3';
  text(printed ? 'h1' : 'h2', 'Week 12 · Individual pre-lab evidence');
  text('p', 'IMPLEMENTATION v1.0.0 · approved R4 instructional baseline');
  text('p', '2145427 · Week 12 · Noise, SNR and Filtering');
  text(
    'p',
    'Individual pre-lab evidence · ' +
      (state.finalized ? 'FINALIZED' : 'DRAFT'),
  );
  text(
    'p',
    'Student: ' + state.fields.studentName + ' | ' + state.fields.studentId,
  );
  text('p', 'Class: Monday 26 October 2026, 13:00–17:00 Asia/Bangkok');
  text('p', 'Hypothetical predictions only; no physical measurements.');
  text(sectionHeading, 'Hand calculations');
  for (const id of ['handRate', 'handSamples', 'handMA', 'handEMA']) math(id);
  text('p', 'MA: ' + state.fields.maWork);
  text('p', 'EMA: ' + state.fields.emaWork);
  for (const p of ['p1', 'p2']) {
    text(
      sectionHeading,
      p === 'p1' ? 'PRE-P01 · RC comparison' : 'PRE-P02 · EMA comparison',
    );
    text(
      'p',
      'ASSIGNED CASE: ' +
        (p === 'p1'
          ? 'Shared 25 ms pulse; calculate time constant and cutoff, predict before reveal, revise from comparison.'
          : 'Shared sampled input at 1,000 Hz; shared 25 ms pulse, predict before reveal and revise.'),
    );
    for (const id of p === 'p1'
      ? ['rcExerciseA', 'rcExerciseB']
      : ['emaExerciseA', 'emaExerciseB'])
      math(id);
    const original = state.frozen[p];
    for (const [label, value] of [
      ['ORIGINAL', original?.first || 'Not preserved'],
      ['REASON', original?.reason || ''],
      ['ASSUMPTION', original?.assumption || ''],
      ['UNCERTAINTY', original?.uncertainty || ''],
      ['SUPPORT', state.fields[p + 'help']],
      ['REVISION', state.fields[p + 'revision']],
    ])
      text('p', label + ': ' + value);
  }
  text(sectionHeading, 'Independent check');
  text(
    'p',
    'UC-W12-01: new 100 ms pulse; compare the three supplied settings against all requirements. Justify with limitations.',
  );
  for (const id of [
    'transferNoiseLimit',
    'transferDelayLimit',
    'transferPulseLimit',
  ])
    math(id);
  text('p', assignmentContext.check2);
  text('p', 'UC-W12-01: ' + (state.frozen.check?.check1 || 'Not preserved'));
  text('p', 'UC-W12-02: ' + (state.frozen.check?.check2 || 'Not preserved'));
  for (const [field, label] of [
    ['aiUsed', 'AI use'],
    ['aiExposure', 'Answer exposure / independence'],
    ['claim', 'Important claim'],
    ['verification', 'Verification'],
    ['limitation', 'Limitations'],
    ['handoff', 'Proposed in-class comparison'],
  ])
    text('p', label + ': ' + state.fields[field]);
  text(
    'p',
    'Local record timestamps (not proof of submission): ' +
      state.created +
      ' / ' +
      state.updated,
  );
  text(
    'p',
    'Save/export is not LMS submission. Follow the published assignment.',
  );
}
