import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'db',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
