// The browserless half of the house test pattern (design 23.8): `node tests/unit.js`.
// One file per feature; the feel and stress pages are the other half and are played by a person.

import { run } from './harness.js';
import './movement.test.js';
import './world.test.js';
import './horde.test.js';
import './resolution.test.js';

run();
