import './dom-setup';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';

let now = 0;
let frameId = 0;
const frames = new Map<number, FrameRequestCallback>();
const originalRAF = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;
beforeEach(() => {
  now = 0;
  frames.clear();
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: (id: number) => frames.delete(id),
  });
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: originalRAF,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: originalCancel,
  });
});
const open = () =>
  render(
    <MemoryRouter initialEntries={['/555-timer/learn']}>
      <AppRoutes />
    </MemoryRouter>,
  );
const field = (name: string) =>
  screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const set = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });
function advance(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
    act(() => {
      now += Math.min(100, milliseconds - elapsed);
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(now));
    });
  }
}
const clockText = () =>
  screen.getByText(/Simulated time · current/).textContent;
function positiveWidth() {
  const path = document
    .querySelector('.timer-waveforms path')!
    .getAttribute('d')!;
  const points = [...path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
  let rise: number | null = null;
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1][1] > 83 && points[i][1] < 83) rise = points[i][0];
    if (rise !== null && points[i - 1][1] < 83 && points[i][1] > 83)
      return points[i][0] - rise;
  }
  throw new Error('No complete HIGH pulse in the fixed window');
}

test('555 display scale stays fixed while capacitor and resistor values change', () => {
  open();
  advance(100);
  assert.equal(field('Time span').value, '50');
  assert.equal(field('Playback rate').value, '10');
  assert(
    screen.queryByRole('group', { name: 'Time span' }),
    'Time span slider group missing',
  );
  assert(
    screen.queryByRole('group', { name: 'Playback rate' }),
    'Playback rate slider group missing',
  );
  set('Timing capacitor C', '10');
  assert.equal(field('Time span').value, '50');
  assert.equal(field('Playback rate').value, '10');
  assert(screen.getByText('Fixed span · 50 ms'));
  assert.match(
    document.querySelector('.timer-metric-table tbody tr')!.textContent!,
    /76.25 ms/,
  );
  set('R1', '2');
  assert.equal(field('Time span').value, '50');
  assert.equal(field('Playback rate').value, '10');
});

test('doubling C doubles visible HIGH width without changing clock speed or time span', () => {
  open();
  advance(100);
  advance(8000);
  assert.match(clockText()!, /current 80 ms/);
  const first = positiveWidth();
  set('Timing capacitor C', '2');
  advance(100);
  advance(8000);
  assert.match(clockText()!, /current 80 ms/);
  advance(4000);
  const second = positiveWidth();
  assert(
    Math.abs(second / first - 2) < 0.02,
    `${first} px versus ${second} px`,
  );
  assert.equal(field('Time span').value, '50');
});

test('manual scale controls work while paused and do not restart the timing run', () => {
  open();
  advance(100);
  advance(2000);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  const before = clockText();
  set('Time span', '100');
  set('Playback rate', '20');
  assert.equal(clockText(), before);
  assert(screen.getByText('Fixed span · 100 ms'));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  advance(100);
  advance(1000);
  assert.match(clockText()!, /current 40 ms/);
  fireEvent.click(screen.getByRole('button', { name: 'Restart timing' }));
  assert.match(clockText()!, /current 0 s/);
  assert.equal(field('Time span').value, '100');
  assert.equal(field('Playback rate').value, '20');
});

test('monostable scale stays fixed on C edits and Reset lab restores the default view', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: /Monostable one-shot/ }));
  assert.equal(field('Time span').value, '5000');
  assert.equal(field('Playback rate').value, '500');
  set('Timing capacitor C', '20');
  assert.equal(field('Time span').value, '5000');
  assert.equal(field('Playback rate').value, '500');
  set('Time span', '10000');
  fireEvent.click(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(field('Time span').value, '50');
  assert.equal(field('Playback rate').value, '10');
});

test('overcrowded fixed views explain how to zoom without crashing or silently rescaling', () => {
  open();
  set('Timing capacitor C', '0.001');
  advance(100);
  advance(2000);
  assert(screen.getByText(/Too many pulses.*reduce the time span/i));
  assert.equal(field('Time span').value, '50');
  set('Time span', '0.05');
  assert.equal(
    screen.queryByText(/Too many pulses.*reduce the time span/i),
    null,
  );
  assert(document.querySelector('.timer-waveforms path')!.getAttribute('d'));
});
