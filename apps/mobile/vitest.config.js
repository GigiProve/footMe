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
      /* Distribuito in Flow: il transform fallisce all'import, prima di
         eseguire un test. Riguarda ogni schermata che monti il selector
         della scadenza, quindi sta qui e non in un `vi.mock` per file. */
      "@react-native-community/datetimepicker": path.resolve(
        process.cwd(),
        "src/test/datetimepicker.tsx",
      ),
      "react-native-svg": path.resolve(
        process.cwd(),
        "src/test/react-native-svg.tsx",
      ),
      "react-native": path.resolve(process.cwd(), "src/test/react-native.tsx"),
      "react-native-safe-area-context": path.resolve(
        process.cwd(),
        "src/test/react-native-safe-area-context.tsx",
      ),
    },
  },
});
