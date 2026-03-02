import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'cli',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
