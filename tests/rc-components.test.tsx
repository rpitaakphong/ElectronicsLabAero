import './dom-setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
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
test('RC configurations preserve independent components and common signal settings', async () => {
  const user = userEvent.setup();
  open();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Resistance R1' }), {
    target: { value: '20' },
  });
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Input frequency' }),
    { target: { value: '2000' } },
  );
  await user.click(screen.getByRole('radio', { name: /Band-pass/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Capacitance C1',
      }) as HTMLInputElement
    ).value,
    '100',
  );
  assert.ok(screen.getByText('Peak frequency'));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input frequency',
      }) as HTMLInputElement
    ).value,
    '2000',
  );
  await user.click(screen.getByRole('radio', { name: /Low-pass/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Resistance R1',
      }) as HTMLInputElement
    ).value,
    '20',
  );
});
test('RC loading and step view update diagrams and reset restores startup', async () => {
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
  assert.ok(screen.getByRole('spinbutton', { name: 'Output load resistance' }));
  await user.click(screen.getByRole('combobox', { name: 'Response view' }));
  const stepOption = [...document.querySelectorAll('[role="option"]')].find(
    (option) => option.textContent === 'Step response',
  );
  assert.ok(stepOption);
  await user.click(stepOption);
  assert.ok(screen.getByRole('heading', { name: 'Step response' }));
  assert.ok(screen.getByRole('spinbutton', { name: 'Step voltage' }));
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(
    (
      screen.getByRole('checkbox', {
        name: 'Connect output load',
      }) as HTMLInputElement
    ).checked,
    false,
  );
  assert.ok(screen.getByRole('combobox', { name: 'Input waveform' }));
});
test('invalid RC values preserve last valid response and route departure clears lesson state', async () => {
  const user = userEvent.setup();
  open();
  const field = screen.getByRole('spinbutton', { name: 'Capacitance C1' });
  fireEvent.change(field, { target: { value: '0' } });
  assert.ok(screen.getByRole('alert'));
  fireEvent.blur(field);
  assert.equal((field as HTMLInputElement).value, '10');
  fireEvent.change(field, { target: { value: '20' } });
  await user.click(screen.getByRole('link', { name: 'RC Filter' }));
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Capacitance C1',
      }) as HTMLInputElement
    ).value,
    '10',
  );
});
