import { defineConfig } from "eslint/config"; // Native ESLint helper
import tseslint from "typescript-eslint";
export default defineConfig(tseslint.configs.recommended, {
    languageOptions: {
        parserOptions: {
            project: true
        },
    }
});