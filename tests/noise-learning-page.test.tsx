import './dom-setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { LESSONS } from '../lib/noise-learning/content';
window.scrollTo = () => {};
afterEach(cleanup);
const open = () =>
  render(
    <MemoryRouter initialEntries={['/noise-and-filtering/learn']}>
      <AppRoutes />
    </MemoryRouter>,
  );
test('Standalone learning renders all sections with native mathematics and no workbook links', () => {
  open();
  const main = screen.getByRole('main');
  assert.equal(
    document.title,
    'Noise and Filtering Interactive Learning | Electronics Lab',
  );
  for (const lesson of LESSONS) {
    const button = screen.getByRole('button', {
      name: new RegExp(lesson.title),
    });
    fireEvent.click(button);
    assert.equal(button.getAttribute('aria-current'), 'step');
    assert.ok(screen.getByRole('heading', { name: lesson.title, level: 2 }));
    assert.ok(main.querySelectorAll('math').length > 0);
    assert.equal(main.querySelector('.katex-error'), null);
    assert.equal(
      main.querySelector(
        'a[href*="prelab"], a[href*="worksheets"], input[type="file"]',
      ),
      null,
    );
  }
});
test('Learning uses independent section settings and dynamic mechanisms', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: /Moving average/ }));
  const length = screen.getByRole('spinbutton', { name: 'Window length' });
  fireEvent.change(length, { target: { value: '31' } });
  fireEvent.blur(length);
  assert.equal((length as HTMLInputElement).value, '31');
  fireEvent.click(screen.getByRole('button', { name: /Analog RC low-pass/ }));
  fireEvent.click(screen.getByRole('button', { name: /Moving average/ }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Window length',
      }) as HTMLInputElement
    ).value,
    '31',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reset this section' }));
  assert.equal(
    (
      screen.getByRole('spinbutton', {
        name: 'Window length',
      }) as HTMLInputElement
    ).value,
    '15',
  );
  const time = screen.getByLabelText('Cursor timestamp').textContent;
  fireEvent.click(screen.getByRole('button', { name: 'Next sample' }));
  assert.notEqual(screen.getByLabelText('Cursor timestamp').textContent, time);
});
