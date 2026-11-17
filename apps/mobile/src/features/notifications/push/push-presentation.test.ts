import { describe, expect, it } from "vitest";

import {
  conversationPushLink,
  extractConversationPush,
  extractNotificationId,
  foregroundPresentation,
  isConversationPush,
  notificationOpenHref,
  pushActionLabel,
  pushPermissionAction,
  pushRegistrationBlocker,
  pushStatusHint,
  pushStatusLabel,
  pushTogglesBlocked,
  resolveExpoProjectId,
  resolvePushPermission,
} from "./push-presentation";

const ID = "3f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";

describe("resolvePushPermission", () => {
  it("riconosce il permesso concesso", () => {
    expect(resolvePushPermission({ granted: true, status: "granted" }).state).toBe("granted");
    expect(resolvePushPermission({ status: "granted" }).state).toBe("granted");
  });

  it("distingue non determinato da negato", () => {
    expect(resolvePushPermission({ canAskAgain: true, status: "undetermined" })).toEqual({
      canAskAgain: true,
      state: "undetermined",
    });
    expect(resolvePushPermission({ canAskAgain: false, status: "denied" })).toEqual({
      canAskAgain: false,
      state: "denied",
    });
  });

  it("senza risposta (web, modulo assente) è non supportato", () => {
    expect(resolvePushPermission(null).state).toBe("unsupported");
  });

  it("un negato senza canAskAgain non si può richiedere", () => {
    expect(resolvePushPermission({ status: "denied" }).canAskAgain).toBe(false);
  });
});

describe("azione e testi (§183-§186)", () => {
  it("granted e unsupported non hanno CTA", () => {
    expect(pushPermissionAction({ canAskAgain: true, state: "granted" })).toBe("none");
    expect(pushPermissionAction({ canAskAgain: false, state: "unsupported" })).toBe("none");
    expect(pushActionLabel("none")).toBeNull();
  });

  it("richiedibile: chiede il permesso; altrimenti apre le impostazioni (§185)", () => {
    expect(pushPermissionAction({ canAskAgain: true, state: "undetermined" })).toBe("request");
    expect(pushPermissionAction({ canAskAgain: true, state: "denied" })).toBe("request");
    expect(pushPermissionAction({ canAskAgain: false, state: "denied" })).toBe("open_settings");
  });

  it("lo stato dice Attive solo col permesso reale (§186)", () => {
    expect(pushStatusLabel({ canAskAgain: true, state: "granted" })).toBe("Notifiche push — Attive");
    expect(pushStatusLabel({ canAskAgain: false, state: "denied" })).toBe(
      "Notifiche push — Disattivate",
    );
    expect(pushStatusLabel({ canAskAgain: true, state: "undetermined" })).toBe(
      "Notifiche push — Disattivate",
    );
  });

  it("con permesso negato il testo dichiara che le push non arrivano", () => {
    expect(pushStatusHint({ canAskAgain: false, state: "denied" })).toContain("non riceverai push");
    expect(pushTogglesBlocked({ canAskAgain: false, state: "denied" })).toBe(true);
    expect(pushTogglesBlocked({ canAskAgain: true, state: "granted" })).toBe(false);
  });
});

describe("extractNotificationId (§211)", () => {
  it("legge notification_id uuid dal payload", () => {
    expect(extractNotificationId({ notification_id: ID })).toBe(ID);
  });

  it("scarta payload assenti o non uuid, che finirebbero in un path", () => {
    expect(extractNotificationId(null)).toBeNull();
    expect(extractNotificationId({})).toBeNull();
    expect(extractNotificationId({ notification_id: 12 })).toBeNull();
    expect(extractNotificationId({ notification_id: "../settings" })).toBeNull();
    expect(extractNotificationId({ notification_id: `${ID}&x=1` })).toBeNull();
  });

  it("costruisce la destinazione del tap (§177)", () => {
    expect(notificationOpenHref(ID)).toBe(`/notifications?open=${ID}`);
  });
});

const PERIOD = "9f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";
const OTHER_CONVERSATION = "aaaaaaaa-1d2a-4c3b-9a7e-0123456789ab";

