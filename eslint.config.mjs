import globals from "globals";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

// ✅ Add TypeScript support
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// ✅ Add Next.js rules (recommended)
import next from "eslint-config-next";

export default [
  // 1) Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",

      "supabase/functions/**",
      "supabase/**/functions/**",
      "functions/**",
      "archive/**",
      "base44-export/**",

      // Optional: if this contains TS syntax but is .js, it will break parsing
      // "app/api/evaluate/route_old.js",
    ],
  },

  // 2) Base JS recommended rules
  js.configs.recommended,

  // 3) Next.js recommended (App Router friendly)
  // If this import gives you trouble in Flat Config, tell me and I’ll swap it to a safe variant.
  next,

  // 4) Project-wide linting (TS + React)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      // ✅ This is the missing piece: parse TS/TSX correctly
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },

        // Helps parser find your TS config (optional but recommended)
        // If you have a monorepo or multiple TS configs, we can refine later.
        // project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // React
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",

      // Hooks
      "react-hooks/rules-of-hooks": "error",

      // ✅ Let TS rule handle unused vars better in TS files
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Unused imports/vars (clean code)
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 5) ✅ Test globals so describe/it/expect don’t fail
  {
    files: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        vi: "readonly", // Vitest
        jest: "readonly", // Jest
      },
    },
  },
];
