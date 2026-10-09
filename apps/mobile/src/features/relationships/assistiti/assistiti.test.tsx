/**
 * Scenari QA della gestione assistiti (REV-PROF-14).
 *
 * Coprono i punti dove sbagliare costa davvero: cosa entra e cosa non entra nel
 * portfolio, cosa finisce dentro un link di invito, quando un invito può dirsi
 * condiviso, e il fatto che un record manuale non possa diventare pubblico
 * nemmeno premendo il pulsante sbagliato.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AssistitoRow,
  describeAssistitiError,
  filterAssistiti,
  formatIsoDate,
  formatRelativeDay,
  getInviteStatusLabel,
  getRelationshipShortLabel,
  isClosedRow,
  isFutureDate,
  normalizeAssistitoName,
  parseStartDateInput,
} from "./assistiti-model";
import {
  buildAssistitiSearchPayload,
  countActiveSearchFilters,
  EMPTY_SEARCH_FILTERS,
} from "./AssistitiSearchFilters";

const clipboardSpy = vi.fn(async (_value: string) => undefined);

vi.mock("expo-clipboard", () => ({
  setStringAsync: (value: string) => clipboardSpy(value),
}));

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("Ionicon", props),
}));

const linkingState = {
  canOpen: true,
  opened: [] as string[],
};
const shareState = { action: "sharedAction" as string, calls: [] as string[] };

vi.mock("react-native", async () => {
  const actual =
    await vi.importActual<typeof import("../../../test/react-native")>(
      "../../../test/react-native",
    );

  return {
    ...actual,
    Linking: {
      ...actual.Linking,
      canOpenURL: async () => linkingState.canOpen,
      openURL: async (url: string) => {
        linkingState.opened.push(url);
        return true;
      },
    },
    Share: {
      dismissedAction: "dismissedAction",
      share: async ({ message }: { message: string }) => {
        shareState.calls.push(message);
        return { action: shareState.action };
      },
      sharedAction: "sharedAction",
    },
  };
});

const {
  buildAssistitoInviteUrl,
  buildInviteMessage,
  consumePendingInviteToken,
  copyInviteLink,
  shareViaSystem,
  shareViaWhatsApp,
  storePendingInviteToken,
} = await import("./assistiti-invite-link");
const { AssistitoCard, describeRowState, VisibilityChoice } = await import(
  "./assistiti-ui"
);

function makeRow(overrides: Partial<AssistitoRow> = {}): AssistitoRow {
  return {
    avatar_url: null,
    created_at: "2026-09-01T10:00:00.000Z",
    ended_on: null,
    full_name: "Luca Bianchi",
    id: "row-1",
    invite_channel: null,
    invite_expires_at: null,
    invite_id: null,
    invite_shared_at: null,
    invite_status: null,
    kind: "representation",
    player_profile_id: "player-1",
    primary_position: "forward",
    relationship_type: "procuratore",
    started_on: null,
    status: "accepted",
    team_label: "Serie A",
    visibility: "public",
    ...overrides,
  };
}

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("portfolio: cosa entra in ogni selezione", () => {
  const activePublic = makeRow({ id: "a" });
  const activePrivate = makeRow({ id: "b", visibility: "private" });
  const pending = makeRow({ id: "c", status: "pending", visibility: "private" });
  const terminated = makeRow({ id: "d", status: "terminated" });
  const manualOpen = makeRow({
    id: "e",
    invite_id: "inv-1",
    invite_status: "shared",
    kind: "manual",
    player_profile_id: null,
    status: "active",
    visibility: "private",
  });
  const manualRevoked = makeRow({
    id: "f",
    invite_id: "inv-2",
    invite_status: "revoked",
    kind: "manual",
    player_profile_id: null,
    status: "active",
    visibility: "private",
  });

  const rows = [
    activePublic,
    activePrivate,
    pending,
    terminated,
    manualOpen,
    manualRevoked,
  ];

  it("tiene fuori da 'Tutti' i rapporti conclusi e gli inviti chiusi", () => {
    expect(filterAssistiti(rows, "all").map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
      "e",
    ]);
  });

  it("conta come privati solo i rapporti attivi e privati, mai le richieste", () => {
    expect(filterAssistiti(rows, "private").map((row) => row.id)).toEqual(["b"]);
  });

  it("tiene le richieste pendenti separate dagli inviti manuali", () => {
    expect(filterAssistiti(rows, "pending").map((row) => row.id)).toEqual(["c"]);
    expect(filterAssistiti(rows, "invites").map((row) => row.id)).toEqual(["e"]);
  });

  it("considera concluso un invito revocato, non uno condiviso", () => {
    expect(isClosedRow(manualRevoked)).toBe(true);
    expect(isClosedRow(manualOpen)).toBe(false);
  });
});

describe("link di invito", () => {
  beforeEach(() => {
    linkingState.canOpen = true;
    linkingState.opened = [];
    shareState.action = "sharedAction";
    shareState.calls = [];
    clipboardSpy.mockClear();
  });

  it("mette nel link il solo token, senza dati personali", () => {
    const url = buildAssistitoInviteUrl("abc123");

    expect(url).toBe("footme://assistito-invite/abc123");
    expect(url).not.toMatch(/bianchi|luca|procuratore|serie/i);
  });

  it("nomina il destinatario solo quando il procuratore lo ha scritto", () => {
    const anonymous = buildInviteMessage({ link: "L" });
    const named = buildInviteMessage({ link: "L", recipientName: "Matteo" });

    expect(anonymous.startsWith("Ciao,")).toBe(true);
    expect(named.startsWith("Ciao Matteo,")).toBe(true);
    expect(anonymous).toContain("L");
  });

  it("apre WhatsApp senza inviare e ripiega sulla share sheet se manca", async () => {
    expect(await shareViaWhatsApp("messaggio")).toBe("shared");
    expect(linkingState.opened[0]).toContain("whatsapp://send?text=");
    expect(shareState.calls).toHaveLength(0);

    linkingState.canOpen = false;

    expect(await shareViaWhatsApp("messaggio")).toBe("shared");
    expect(shareState.calls).toEqual(["messaggio"]);
  });

  it("non considera condiviso un invito quando la share sheet viene annullata", async () => {
    shareState.action = "dismissedAction";

    expect(await shareViaSystem("messaggio")).toBe("dismissed");
  });

  it("copia il link negli appunti", async () => {
    expect(await copyInviteLink("footme://assistito-invite/t")).toBe(true);
    expect(clipboardSpy).toHaveBeenCalledWith("footme://assistito-invite/t");
  });

  it("consuma il token messo da parte una volta sola", async () => {
    await storePendingInviteToken("tok-1");

    expect(await consumePendingInviteToken()).toBe("tok-1");
    expect(await consumePendingInviteToken()).toBeNull();
  });
});

describe("validazioni del form manuale", () => {
  it("accetta anno o data completa e rifiuta il resto", () => {
    expect(parseStartDateInput("2024")).toBe("2024-01-01");
    expect(parseStartDateInput("01/03/2024")).toBe("2024-03-01");
    expect(parseStartDateInput("marzo")).toBeNull();
    expect(parseStartDateInput("")).toBeNull();
  });

  it("riconosce una data futura come non valida", () => {
    const now = new Date("2026-10-02T00:00:00.000Z");

    expect(isFutureDate("2026-12-01", now)).toBe(true);
    expect(isFutureDate("2024-01-01", now)).toBe(false);
  });

  it("normalizza il nome come fa il database", () => {
    expect(normalizeAssistitoName("  Luca   BIANCHI ")).toBe("luca bianchi");
  });

  it("formatta la data iniziale per la lettura", () => {
    expect(formatIsoDate("2024-03-01")).toBe("01/03/2024");
    expect(formatIsoDate(null)).toBe("");
  });
});

describe("messaggi di errore", () => {
  it("traduce i codici tecnici in testo per l'utente", () => {
    expect(describeAssistitiError(new Error("RATE_LIMIT"), "x")).toBe(
      "Hai effettuato troppi tentativi. Riprova più tardi.",
    );
    expect(describeAssistitiError(new Error("DUPLICATE_SUSPECTED"), "x")).toBe(
      "Questo record potrebbe essere già presente.",
    );
    expect(describeAssistitiError(new Error("INVITE_EXPIRED"), "x")).toBe(
      "Il link non è più valido.",
    );
  });

  it("usa il messaggio di contesto quando l'errore non è noto", () => {
    expect(describeAssistitiError(new Error("boom"), "Riprova.")).toBe(
      "Riprova.",
    );
  });
});

describe("stato e card", () => {
  it("accompagna ogni stato con un testo, non solo con un'icona", () => {
    expect(describeRowState(makeRow()).label).toBe("Pubblico");
    expect(describeRowState(makeRow({ visibility: "private" })).label).toBe(
      "Privato",
    );
    expect(describeRowState(makeRow({ status: "pending" })).label).toBe(
      "In attesa",
    );
    expect(
      describeRowState(
        makeRow({ invite_status: "shared", kind: "manual" }),
      ).label,
    ).toBe("Condivisione completata");
  });

  it("non mette nessuna icona cestino sulla card", () => {
    const tree = render(
      <AssistitoCard onPress={() => undefined} row={makeRow()} />,
    );
    const icons = tree.root
      .findAllByType("Ionicon" as never)
      .map((node) => String(node.props.name));

    expect(icons.some((name) => name.includes("trash"))).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain("Procura");
  });

  it("usa l'etichetta breve del rapporto sulle card", () => {
    expect(getRelationshipShortLabel("intermediario")).toBe("Intermediazione");
    expect(getInviteStatusLabel(null)).toBe("Invito da creare");
  });

  it("formatta le date relative degli inviti", () => {
    const now = new Date("2026-10-02T12:00:00.000Z");

    expect(formatRelativeDay("2026-10-02T08:00:00.000Z", now)).toBe("oggi");
    expect(formatRelativeDay("2026-10-01T08:00:00.000Z", now)).toBe("ieri");
    expect(formatRelativeDay(null, now)).toBe("—");
  });
});

describe("visibilità del record manuale", () => {
  /**
   * Il divieto vero sta nel database (`check (visibility = 'private')`) e nel
   * fatto che il form manuale non monta affatto questo selettore. Qui si
   * verifica il terzo strato: quando il selettore viene usato in sola lettura,
   * passa `disabled` al Pressable e lo annuncia allo screen reader, cosi' il
   * runtime di React Native non fa partire nessun tocco.
   */
  it("resta inerte e lo dichiara quando è bloccato", () => {
    const tree = render(
      <VisibilityChoice disabled onChange={() => undefined} value="private" />,
    );

    const publicOption = tree.root.find(
      (node) =>
        typeof node.type === "string" && node.props?.testID === "visibility-public",
    );

    expect(publicOption.props.disabled).toBe(true);
    expect(publicOption.props.accessibilityState?.disabled).toBe(true);
  });
});

describe("filtri della ricerca", () => {
  it("traduce i quattro filtri nel payload della RPC esistente", () => {
    const payload = buildAssistitiSearchPayload({
      ageBand: "u21",
      category: "Serie B",
      position: "goalkeeper",
      region: "Lazio",
    });

    expect(payload?.region).toBe("Lazio");
    expect(payload?.player?.positions).toEqual(["goalkeeper"]);
    expect(payload?.player?.categories).toEqual(["Serie B"]);
    expect(payload?.player?.classe_min).toBe(new Date().getFullYear() - 20);
  });

  it("collassa a null quando non c'è nessun filtro attivo", () => {
    expect(buildAssistitiSearchPayload(EMPTY_SEARCH_FILTERS)).toBeNull();
    expect(countActiveSearchFilters(EMPTY_SEARCH_FILTERS)).toBe(0);
  });
});
