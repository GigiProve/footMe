import { describe, expect, it } from "vitest";

import {
  extractNotificationId,
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
