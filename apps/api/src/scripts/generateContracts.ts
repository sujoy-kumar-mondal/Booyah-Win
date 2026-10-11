import { spawnSync } from 'child_process';

const result = spawnSync('npx', ['vitest', 'run', 'tests/contracts.test.ts'], {
  env: {
    ...process.env,
    GENERATE_CONTRACTS: 'true',
  },
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
