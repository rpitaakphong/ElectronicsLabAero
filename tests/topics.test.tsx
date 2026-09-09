import './dom-setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
window.scrollTo = () => {};
afterEach(cleanup);
const open = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
test('welcome and catalog link to both labs and leaving restores divider defaults', async () => {
  const user = userEvent.setup();
  open();
  await user.click(screen.getByRole('link', { name: 'Browse topics' }));
  await user.click(
    screen.getByRole('link', { name: 'Open Voltage Divider topic' }),
  );
  assert.ok(screen.getByRole('heading', { name: 'Voltage Divider', level: 1 }));
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Input voltage' }), {
    target: { value: '12' },
  });
  await user.click(screen.getByRole('link', { name: 'Topics' }));
  await user.click(
    screen.getByRole('link', { name: 'Open Operational Amplifier topic' }),
  );
  assert.ok(
    screen.getByRole('heading', { name: 'Operational Amplifier', level: 1 }),
  );
  await user.click(screen.getByRole('link', { name: 'Topics' }));
  await user.click(
    screen.getByRole('link', { name: 'Open Voltage Divider topic' }),
  );
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Input voltage',
      }) as HTMLInputElement
    ).value,
    '5',
  );
});
test('direct divider route supports configuration changes, experiments, and reset', async () => {
  const user = userEvent.setup();
  open('/voltage-divider/learn');
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Upper resistance R1' }),
    { target: { value: '20' } },
  );
  await user.click(screen.getByRole('radio', { name: /Loaded divider/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Upper resistance R1',
      }) as HTMLInputElement
    ).value,
    '20',
  );
  assert.ok(screen.getByText('Loading error'));
  await user.click(screen.getAllByText('Why does this happen?')[0]);
  assert.equal(
    screen.getAllByText('Why does this happen?')[0].closest('details')?.open,
    true,
  );
  await user.click(screen.getByRole('radio', { name: /Potentiometer/ }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Wiper position' }), {
    target: { value: '100' },
  });
  assert.ok(
    screen.getByRole('img', { name: /potentiometer circuit.*Output 5 V/ }),
  );
  await user.click(screen.getByRole('radio', { name: /Sensor divider/ }));
  assert.ok(screen.getByRole('combobox', { name: 'Sensor position' }));
  await user.click(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(
    screen
      .getByRole('radio', { name: /Basic divider/ })
      .getAttribute('aria-checked'),
    'true',
  );
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Upper resistance R1',
      }) as HTMLInputElement
    ).value,
    '10',
  );
});
test('invalid values preserve last calculation and restore on blur', () => {
  open('/voltage-divider/learn');
  const field = screen.getByRole('spinbutton', { name: 'Input voltage' });
  fireEvent.change(field, { target: { value: '-1' } });
  assert.ok(screen.getByRole('alert'));
  assert.ok(screen.getByRole('img', { name: /basic circuit.*Output 2.5 V/ }));
  fireEvent.blur(field);
  assert.equal((field as HTMLInputElement).value, '5');
});
test('unknown routes offer a home link', () => {
  open('/missing');
  assert.ok(screen.getByRole('heading', { name: 'Page not found' }));
  assert.ok(screen.getByRole('link', { name: /Go to all topics/ }));
});

test('op-amp topic offers both tools and learning breadcrumbs return to the category', async () => {
  const user = userEvent.setup();
  open('/operational-amplifier');
  assert.equal(
    screen.getByRole('link', { name: /Start learning/ }).getAttribute('href'),
    '/operational-amplifier/learn',
  );
  assert.equal(
    screen.getByRole('link', { name: /Open simulator/ }).getAttribute('href'),
    '/operational-amplifier/simulator',
  );
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  assert.ok(
    screen.getByRole('heading', { name: 'Interactive Learning', level: 1 }),
  );
  assert.ok(screen.getByRole('button', { name: 'Reset lab' }));
  assert.equal(document.title, 'Op-Amp Interactive Learning | Electronics Lab');
  await user.click(screen.getByRole('link', { name: 'Operational Amplifier' }));
  assert.ok(screen.getByRole('link', { name: /Open simulator/ }));
});

