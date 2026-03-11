import { describe, expect, it } from "vitest";

import { resolveIconName } from "./icon-config";

describe("Icon", () => {
  it("returns a more prominent filled icon for active tabs", () => {
    expect(resolveIconName("home", true)).toBe("home");
    expect(resolveIconName("network", true)).toBe("people");
    expect(resolveIconName("messages", true)).toBe("chatbubble-ellipses");
    expect(resolveIconName("announcements", true)).toBe("megaphone");
    expect(resolveIconName("profile", true)).toBe("person-circle");
  });

  it("returns outline icons for inactive tabs", () => {
    expect(resolveIconName("home")).toBe("home-outline");
    expect(resolveIconName("network")).toBe("people-outline");
    expect(resolveIconName("messages")).toBe("chatbubble-ellipses-outline");
    expect(resolveIconName("announcements")).toBe("megaphone-outline");
    expect(resolveIconName("profile")).toBe("person-circle-outline");
  });
});
