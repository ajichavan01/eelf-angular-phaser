// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.angular/**', '**/out-tsc/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'docs/**', '.claude/**'],
  },

  // All TypeScript
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },

  // Web workers
  {
    files: ['**/*.worker.ts', 'packages/browser/src/SimulationWorker.ts'],
    languageOptions: { globals: { ...globals.worker } },
  },

  // Node scripts, tests and tool configs
  {
    files: ['packages/simulation/test/**/*.ts', 'packages/simulation/benchmark.ts', 'tests/**/*.ts', 'playwright.config.ts', 'apps/phaser/vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  // Angular components and services
  {
    files: ['apps/angular/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'eelf', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'eelf', style: 'camelCase' }],
    },
  },

  // Angular templates (external .html and inline templates)
  {
    files: ['apps/angular/src/**/*.html'],
    ignores: ['apps/angular/src/index.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
