import { simulateFoundation } from './simulation.js';

const requested = process.argv[2] ? Number.parseInt(process.argv[2], 10) : 10_000;
process.stdout.write(`${JSON.stringify(simulateFoundation(requested), null, 2)}\n`);