test('direct simulator route embeds the packaged same-origin runtime and offers an offline download', () => {
  open('/operational-amplifier/simulator');
  assert.ok(
    screen.getByRole('heading', { name: 'Op-Amp Lab Simulator', level: 1 }),
  );
  const iframe = screen.getByTitle('Op-Amp Lab Simulator workspace');
  assert.equal(
    iframe.getAttribute('src'),
    '/simulators/opamp/index.html?embed=1',
  );
  assert.ok(
    screen
      .getByRole('link', { name: /Download offline simulator/ })
      .hasAttribute('download'),
  );
  assert.equal(document.title, 'Op-Amp Lab Simulator | Electronics Lab');
  // An HTML fallback instead of the simulator must not leave an empty frame without recovery.
  fireEvent.load(iframe);
  assert.ok(screen.getByRole('alert'));
  assert.equal(
    screen
      .getByRole('link', { name: /Open the standalone/ })
      .getAttribute('href'),
    '/simulators/opamp/index.html',
  );
});

test('divider topic offers learning and an independent simulator', async () => {
  const user = userEvent.setup();
  open('/voltage-divider');
  assert.equal(
    screen.getByRole('link', { name: /Open simulator/ }).getAttribute('href'),
    '/voltage-divider/simulator',
  );
  await user.click(screen.getByRole('link', { name: /Start learning/ }));
  assert.equal(
    document.title,
    'Voltage Divider Interactive Learning | Electronics Lab',
  );
  await user.click(screen.getByRole('link', { name: 'Voltage Divider' }));
  await user.click(screen.getByRole('link', { name: /Open simulator/ }));
  assert.equal(
    document.title,
    'Voltage Divider Lab Simulator | Electronics Lab',
  );
  const iframe = screen.getByTitle('Voltage Divider Lab Simulator workspace');
  assert.equal(
    iframe.getAttribute('src'),
    '/simulators/voltage-divider/index.html?embed=1',
  );
  assert.ok(
    screen
      .getByRole('link', { name: /Download offline simulator/ })
      .getAttribute('href')
      ?.endsWith('voltage_divider_sim_single_file.html'),
  );
  fireEvent.load(iframe);
  assert.equal(
    screen
      .getByRole('link', { name: /Open the standalone/ })
      .getAttribute('href'),
    '/simulators/voltage-divider/index.html',
  );
});

test('welcome has a single brand and main landmark with clear starting destinations', () => {
  open();
  assert.ok(
    screen.getByRole('heading', {
      name: 'Learn electronics by building and measuring circuits.',
      level: 1,
    }),
  );
  assert.equal(screen.getAllByRole('banner').length, 1);
  assert.equal(screen.getAllByRole('main').length, 1);
  assert.ok(screen.getByRole('img', { name: 'Chulalongkorn University' }));
  assert.equal(
    screen.getByRole('link', { name: 'Browse topics' }).getAttribute('href'),
    '/topics',
  );
  assert.equal(
    screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href'),
    '#main-content',
  );
});

test('catalog searches names and descriptions, clears, and explains empty results', async () => {
  const user = userEvent.setup();
  open('/topics');
  const search = screen.getByRole('searchbox', { name: 'Search topics' });
  await user.type(search, ' SENSOR ');
  assert.ok(screen.getByRole('link', { name: 'Open Voltage Divider topic' }));
  assert.equal(
    screen.queryByRole('link', { name: 'Open Operational Amplifier topic' }),
    null,
  );
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  assert.equal(document.activeElement, search);
  assert.ok(
    screen.getByRole('link', { name: 'Open Operational Amplifier topic' }),
  );
  await user.type(search, 'missing-topic');
  assert.ok(screen.getByRole('heading', { name: 'No topics found' }));
  assert.equal(screen.getByRole('status').textContent, '0 topics found');
  await user.click(screen.getByRole('button', { name: 'Show all topics' }));
  assert.equal((search as HTMLInputElement).value, '');
  assert.equal(screen.getByRole('status').textContent, '3 topics to explore');
});

test('resources offer all four sections and all three self-contained downloads', () => {
  open('/resources');
  for (const name of [
    'Getting started',
    'Saving your work',
    'Model limitations',
    'Offline simulators',
  ]) {
    assert.ok(screen.getByRole('heading', { name, level: 2 }));
  }
  for (const name of [
    'Voltage Divider Lab Simulator',
    'RC Filter Lab Simulator',
    'Op-Amp Lab Simulator',
  ]) {
    const link = screen.getByRole('link', { name: `Download ${name}` });
    assert.ok(link.hasAttribute('download'));
    assert.match(link.getAttribute('href')!, /_single_file\.html$/);
  }
  assert.equal(document.title, 'Resources | Electronics Lab');
});
