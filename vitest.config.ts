import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*', 'cloud'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/__tests__/**',
        'packages/*/src/**/*.test.ts',
        '**/*.d.ts',
      ],
    },
  },
})
