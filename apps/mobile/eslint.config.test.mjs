import { describe, expect, it } from "vitest";

import eslintConfig from "./eslint.config.mjs";

describe("mobile eslint config", () => {
  it("treats exhaustive hook dependencies as a required rule", () => {
    const reactHooksRuleConfig = eslintConfig.find(
      (entry) => entry.rules?.["react-hooks/exhaustive-deps"] === "error",
    );

    expect(reactHooksRuleConfig).toBeDefined();
  });
});
