import { describe, expect, it } from "vitest";

import {
  classifyGroupAccessError,
  decideMembershipRevocation,
  formatSystemEvent,
  isAccessLostError,
  isGroupComposerAvailable,
  revocationMessage,
  shouldNavigateOnRevoke,
  systemEventAffectsGroupMeta,
  toMembershipPeriodChange,
} from "./group-chat-presentation";
import { isChatMediaQueryOf } from "./messaging-keys";
import { groupInfoRoute } from "./messaging-routes";

describe("formatSystemEvent (DAS-REV-33 §24)", () => {
  it.each([
    ["GROUP_MEMBER_ADDED", { name: "Riccardo Riva" }, "Riccardo Riva è stato aggiunto al gruppo."],
    ["GROUP_MEMBERS_ADDED", { count: 3 }, "3 persone sono state aggiunte al gruppo."],
    ["GROUP_MEMBER_LEFT", { name: "Riccardo Riva" }, "Riccardo Riva ha lasciato il gruppo."],
    ["GROUP_MEMBER_REMOVED", { name: "Riccardo Riva" }, "Riccardo Riva è stato rimosso dal gruppo."],
    [
      "GROUP_RENAMED",
      { name: "Staff tecnico Primavera" },
      "Il gruppo ora si chiama Staff tecnico Primavera.",
    ],
    ["GROUP_ARCHIVED", null, "Il gruppo è stato archiviato."],
    ["GROUP_REACTIVATED", undefined, "Il gruppo è stato riattivato."],
  ])("%s", (type, payload, expected) => {
    expect(formatSystemEvent(type, payload)).toBe(expected);
  });

  it("trims the snapshot name", () => {
    expect(formatSystemEvent("GROUP_MEMBER_LEFT", { name: "  Mario  " })).toBe(
      "Mario ha lasciato il gruppo.",
    );
  });

  it("degrades to neutral wording when the payload is missing or malformed", () => {
    expect(formatSystemEvent("GROUP_MEMBER_ADDED", null)).toBe(
      "Una persona è stata aggiunta al gruppo.",
    );
    expect(formatSystemEvent("GROUP_MEMBER_REMOVED", { name: "" })).toBe(
      "Una persona è stata rimossa dal gruppo.",
    );
    expect(formatSystemEvent("GROUP_MEMBER_LEFT", { name: 4 })).toBe(
      "Una persona ha lasciato il gruppo.",
    );
    expect(formatSystemEvent("GROUP_RENAMED", {})).toBe("Il gruppo è stato rinominato.");
    expect(formatSystemEvent("GROUP_MEMBERS_ADDED", { count: "3" })).toBe(
      "Alcune persone sono state aggiunte al gruppo.",
    );
    expect(formatSystemEvent("GROUP_MEMBERS_ADDED", { count: 1 })).toBe(
      "Una persona è stata aggiunta al gruppo.",
    );
  });

  it("never returns an empty string, even for an unknown or missing type", () => {
    expect(formatSystemEvent("SOMETHING_NEW", { name: "x" })).toBe("Il gruppo è stato aggiornato.");
    expect(formatSystemEvent(null, null)).toBe("Il gruppo è stato aggiornato.");
    expect(formatSystemEvent(undefined, undefined)).toBe("Il gruppo è stato aggiornato.");
    expect(formatSystemEvent("", null)).toBe("Il gruppo è stato aggiornato.");
  });
});

describe("systemEventAffectsGroupMeta", () => {
  it("is true for any system event and false for ordinary messages", () => {
    expect(systemEventAffectsGroupMeta("GROUP_ARCHIVED")).toBe(true);
    expect(systemEventAffectsGroupMeta("GROUP_REACTIVATED")).toBe(true);
    expect(systemEventAffectsGroupMeta("GROUP_RENAMED")).toBe(true);
    expect(systemEventAffectsGroupMeta("UNKNOWN")).toBe(true);
    expect(systemEventAffectsGroupMeta(null)).toBe(false);
    expect(systemEventAffectsGroupMeta(undefined)).toBe(false);
  });
});

describe("toMembershipPeriodChange", () => {
  it("maps a realtime row", () => {
    expect(
      toMembershipPeriodChange({
        conversation_id: "c1",
        ended_at: "2026-11-10T10:00:00Z",
        id: "p1",
        profile_id: "me",
        revoked_kind: "ended",
      }),
    ).toEqual({
      conversationId: "c1",
      endedAt: "2026-11-10T10:00:00Z",
      id: "p1",
      profileId: "me",
      revokedKind: "ended",
    });
  });

  it("maps an active row: no revoked kind", () => {
    expect(
      toMembershipPeriodChange({
        conversation_id: "c1",
        ended_at: null,
        id: "p1",
        profile_id: "me",
        revoked_kind: null,
      }),
    ).toMatchObject({ endedAt: null, revokedKind: null });
  });

  it("does not read the old technical end reason", () => {
    expect(
      toMembershipPeriodChange({
        conversation_id: "c1",
        end_reason: "GROUP_DELETED",
        ended_at: "2026-11-10T10:00:00Z",
        id: "p1",
        profile_id: "me",
      }),
    ).toMatchObject({ revokedKind: null });
  });

  it("rejects rows without identity", () => {
    expect(toMembershipPeriodChange(null)).toBeNull();
    expect(toMembershipPeriodChange("x")).toBeNull();
    expect(toMembershipPeriodChange({ id: "p1" })).toBeNull();
  });
});

