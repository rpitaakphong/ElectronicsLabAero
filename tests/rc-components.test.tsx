import './dom-setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
window.scrollTo = () => {};
afterEach(cleanup);
const open = () =>
  render(
    <MemoryRouter initialEntries={['/rc-filter/learn']}>
      <AppRoutes />
    </MemoryRouter>,
  );
const field = (name: string) =>
  screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const edit = (name: string, value: number) =>
  fireEvent.change(field(name), { target: { value: String(value) } });
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const option = [...document.querySelectorAll('[role="option"]')].find(
    (el) => el.textContent === value,
  );
  assert.ok(option);
  await waitFor(() =>
    assert.notEqual(getComputedStyle(option).pointerEvents, 'none'),
  );
  await user.click(option);
}
test('RC categories retain their own example inputs, values, windows, and components', async () => {
  const user = userEvent.setup();
  open();
  assert.equal(field('Useful-signal frequency').value, '200');
  assert.equal(field('Interference strength').value, '100');
  edit('Resistance R1', 20);
  edit('Useful-signal frequency', 350);
  edit('Useful-signal amplitude', 2);
  edit('Interference strength', 75);
  await choose(user, 'Waveform window', 'Long overview');
  await user.click(screen.getByRole('radio', { name: /Band-pass/ }));
  assert.equal(field('Useful-signal frequency').value, '500');
  assert.equal(field('Capacitance C1').value, '100');
  await choose(user, 'Input signal', 'Clean signal');
  await user.click(screen.getByRole('radio', { name: /Low-pass/ }));
  assert.equal(field('Resistance R1').value, '20');
  assert.equal(field('Useful-signal frequency').value, '350');
  assert.equal(field('Useful-signal amplitude').value, '2');
  assert.equal(field('Interference strength').value, '75');
  assert.match(
    screen.getByRole('combobox', { name: 'Waveform window' }).textContent!,
    /Long overview/,
  );
  await user.click(screen.getByRole('radio', { name: /Band-pass/ }));
  assert.match(
    screen.getByRole('combobox', { name: 'Input signal' }).textContent!,
    /Clean signal/,
  );
});
test('clean/interference choices and advanced signal edits preserve R/C and loading', async () => {
  const user = userEvent.setup();
  open();
  edit('Resistance R1', 22);
  edit('Capacitance C1', 30);
  await user.click(
    screen.getByRole('checkbox', { name: 'Connect output load' }),
  );
  edit('Output load resistance', 15);
  await user.click(screen.getByText('Advanced signal settings'));
  edit('Fast interference frequency', 12000);
  edit('Interference strength', 125);
  await choose(user, 'Input signal', 'Clean signal');
  assert.equal(
    screen.queryByRole('spinbutton', { name: 'Interference strength' }),
    null,
  );
  await choose(user, 'Input signal', 'Signal with interference');
  assert.equal(field('Resistance R1').value, '22');
  assert.equal(field('Capacitance C1').value, '30');
  assert.equal(field('Output load resistance').value, '15');
  assert.equal(field('Interference strength').value, '125');
  await user.click(screen.getByText('Advanced signal settings'));
  assert.equal(field('Fast interference frequency').value, '12000');
  edit('Fast interference frequency', 0);
  assert.ok(screen.getByRole('alert'));
  fireEvent.blur(field('Fast interference frequency'));
  assert.equal(field('Fast interference frequency').value, '12000');
});
test('custom source remains shared while category selections and step settings remain independent', async () => {
  const user = userEvent.setup();
  open();
  await choose(user, 'Input signal', 'Custom waveform');
  await choose(user, 'Input waveform', 'Square');
  edit('Input frequency', 2000);
  edit('Input amplitude', 2);
  edit('Input offset', 1);
  await user.click(screen.getByRole('radio', { name: /High-pass/ }));
  assert.equal(field('Useful-signal frequency').value, '5000');
  await choose(user, 'Input signal', 'Custom waveform');
  assert.equal(field('Input frequency').value, '2000');
  assert.match(
    screen.getByRole('combobox', { name: 'Input waveform' }).textContent!,
    /Square/,
  );
  await choose(user, 'Response view', 'Step response');
  edit('Step voltage', 3);
  assert.ok(screen.getByRole('heading', { name: 'Step response' }));
  await choose(user, 'Response view', 'Periodic waveform');
  assert.equal(field('Input amplitude').value, '2');
  assert.equal(field('Input offset').value, '1');
  await choose(user, 'Response view', 'Step response');
  assert.equal(field('Step voltage').value, '3');
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(field('Useful-signal frequency').value, '200');
  assert.equal(field('Interference strength').value, '100');
});
test('RC loading updates the schematic and route departure clears settings', async () => {
  const user = userEvent.setup();
  open();
  await user.click(
    screen.getByRole('checkbox', { name: 'Connect output load' }),
  );
  assert.ok(
    screen.getByRole('img', {
      name: 'Low-pass filter circuit with output load',
    }),
  );
  edit('Capacitance C1', 0);
  assert.ok(screen.getByRole('alert'));
  fireEvent.blur(field('Capacitance C1'));
  assert.equal(field('Capacitance C1').value, '10');
  edit('Useful-signal frequency', 400);
  await user.click(screen.getByRole('link', { name: 'RC Filter' }));
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  assert.equal(field('Useful-signal frequency').value, '200');
  assert.equal(
    (
      screen.getByRole('checkbox', {
        name: 'Connect output load',
      }) as HTMLInputElement
    ).checked,
    false,
  );
});

test('frequency comparison combines coincident tones and preserves valid zero-signal geometry', async () => {
  const { defaults, simulate } = await import('../lib/rc/simulator');
  const { RcFrequencyPlots } = await import('../components/rc/visuals');
  const config = defaults();
  config.examples.lowpass.interferenceFrequencies = [200];
  const { container, rerender } = render(
    <RcFrequencyPlots result={simulate(config)} />,
  );
  const spectrum = screen.getByRole('img', {
    name: 'Input and output signal amplitudes versus logarithmic frequency',
  });
  assert.equal(spectrum.querySelectorAll('circle').length, 1);
  assert.match(spectrum.textContent!, /Input amplitude · 200 Hz: 1.35 V peak/);
  assert.match(
    spectrum.textContent!,
    /Output amplitude · 200 Hz: 1.339 V peak/,
  );
  assert.ok(screen.getByText('Input reference · 0 dB / 0°'));
  assert.ok(screen.getByText('Output relative to input'));
  config.examples.lowpass.amplitude = 0;
  config.examples.lowpass.strength = 0;
  rerender(<RcFrequencyPlots result={simulate(config)} />);
  assert.ok(
    [...container.querySelectorAll('path')].every(
      (p) => !/[Nn]a[Nn]|Infinity/.test(p.getAttribute('d') || ''),
    ),
  );
  config.examples.lowpass.input = 'custom';
  rerender(<RcFrequencyPlots result={simulate(config)} />);
  assert.equal(
    screen.queryByRole('img', {
      name: 'Input and output signal amplitudes versus logarithmic frequency',
    }),
    null,
  );
  assert.ok(
    screen.getByRole('img', {
      name: 'Input reference and output gain in decibels versus logarithmic frequency',
    }),
  );
});
