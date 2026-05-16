import { defineConfig } from 'eslint/config';
import { configs } from 'typescript-eslint';
export default defineConfig(configs.recommended, [{ rules: { "@typescript-eslint/no-unused-expressions": 'off', "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unsafe-assignment": "off", "@typescript-eslint/no-unsafe-member-access": "off", } }]);