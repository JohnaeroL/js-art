import test from 'node:test';
import assert from 'node:assert/strict';
import { args } from '../server.js';

test('args: defaults and values', () => {
  assert.deepEqual(args([]), { root: 'site', port: 5173, out: 'css/js-art.css', open: null });
  assert.equal(args(['--port', '8080', '--root', 'www']).port, 8080);
});

test('args: --open takes an optional page path', () => {
  assert.equal(args(['--open']).open, '/');
  assert.equal(args(['--open', '--port', '1']).open, '/');
  assert.equal(args(['--open', '/about.html']).open, '/about.html');
});
