/* eslint-env node */
const path = require("node:path");

const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    setupFiles: [path.resolve(process.cwd(), "src/test/setup-globals.ts")],
  },
  resolve: {
    alias: {
      "@expo/vector-icons/Ionicons": path.resolve(
        process.cwd(),
        "src/test/expo-vector-icons-ionicons.tsx",
      ),
      "expo-image-picker": path.resolve(
        process.cwd(),
        "src/test/expo-image-picker.ts",
      ),
      "react-native-url-polyfill/auto": path.resolve(
        process.cwd(),
        "src/test/empty-module.ts",
      ),
      "@react-native-async-storage/async-storage": path.resolve(
        process.cwd(),
        "src/test/async-storage.ts",
      ),
      "react-native": path.resolve(process.cwd(), "src/test/react-native.tsx"),
      "react-native-safe-area-context": path.resolve(
        process.cwd(),
        "src/test/react-native-safe-area-context.tsx",
      ),
    },
  },
});
