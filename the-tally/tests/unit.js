// `npm test`, or `node tests/unit.js`. The suite is imported for its side effects; each test
// registers itself with the harness.

import './movement.test.js';
import './world.test.js';
import { run } from './harness.js';

const ok = await run();
process.exitCode = ok ? 0 : 1;
