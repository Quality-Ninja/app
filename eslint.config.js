import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'test-dist/**',
      'test-results/**',
      'playwright-report/**',
      '.tanstack/**',
      'src/routeTree.gen.ts',
      '**/*.d.ts',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginQuery.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // Route files export the Route that these build; the router plugin hot-reloads their components.
          extraHOCs: ['createFileRoute', 'createRootRouteWithContext'],
        },
      ],
      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      // Recording content comes from the API and is always rendered as text.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render recording content as text; never inject HTML.',
        },
        {
          selector:
            "MemberExpression[property.name=/^(innerHTML|outerHTML)$/], CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Render recording content as text; never inject HTML.',
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'vite/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['eslint.config.js', 'serve.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['tests/**/*.cjs', 'playwright.config.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      // Code passed to page.evaluate runs in the browser, next to the app's test handles.
      globals: {
        ...globals.node,
        ...globals.browser,
        Clerk: 'readonly',
        QaNinjaAuth: 'readonly',
      },
    },
  },
  {
    files: ['tests/clerk-web-double.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, Clerk: 'writable' },
    },
  }
)
