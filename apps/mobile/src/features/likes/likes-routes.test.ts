import { describe, expect, it } from "vitest";

import { likesHref, parseLikesParams } from "./likes-routes";

describe("likes-routes — HOM-07 §45–§46", () => {
  it("la lista è /likes/[type]/[id], fuori dalle tab", () => {
    expect(likesHref("club_media", "post-1")).toBe("/likes/club_media/post-1");
    expect(likesHref("profile_post", "abc")).toBe("/likes/profile_post/abc");
    expect(likesHref("club_media", "post-1")).not.toContain("(tabs)");
  });

  it("legge tipo e id dai parametri", () => {
    expect(parseLikesParams({ id: "post-1", type: "club_media" })).toEqual({
      contentType: "club_media",
      postId: "post-1",
    });
    expect(parseLikesParams({ id: ["post-1"], type: ["club_media"] })).toEqual({
      contentType: "club_media",
      postId: "post-1",
    });
  });

  it("senza uno dei due non c'è nessuna lista", () => {
    expect(parseLikesParams({ type: "club_media" })).toBeNull();
    expect(parseLikesParams({ id: "post-1" })).toBeNull();
    expect(parseLikesParams({})).toBeNull();
  });
});
