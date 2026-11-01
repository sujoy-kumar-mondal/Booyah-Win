import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { runGuard } from '../src/api/guards.js';

const CONTRACTS_DIR = path.resolve(__dirname, '../../../docs/contracts');

/**
 * Loads a fixture directly from docs/contracts and validates it through runtime guard.
 * Allows deep overrides for specific test scenarios while ensuring the result passes the guard.
 */
export function loadContractFixture<T>(
  filename: string,
  guard: z.ZodType<T>,
  endpointName: string,
  mutate?: (clone: any) => void
): T {
  const filepath = path.join(CONTRACTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Contract file not found: ${filename}`);
  }
  const raw = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const data = JSON.parse(JSON.stringify(raw.data !== undefined ? raw.data : raw));

  if (mutate) {
    mutate(data);
  }

  return runGuard(guard, data, endpointName);
}
