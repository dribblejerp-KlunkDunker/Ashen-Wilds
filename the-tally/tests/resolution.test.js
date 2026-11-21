// The drawing-buffer budget: a high-DPI panel is capped at 1080p worth of pixels, and the scene
// gives up resolution only after sustained slow frames, never below its floor.

import { test, assert, near } from './harness.js';
import { budgetScale, createQualityStepper, MAX_PIXELS } from '../js/render/resolution.js';

test('a small panel keeps its own pixels', () => {
  near(budgetScale(1366, 768, 1, MAX_PIXELS), 1, 1e-9, '1366x768 at 1x fits the budget');
});

test('a 1080p Chromebook panel at 1.25 DPR is exactly the budget', () => {
  near(budgetScale(1536, 864, 1.25, MAX_PIXELS), 1, 1e-9, '1536x864 at 1.25 is 1080p');
});

test('a high-DPI 1080p panel is capped at 1080p', () => {
  const scale = budgetScale(1920, 1080, 2, MAX_PIXELS);
  near(scale, 0.5, 1e-9, 'four times the pixels is half the linear scale');
  near(1920 * 2 * scale, 1920, 1e-6, 'buffer width');
  near(1080 * 2 * scale, 1080, 1e-6, 'buffer height');
});

test('a 4K panel is capped at 1080p', () => {
  const scale = budgetScale(3840, 2160, 1, MAX_PIXELS);
  near(3840 * scale, 1920, 1e-6, 'buffer width');
  near(2160 * scale, 1080, 1e-6, 'buffer height');
});

test('the stepper gives ground after sustained slow frames, never below the floor', () => {
  const stepper = createQualityStepper(0.6);
  let quality = 1;
  for (let i = 0; i < 29; i++) quality = stepper.sample(30, quality);
  near(quality, 1, 1e-9, '29 slow frames are not enough');
  quality = stepper.sample(30, quality);
  near(quality, 0.88, 1e-9, 'the thirtieth slow frame drops the scale');
  for (let i = 0; i < 300; i++) quality = stepper.sample(30, quality);
  near(quality, 0.6, 1e-9, 'the scale never falls below the floor');
});

test('the stepper takes resolution back only after a long clean stretch, and not past the failure', () => {
  const stepper = createQualityStepper(0.6);
  let quality = 1;
  for (let i = 0; i < 30; i++) quality = stepper.sample(30, quality);
  near(quality, 0.88, 1e-9, 'dropped once');

  for (let i = 0; i < 239; i++) quality = stepper.sample(10, quality);
  near(quality, 0.88, 1e-9, 'four seconds is the recovery wait');
  quality = stepper.sample(10, quality);
  near(quality, 0.9328, 1e-9, 'first recovery step');

  for (let i = 0; i < 240; i++) quality = stepper.sample(10, quality);
  near(quality, 0.95, 1e-9, 'recovery stops below the scale that failed');
  for (let i = 0; i < 240; i++) quality = stepper.sample(10, quality);
  near(quality, 0.95, 1e-9, 'it never climbs back to the failing scale');
});

test('an even interval leaves the scale alone', () => {
  const stepper = createQualityStepper(0.6);
  let quality = 1;
  for (let i = 0; i < 600; i++) quality = stepper.sample(20, quality);
  assert(quality === 1, 'a 50 Hz panel must not be treated as a slow machine');
});