describe("extractConversationPush (DAS-REV-34 §20, §25)", () => {
  it("legge {conversation_id, period_id, kind} di una push chat di gruppo", () => {
    expect(extractConversationPush({ conversation_id: ID, kind: "message", period_id: PERIOD })).toEqual({
      conversationId: ID,
      kind: "message",
      periodId: PERIOD,
    });
  });

  it("una DIRECT non ha periodo (assente o null)", () => {
    expect(extractConversationPush({ conversation_id: ID, kind: "message" })?.periodId).toBeNull();
    expect(extractConversationPush({ conversation_id: ID, kind: "message", period_id: null })?.periodId).toBeNull();
  });

  it("lifecycle (Archive/Reactivate) è un kind valido", () => {
    expect(extractConversationPush({ conversation_id: ID, kind: "lifecycle", period_id: PERIOD })?.kind).toBe(
      "lifecycle",
    );
  });

  it("scarta ciò che non è un payload chat valido", () => {
    expect(extractConversationPush(null)).toBeNull();
    expect(extractConversationPush({})).toBeNull();
    expect(extractConversationPush({ notification_id: ID })).toBeNull();
    expect(extractConversationPush({ conversation_id: ID })).toBeNull();
    expect(extractConversationPush({ conversation_id: ID, kind: "admin" })).toBeNull();
    expect(extractConversationPush({ conversation_id: "../x", kind: "message" })).toBeNull();
    expect(extractConversationPush({ conversation_id: ID, kind: "message", period_id: "x&y=1" })).toBeNull();
  });

  it("il payload della campanella (notification_id) non è un payload chat e viceversa", () => {
    expect(extractNotificationId({ conversation_id: ID, kind: "message" })).toBeNull();
    expect(isConversationPush({ notification_id: ID })).toBe(false);
    expect(isConversationPush({ conversation_id: ID, kind: "message" })).toBe(true);
  });

  it("l'intento verso il resolver è il kind: `message` o `lifecycle`", () => {
    const message = extractConversationPush({ conversation_id: ID, kind: "message", period_id: PERIOD });
    const lifecycle = extractConversationPush({ conversation_id: ID, kind: "lifecycle", period_id: PERIOD });

    expect(conversationPushLink(message!)).toEqual({ conversationId: ID, intent: "message", periodId: PERIOD });
    expect(conversationPushLink(lifecycle!)).toEqual({ conversationId: ID, intent: "lifecycle", periodId: PERIOD });
  });
});

describe("foregroundPresentation (DAS-REV-34 §20)", () => {
  const CHAT = { conversation_id: ID, kind: "message", period_id: PERIOD };

  it("la push della conversazione visibile non mostra banner né lista né suono", () => {
    expect(foregroundPresentation(CHAT, ID, true)).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });

  it("soppressione solo per la stessa conversazione: un'altra chat si presenta", () => {
    expect(foregroundPresentation(CHAT, OTHER_CONVERSATION, false)).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it("nessuna chat visibile: si presenta come sempre (suono solo su Android)", () => {
    expect(foregroundPresentation(CHAT, null, false)).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
    expect(foregroundPresentation(CHAT, null, true).shouldPlaySound).toBe(true);
  });

  it("le push della campanella non si sopprimono mai, nemmeno con una chat aperta", () => {
    expect(foregroundPresentation({ notification_id: ID }, ID, false)).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it("anche il lifecycle della chat aperta si sopprime (stessa conversazione)", () => {
    expect(
      foregroundPresentation({ conversation_id: ID, kind: "lifecycle", period_id: PERIOD }, ID, false)
        .shouldShowBanner,
    ).toBe(false);
  });

  it("payload assente o malformato: si presenta", () => {
    expect(foregroundPresentation(undefined, ID, false).shouldShowBanner).toBe(true);
    expect(foregroundPresentation({}, ID, false).shouldShowBanner).toBe(true);
  });
});

describe("resolveExpoProjectId", () => {
  it("preferisce easConfig, poi expoConfig.extra.eas", () => {
    expect(
      resolveExpoProjectId({
        easConfig: { projectId: "a" },
        expoConfig: { extra: { eas: { projectId: "b" } } },
      }),
    ).toBe("a");
    expect(resolveExpoProjectId({ expoConfig: { extra: { eas: { projectId: "b" } } } })).toBe("b");
  });

  it("senza projectId valido restituisce null", () => {
    expect(resolveExpoProjectId({})).toBeNull();
    expect(resolveExpoProjectId({ easConfig: { projectId: "  " } })).toBeNull();
    expect(resolveExpoProjectId({ easConfig: { projectId: 3 } })).toBeNull();
  });
});

describe("pushRegistrationBlocker", () => {
  it("registra solo su device fisico con permesso concesso", () => {
    expect(pushRegistrationBlocker({ isDevice: true, permission: "granted", platform: "ios" })).toBeNull();
    expect(pushRegistrationBlocker({ isDevice: true, permission: "granted", platform: "web" })).toBe(
      "unsupported_platform",
    );
    expect(
      pushRegistrationBlocker({ isDevice: false, permission: "granted", platform: "android" }),
    ).toBe("not_physical_device");
    expect(
      pushRegistrationBlocker({ isDevice: true, permission: "undetermined", platform: "android" }),
    ).toBe("permission_not_granted");
  });
});
