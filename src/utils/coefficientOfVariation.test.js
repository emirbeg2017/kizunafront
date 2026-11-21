import assert from 'node:assert/strict';
import test from 'node:test';
import { coefficientOfVariation } from './coefficientOfVariation.js';

test('uses sample standard deviation for a known set of scores', () => {
  const result = coefficientOfVariation([10, 20, 30]);
  assert.equal(result.count, 3);
  assert.equal(result.mean, 20);
  assert.equal(result.standardDeviation, 10);
  assert.equal(result.cv, 50);
});

test('identical positive scores have zero variation', () => {
  assert.equal(coefficientOfVariation([90, 90, 90]).cv, 0);
});

test('missing and nonfinite scores are excluded', () => {
  const result = coefficientOfVariation([10, null, undefined, NaN, Infinity, '', 20, 30]);
  assert.equal(result.count, 3);
  assert.equal(result.cv, 50);
});

test('zero scores are included and CV can exceed 100 percent', () => {
  const result = coefficientOfVariation([0, 0, 30]);
  assert.equal(result.count, 3);
  assert.ok(Math.abs(result.cv - 173.20508075688772) < 1e-10);
});

test('fewer than two scores cannot produce a sample CV', () => {
  assert.equal(coefficientOfVariation([]).cv, null);
  assert.equal(coefficientOfVariation([20]).cv, null);
});

test('a zero mean leaves CV undefined', () => {
  const result = coefficientOfVariation([0, 0, 0]);
  assert.equal(result.count, 3);
  assert.equal(result.mean, 0);
  assert.equal(result.standardDeviation, 0);
  assert.equal(result.cv, null);
});
