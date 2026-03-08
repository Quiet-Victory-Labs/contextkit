import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'cloud',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
