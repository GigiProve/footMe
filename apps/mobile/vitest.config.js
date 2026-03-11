/* eslint-env node */
const path = require("node:path");

const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  resolve: {
    alias: {
      "react-native": path.resolve(process.cwd(), "src/test/react-native.tsx"),
    },
  },
});
