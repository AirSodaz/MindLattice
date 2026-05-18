import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../..', import.meta.url));

function readSource(path: string): string {
  return readFileSync(join(sourceRoot, path), 'utf8');
}

test('global CSS defines MindLattice primitive component classes', () => {
  const css = readSource('shared/styles/global.css');
  const requiredSelectors = [
    '.ml-pane',
    '.ml-surface',
    '.ml-button',
    '.ml-button-primary',
    '.ml-button-secondary',
    '.ml-button-ghost',
    '.ml-button-danger',
    '.ml-button-draft',
    '.ml-button-icon',
    '.ml-button-loading',
    '.ml-field',
    '.ml-field-help',
    '.ml-field-error',
    '.ml-badge',
    '.ml-badge-draft',
    '.ml-badge-saved',
    '.ml-notice',
    '.ml-notice-ok',
    '.ml-notice-warning',
    '.ml-notice-error',
    '.ml-notice-draft',
    '.ml-list-item',
  ];

  for (const selector of requiredSelectors) {
    assert.ok(css.includes(selector), `${selector} should exist in global CSS`);
  }

  assert.match(css, /\.ml-badge-draft[\s\S]*border-style:\s*dashed/);
  assert.match(css, /\.ml-list-item-draft[\s\S]*border-style:\s*dashed/);
});

test('tokens keep Open Design Green Paper primitives semantic and non-decorative', () => {
  const tokens = readSource('shared/styles/tokens.css');

  assert.match(tokens, /--panel:\s*oklch/);
  assert.match(tokens, /--accent:\s*oklch/);
  assert.match(tokens, /--preview:\s*oklch/);
  assert.match(tokens, /--font-display:\s*var\(--font-display-editorial\)/);
  assert.match(tokens, /--radius-control:\s*var\(--radius-xs\)/);
  assert.doesNotMatch(tokens, /purple|violet|orb|bokeh|starfield/i);
});
