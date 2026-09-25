import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [".expo/**", "dist/**", "node_modules/**"],
  },
  ...compat.extends("expo"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/exhaustive-deps": "error",
      // eslint-config-expo 57 ships react-hooks v6, which added these three
      // rules. They flag ~139 pre-existing call sites across the app (mostly
      // effects that seed state, and PanResponder/Animated refs read while
      // rendering). Downgraded to warnings so the SDK 57 upgrade is not
      // blocked on that refactor; the debt stays visible in lint output and
      // should be paid off rule by rule.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];
