import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'mcp',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
