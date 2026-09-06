import './dom-setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import type { LabTool, LabContext } from '../lib/opamp/browser-tools';
import { cloneDefault } from '../lib/opamp/simulator';
afterEach(() => {
  cleanup();
  delete (document as Document & { modelContext?: LabContext }).modelContext;
});

test('circuit selection preserves signal settings and updates schematic and equation', async () => {
  const user = userEvent.setup();
  render(<App />);
  assert.deepEqual(
    screen
      .getAllByRole('radio')
      .map((control) => control.closest('label')?.textContent),
    [
      '01Comparator',
      '02Buffer',
      '03Non-inverting',
      '04Inverting',
      '05Summing',
      '06Low-pass',
    ],
  );
  assert.equal(
    screen
      .getByRole('radio', { name: /Comparator/ })
      .getAttribute('aria-checked'),
    'true',
  );
  assert.match(
    screen.getByRole('combobox', { name: 'Vertical scale' }).textContent ?? '',
    /Auto fit/,
  );
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Input 1 amplitude' }),
    { target: { value: '1.25' } },
  );
  await user.click(screen.getByRole('radio', { name: /Non-inverting/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input 1 amplitude',
      }) as HTMLInputElement
    ).value,
    '1.25',
  );
  assert.ok(screen.getByRole('heading', { name: 'Non-inverting amplifier' }));
  assert.ok(screen.getByLabelText(/Gain = 1 \+ 20 kΩ \/ 10 kΩ = \+3 V\/V/));
  assert.ok(screen.getByRole('img', { name: /Non-inverting amplifier/ }));
});
test('resistor controls update gain and schematic; invalid input does not reach simulation', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('radio', { name: /Inverting/ }));
  await user.click(screen.getByRole('tab', { name: 'Circuit' }));
  const rf = screen.getByRole('spinbutton', { name: 'Feedback Rf' });
  fireEvent.change(rf, { target: { value: '40' } });
  assert.ok(screen.getByLabelText(/Gain = −40 kΩ \/ 10 kΩ = −4 V\/V/));
  assert.ok(screen.getByText('Rf 40 kΩ'));
  fireEvent.change(rf, { target: { value: '-5' } });
  assert.ok(screen.getByRole('alert'));
  assert.ok(screen.getByText('Rf 40 kΩ'));
  fireEvent.blur(rf);
  assert.equal((rf as HTMLInputElement).value, '40');
});
test('reset lab restores the default signal', async () => {
  const user = userEvent.setup();
  render(<App />);
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Input 1 amplitude' }),
    { target: { value: '2' } },
  );
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input 1 amplitude',
      }) as HTMLInputElement
    ).value,
    '2',
  );
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input 1 amplitude',
      }) as HTMLInputElement
    ).value,
    '0.5',
  );
});
test('summing exposes a second source and comparator hides irrelevant components', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('radio', { name: /Summing/ }));
  assert.ok(screen.getByRole('spinbutton', { name: 'Input 2 phase' }));
  await user.click(screen.getByRole('radio', { name: /Comparator/ }));
  assert.equal(
    screen.queryByRole('spinbutton', { name: 'Input 2 phase' }),
    null,
  );
  await user.click(screen.getByRole('tab', { name: 'Circuit' }));
  assert.ok(screen.getByRole('spinbutton', { name: 'Threshold Vref' }));
  assert.equal(screen.queryByRole('spinbutton', { name: 'Feedback Rf' }), null);
  assert.ok(screen.getByRole('spinbutton', { name: 'Output LOW' }));
  assert.ok(screen.getByRole('spinbutton', { name: 'Output HIGH' }));
  assert.equal(screen.queryByRole('tab', { name: 'Limits' }), null);
  assert.equal(screen.queryByRole('switch', { name: 'Practical mode' }), null);
});
test('optional browser-tool registration updates visible state and rejects invalid input', async () => {
  const registered = new Map<string, LabTool>(),
    signals: AbortSignal[] = [];
  (document as Document & { modelContext?: LabContext }).modelContext = {
    registerTool: (tool, options) => {
      registered.set(tool.name, tool);
      if (options?.signal) signals.push(options.signal);
    },
  };
  const { unmount } = render(<App />);
  assert.equal(registered.size, 2);
  const config = cloneDefault();
  config.circuit = 'buffer';
  config.source.offset = 1;
  await act(async () => {
    await registered.get('configure_opamp_experiment')!.execute(config);
  });
  assert.ok(screen.getByRole('heading', { name: 'Voltage follower' }));
  assert.ok(screen.getByLabelText('Voltage gain = +1 V/V'));
  const result = registered.get('read_opamp_experiment')!.execute({}) as {
    config: typeof config;
  };
  assert.equal(result.config.circuit, 'buffer');
  config.source.frequency = 0;
  assert.throws(() =>
    registered.get('configure_opamp_experiment')!.execute(config),
  );
  assert.ok(screen.getByRole('heading', { name: 'Voltage follower' }));
  unmount();
  assert.ok(signals.every((s) => s.aborted));
});

test('slider inputs expose names and physical units and accept arrow keys', () => {
  render(<App />);
  // JSDOM has no layout; Base UI keeps the inset thumb hidden until measurement.
  // Inspect its real range input and exercise the shared keyboard handler.
  const sliders = screen.getAllByRole('slider', { hidden: true });
  const amplitude = sliders.find(
    (el) => el.getAttribute('aria-label') === 'Input 1 amplitude',
  )!;
  const cursor = sliders.find(
    (el) => el.getAttribute('aria-label') === 'Time cursor',
  )!;
  const frequency = sliders.find(
    (el) => el.getAttribute('aria-label') === 'Input 1 frequency',
  )!;
  assert.ok(amplitude);
  assert.ok(cursor);
  assert.equal(amplitude.getAttribute('aria-valuetext'), '0.5 V peak');
  assert.equal(frequency.getAttribute('aria-valuetext'), '1000 Hz');
  fireEvent.keyDown(amplitude, { key: 'ArrowRight' });
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input 1 amplitude',
      }) as HTMLInputElement
    ).value,
    '0.55',
  );
});
