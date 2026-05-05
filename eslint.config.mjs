// Flat config (ESLint 9+). Adds module-boundary enforcement so renderer code
// can't accidentally import main-process modules and vice versa.
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', 'coverage/**', '.vite/**']
  },
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },
  // Renderer must not import main process code (Electron-specific, not bundled
  // into the renderer). Allowed: shared types only.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/main/**', '@main/*', '../main/*', '../../main/*'],
              message: 'Renderer cannot import from src/main. Use IPC via window.api or import shared types from @shared.'
            },
            {
              group: ['electron'],
              message: 'Renderer cannot import "electron" directly. Use the contextBridge API exposed via preload.'
            },
            {
              group: ['better-sqlite3', 'playwright', 'electron-log'],
              message: 'Renderer cannot import Node-only modules. These belong to the main process; use IPC.'
            }
          ]
        }
      ]
    }
  },
  // Main must not import renderer/preload UI code.
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/renderer/**', '@renderer/*', 'react', 'react-dom'],
              message: 'Main process cannot import renderer code or React. Keep the boundary clean.'
            }
          ]
        }
      ]
    }
  }
];
