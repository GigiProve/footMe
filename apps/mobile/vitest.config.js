/* eslint-env node */
const path = require("node:path");

const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  resolve: {
    alias: {
      "react-native": path.resolve(process.cwd(), "src/test/react-native.tsx"),
      "react-native-safe-area-context": path.resolve(
        process.cwd(),
        "src/test/react-native-safe-area-context.tsx",
      ),
    },
  },
});
