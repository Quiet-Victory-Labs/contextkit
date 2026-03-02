import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'core',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
