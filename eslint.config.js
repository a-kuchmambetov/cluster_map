import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const browserGlobals = {
    AbortController: "readonly",
    Blob: "readonly",
    clearInterval: "readonly",
    clearTimeout: "readonly",
    console: "readonly",
    crypto: "readonly",
    document: "readonly",
    fetch: "readonly",
    File: "readonly",
    FormData: "readonly",
    Headers: "readonly",
    HTMLElement: "readonly",
    localStorage: "readonly",
    location: "readonly",
    navigator: "readonly",
    Request: "readonly",
    Response: "readonly",
    sessionStorage: "readonly",
    setInterval: "readonly",
    setTimeout: "readonly",
    URL: "readonly",
    URLSearchParams: "readonly",
    window: "readonly",
};

const nodeGlobals = {
    AbortController: "readonly",
    Buffer: "readonly",
    clearInterval: "readonly",
    clearTimeout: "readonly",
    console: "readonly",
    exports: "readonly",
    fetch: "readonly",
    global: "readonly",
    module: "readonly",
    process: "readonly",
    require: "readonly",
    setInterval: "readonly",
    setTimeout: "readonly",
    URL: "readonly",
    URLSearchParams: "readonly",
};

export default defineConfig(
    globalIgnores([
        "**/.docusaurus/**",
        "**/.turbo/**",
        "**/.vite/**",
        "**/build/**",
        "**/coverage/**",
        "**/dist/**",
        "**/node_modules/**",
        "**/*.tsbuildinfo",
    ]),
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            sourceType: "module",
        },
        linterOptions: {
            reportUnusedDisableDirectives: "warn",
        },
        rules: {
            "no-debugger": "error",
            "no-duplicate-imports": "error",
            "prefer-const": "error",
        },
    },
    {
        files: ["**/*.cjs"],
        languageOptions: {
            sourceType: "commonjs",
        },
    },
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    fixStyle: "inline-type-imports",
                    prefer: "type-imports",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        files: [
            "apps/api/**/*.{js,ts}",
            "apps/docs/docusaurus.config.ts",
            "apps/docs/sidebars.ts",
            "apps/web/vite.config.ts",
            "packages/**/*.{js,ts}",
            "**/*.config.{js,mjs,cjs,ts}",
        ],
        languageOptions: {
            globals: nodeGlobals,
        },
    },
    {
        files: [
            "apps/docs/src/**/*.{js,jsx,ts,tsx}",
            "apps/web/src/**/*.{js,jsx,ts,tsx}",
        ],
        languageOptions: {
            globals: browserGlobals,
        },
    },
);
