import test from 'node:test';
import assert from 'node:assert/strict';
import { orientationRoll, smoothSteering, steeringFromTilt } from '../src/sensor.ts';

test('maps the landscape screen orientations to consistent roll directions', () => {
  assert.equal(orientationRoll(12, 4, 90), 12);
  assert.equal(orientationRoll(12, 4, 270), -12);
  assert.equal(orientationRoll(12, 4, 0), 4);
  assert.equal(orientationRoll(12, 4, 180), -4);
});

test('normalizes steering with a five degree dead zone and clamps at one', () => {
  assert.equal(steeringFromTilt(4), 0);
  assert.equal(steeringFromTilt(5), 0);
  assert.ok(Math.abs(steeringFromTilt(35) - 1) < 1e-9);
  assert.ok(Math.abs(steeringFromTilt(-35) + 1) < 1e-9);
  assert.ok(steeringFromTilt(90) === 1);
});

test('shows direction correction and configurable low-pass smoothing', () => {
  assert.equal(steeringFromTilt(20, true), -steeringFromTilt(20));
  assert.equal(smoothSteering(0, 1, 0.2), 0.2);
  assert.equal(smoothSteering(0, 1, 1), 1);
  assert.equal(smoothSteering(0, 1, 0), 0);
});
