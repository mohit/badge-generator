#!/usr/bin/env node

import { spawn } from 'node:child_process';

const child = spawn('node', ['--test', 'tests/*.test.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to run tests:', error.message);
  process.exit(1);
});