describe("decideMembershipRevocation (DAS-REV-33 §23, §26)", () => {
  const base = { conversationId: "c1", currentPeriodId: "p1", myProfileId: "me" };
  const ended = toMembershipPeriodChange({
    conversation_id: "c1",
    ended_at: "2026-11-10T10:00:00Z",
    id: "p1",
    profile_id: "me",
    revoked_kind: "ended",
  });

  it("revokes when my observed period ends", () => {
    expect(decideMembershipRevocation({ ...base, change: ended })).toEqual({
      action: "revoke",
      reason: "ended",
    });
  });

  it("uses the deleted reason only when the server says revoked_kind = deleted", () => {
    const deleted = toMembershipPeriodChange({
      conversation_id: "c1",
      ended_at: "2026-11-10T10:00:00Z",
      id: "p1",
      profile_id: "me",
      revoked_kind: "deleted",
    });

    expect(decideMembershipRevocation({ ...base, change: deleted })).toEqual({
      action: "revoke",
      reason: "deleted",
    });
    expect(revocationMessage("deleted")).toBe("Il gruppo è stato eliminato.");
    expect(revocationMessage("ended")).toBe("Non fai più parte di questo gruppo.");
  });

  it("ignores updates that do not end a period", () => {
    const roleChange = toMembershipPeriodChange({
      conversation_id: "c1",
      ended_at: null,
      id: "p1",
      profile_id: "me",
    });

    expect(decideMembershipRevocation({ ...base, change: roleChange })).toEqual({ action: "ignore" });
  });

  it("ignores another conversation, another profile and a missing row", () => {
    const otherConversation = { ...ended!, conversationId: "c2" };
    const otherProfile = { ...ended!, profileId: "someone" };

    expect(decideMembershipRevocation({ ...base, change: otherConversation })).toEqual({
      action: "ignore",
    });
    expect(decideMembershipRevocation({ ...base, change: otherProfile })).toEqual({
      action: "ignore",
    });
    expect(decideMembershipRevocation({ ...base, change: null })).toEqual({ action: "ignore" });
  });

  it("does not eject me from a new period when an older one closes late", () => {
    const older = { ...ended!, id: "p0" };

    expect(decideMembershipRevocation({ ...base, change: older })).toEqual({ action: "ignore" });
  });

  it("asks the server when the observed period is not known yet", () => {
    expect(decideMembershipRevocation({ ...base, change: ended, currentPeriodId: null })).toEqual({
      action: "verify",
    });
  });
});

describe("classifyGroupAccessError", () => {
  it("reads PostgREST-shaped errors, which are not Error instances", () => {
    expect(classifyGroupAccessError({ message: "SOCIETY_GROUP_ARCHIVED" })).toBe("archived");
    expect(classifyGroupAccessError({ message: "SOCIETY_GROUP_DELETED" })).toBe("deleted");
    expect(classifyGroupAccessError({ message: "SOCIETY_GROUP_NOT_MEMBER" })).toBe("ended");
    expect(classifyGroupAccessError(new Error("SOCIETY_GROUP_ARCHIVED: x"))).toBe("archived");
  });

  it("treats an anonymous not-found as a lost access", () => {
    expect(classifyGroupAccessError({ message: "Conversazione non trovata" })).toBe("ended");
  });

  it("returns null for unrelated errors", () => {
    expect(classifyGroupAccessError({ message: "network" })).toBeNull();
    expect(classifyGroupAccessError(null)).toBeNull();
    expect(classifyGroupAccessError(undefined)).toBeNull();
    expect(classifyGroupAccessError(42)).toBeNull();
  });

  it("flags only lost access as non retryable", () => {
    expect(isAccessLostError({ message: "SOCIETY_GROUP_NOT_MEMBER" })).toBe(true);
    expect(isAccessLostError({ message: "SOCIETY_GROUP_DELETED" })).toBe(true);
    expect(isAccessLostError({ message: "SOCIETY_GROUP_ARCHIVED" })).toBe(false);
    expect(isAccessLostError({ message: "timeout" })).toBe(false);
  });
});

describe("isGroupComposerAvailable (DAS-REV-33 §21)", () => {
  it("follows the server canSend", () => {
    expect(isGroupComposerAvailable({ canSend: true })).toBe(true);
    expect(isGroupComposerAvailable({ canSend: false })).toBe(false);
  });

  it("keeps the composer while the meta is not loaded", () => {
    expect(isGroupComposerAvailable(null)).toBe(true);
  });
});

describe("shouldNavigateOnRevoke (DAS-REV-33 §26)", () => {
  it("navigates when the chat is the focused screen", () => {
    expect(shouldNavigateOnRevoke(true)).toBe(true);
  });

  it("stays silent when another screen (Info gruppo) is on top: one navigator wins", () => {
    expect(shouldNavigateOnRevoke(false)).toBe(false);
  });

  it("navigates when the focus state is unknown", () => {
    expect(shouldNavigateOnRevoke(undefined)).toBe(true);
  });
});

describe("messaging keys and routes", () => {
  it("isolates chat-media query keys by conversation prefix", () => {
    expect(isChatMediaQueryOf(["chat-media-url", "c1/abc-file.jpg"], "c1")).toBe(true);
    expect(isChatMediaQueryOf(["chat-media-url", "c2/abc-file.jpg"], "c1")).toBe(false);
    expect(isChatMediaQueryOf(["chat-media-url", "c10/abc"], "c1")).toBe(false);
    expect(isChatMediaQueryOf(["chat-media-url", null], "c1")).toBe(false);
    expect(isChatMediaQueryOf(["other", "c1/x"], "c1")).toBe(false);
  });

  it("builds the group info route", () => {
    expect(groupInfoRoute("abc")).toBe("/group-info/abc");
  });

  it("uses the same definition for the Dashboard entry, with only the origin added", () => {
    expect(groupInfoRoute("abc", "dashboard")).toBe("/group-info/abc?origin=dashboard");
  });
});
