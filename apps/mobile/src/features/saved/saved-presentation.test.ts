import { describe, expect, it } from "vitest";

import {
  SAVED_ANALYTICS_EVENT_NAMES,
  targetProps,
} from "./saved-analytics";
import {
  CONTENT_KIND_LABEL,
  SAVED_TAB_ITEMS,
  contentRowAccessibilityLabel,
  contentRowMeta,
  contentRowTitle,
  emptyCopy,
  flattenSavedPages,
  formatClock,
  parseSavedPage,
  parseSavedRow,
  positionRowMeta,
  positionRowSubtitle,
  positionRowTitle,
  profileRowSubtitle,
  resolveInitialCategory,
  saveFailureMessage,
  savedRowHref,
  societyRowSubtitle,
  societyRowTitle,
} from "./saved-presentation";
import type { SavedListRowWire, SavedPage, SavedRow } from "./saved-types";

function wire(overrides: Partial<SavedListRowWire>): SavedListRowWire {
  return {
    content_type: null,
    next_cursor: null,
    payload: {},
    saved_at: "2026-11-14T10:00:00Z",
    target_id: "t1",
    target_type: "profile",
    ...overrides,
  };
}

describe("categorie e ingresso (§105, §106)", () => {
  it("le quattro categorie definitive, nell'ordine del §105, senza «Squadre» (§82)", () => {
    expect(SAVED_TAB_ITEMS.map((item) => item.label)).toEqual([
      "Contenuti",
      "Profili",
      "Società",
      "Posizioni",
    ]);
  });

  it("?filter= resta compatibile con i vecchi ingressi", () => {
    expect(resolveInitialCategory("content")).toBe("content");
    expect(resolveInitialCategory("profile")).toBe("profile");
    expect(resolveInitialCategory("club")).toBe("society");
    expect(resolveInitialCategory("society")).toBe("society");
    expect(resolveInitialCategory("team")).toBe("society");
    expect(resolveInitialCategory("position")).toBe("position");
    expect(resolveInitialCategory("all")).toBe("content");
    expect(resolveInitialCategory(undefined)).toBe("content");
    expect(resolveInitialCategory(["profile", "x"])).toBe("profile");
  });
});

describe("copy (§95–§98, §152–§155, §158)", () => {
  it("gli empty state, senza illustrazioni né CTA inventate", () => {
    expect(emptyCopy("content")).toEqual({
      description: "I contenuti che salvi su PROLINK compariranno qui.",
      title: "Nessun contenuto salvato",
    });
    expect(emptyCopy("profile").title).toBe("Nessun profilo salvato");
    expect(emptyCopy("society").title).toBe("Nessuna società salvata");
    expect(emptyCopy("position").title).toBe("Nessuna posizione salvata");
  });

  it("il salvataggio fallito dice «salvare il contenuto», la rimozione il copy generico", () => {
    expect(saveFailureMessage("content", true)).toBe(
      "Non è stato possibile salvare il contenuto. Riprova.",
    );
    expect(saveFailureMessage("content", false)).toBe(
      "Non è stato possibile completare l'operazione.",
    );
    expect(saveFailureMessage("profile", false)).toBe(
      "Non è stato possibile completare l'operazione.",
    );
    expect(saveFailureMessage("profile", true)).not.toContain("contenuto");
  });
});

describe("parseSavedRow — parsing difensivo di list_saved", () => {
  it("contenuto: Articolo con titolo, autore verificato e data", () => {
    const row = parseSavedRow(
      wire({
        content_type: "club_media",
        payload: {
          author: { id: "c1", is_verified: true, name: "AC Como", type: "society" },
          duration_seconds: null,
          excerpt: "Sommario",
          item_kind: "article",
          published_at: "2026-11-14T08:00:00Z",
          thumbnail_url: "https://x/t.jpg",
          title: "Il nuovo progetto tecnico",
        },
        target_id: "p1",
        target_type: "content",
      }),
    );

    expect(row).toMatchObject({
      kind: "content",
      target: { contentType: "club_media", id: "p1", type: "content" },
    });
    expect(row?.kind === "content" && row.payload.author?.is_verified).toBe(true);
    expect(row?.kind === "content" && row.payload.item_kind).toBe("article");
  });

  it("un content_type sconosciuto scarta la riga invece di far cadere la lista", () => {
    expect(
      parseSavedRow(wire({ content_type: "boh", target_id: "p1", target_type: "content" })),
    ).toBeNull();
    expect(parseSavedRow(wire({ target_type: "boh" }))).toBeNull();
    expect(parseSavedRow(wire({ target_id: "" }))).toBeNull();
  });

  it("un payload mancante o malformato non lancia", () => {
    const row = parseSavedRow(wire({ payload: null, target_type: "position" }));

    expect(row).toMatchObject({ kind: "position", payload: { lifecycle: "open" } });
    expect(
      parseSavedRow(wire({ content_type: "profile_post", payload: "x", target_type: "content" })),
    ).toMatchObject({ payload: { item_kind: "post", author: null } });
  });

  it("società: «club» e «society» sono lo stesso target; la squadra resta un target a sé (§82)", () => {
    expect(parseSavedRow(wire({ target_type: "club" }))?.kind).toBe("society");
    expect(parseSavedRow(wire({ target_type: "society" }))?.target).toEqual({
      id: "t1",
      type: "society",
    });
    expect(parseSavedRow(wire({ target_type: "team" }))?.target).toEqual({ id: "t1", type: "team" });
  });

  it("posizione: role_label è il ruolo mostrato, il `title` è il ripiego; squadra e media usano i loro campi", () => {
    const withLabel = parseSavedRow(
      wire({
        payload: { role_label: "Portiere", title: "Cercasi portiere Under 18" },
        target_type: "position",
      }),
    );
    expect(withLabel?.kind === "position" && positionRowTitle(withLabel.payload)).toBe("Portiere");

    const position = parseSavedRow(
      wire({ payload: { club_name: "AC Como", title: "Portiere Under 18" }, target_type: "position" }),
    );
    expect(position?.kind === "position" && positionRowTitle(position.payload)).toBe(
      "Portiere Under 18",
    );

    const team = parseSavedRow(
      wire({
        payload: { club_category: "Serie D", team_category: "Under 18" },
        target_type: "team",
      }),
    ) as Extract<SavedRow, { kind: "team" }>;
    expect(societyRowSubtitle(team)).toBe("Squadra");

    const media = parseSavedRow(
      wire({ payload: { media_kind: "testata", name: "Como News", role: "media" }, target_type: "profile" }),
    );
    expect(media?.kind === "profile" && profileRowSubtitle(media.payload)).toBe("Testata sportiva");
  });

  it("posizione chiusa ma consultabile (§149–§150)", () => {
    const row = parseSavedRow(
      wire({ payload: { lifecycle: "closed", role_label: "Portiere" }, target_type: "position" }),
    );

    expect(row?.kind === "position" && row.payload.lifecycle).toBe("closed");
  });
});

describe("parseSavedPage e dedupe (§160–§161)", () => {
  it("il cursore è quello dell'ultima riga; nessuno = fine lista", () => {
    const withCursor = parseSavedPage([
      wire({ target_id: "a" }),
      wire({ next_cursor: { k: "profile:b", ts: "2026-11-14T09:00:00Z" }, target_id: "b" }),
    ]);

    expect(withCursor.rows).toHaveLength(2);
    expect(withCursor.nextCursor).toEqual({ k: "profile:b", ts: "2026-11-14T09:00:00Z" });
    expect(parseSavedPage([wire({ target_id: "a" })]).nextCursor).toBeNull();
    expect(parseSavedPage([]).nextCursor).toBeNull();
  });

  it("nessun target duplicato tra pagine; vale la prima occorrenza e l'ordine resta", () => {
    const page = (ids: string[]): SavedPage => ({
      nextCursor: null,
      rows: ids.map((id) => parseSavedRow(wire({ target_id: id })) as SavedRow),
    });

    const flat = flattenSavedPages([page(["a", "b"]), page(["b", "c"])]);

    expect(flat.map((row) => row.target.id)).toEqual(["a", "b", "c"]);
    expect(flattenSavedPages(undefined)).toEqual([]);
  });

  it("lo stesso id su target diversi non è un duplicato", () => {
    const flat = flattenSavedPages([
      {
        nextCursor: null,
        rows: [
          parseSavedRow(wire({ target_id: "x", target_type: "profile" })) as SavedRow,
          parseSavedRow(wire({ target_id: "x", target_type: "society" })) as SavedRow,
        ],
      },
    ]);

    expect(flat).toHaveLength(2);
  });
});

describe("destinazioni (§114, §123–§126)", () => {
  it("ogni riga apre il canonico del suo target", () => {
    const href = (overrides: Partial<SavedListRowWire>) =>
      savedRowHref(parseSavedRow(wire({ target_id: "z", ...overrides })) as SavedRow);

    expect(href({ content_type: "club_media", target_type: "content" })).toBe(
      "/content/club_media/z?origin=SAVED",
    );
    expect(href({ content_type: "profile_post", target_type: "content" })).toBe(
      "/content/profile_post/z?origin=SAVED",
    );
    expect(href({ target_type: "profile" })).toBe("/profile/z");
    expect(href({ target_type: "society" })).toBe("/club/z");
    expect(href({ target_type: "team" })).toBe("/club/team/z");
    expect(href({ target_type: "position" })).toBe("/position/z");
  });
});

describe("testi di riga", () => {
  it("etichette discrete POST / VIDEO / ARTICOLO (§113)", () => {
    expect(CONTENT_KIND_LABEL).toEqual({ article: "ARTICOLO", post: "POST", video: "VIDEO" });
  });

  it("durata del video «03:24» (§111)", () => {
    expect(formatClock(204)).toBe("03:24");
    expect(formatClock(5)).toBe("00:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("00:00");
  });

  it("Post text-only: le prime righe del body, nessun placeholder (§110); Articolo: il titolo (§112)", () => {
    const base = {
      author: null,
      duration_seconds: null,
      published_at: null,
      thumbnail_url: null,
    };

    expect(
      contentRowTitle({ ...base, excerpt: "Nuova stagione", item_kind: "post", title: null }),
    ).toBe("Nuova stagione");
    expect(
      contentRowTitle({ ...base, excerpt: "Sommario", item_kind: "article", title: "Titolo" }),
    ).toBe("Titolo");
    expect(
      contentRowTitle({ ...base, excerpt: "Sommario", item_kind: "video", title: null }),
    ).toBe("Sommario");
    expect(contentRowTitle({ ...base, excerpt: null, item_kind: "post", title: null })).toBe(
      "Post con contenuti multimediali",
    );
  });

  it("riga autore: «AC Como · 2 h», senza testo se mancano i dati", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    const payload = {
      author: { id: "c", is_verified: true, name: "AC Como", type: "society" },
      duration_seconds: null,
      excerpt: null,
      item_kind: "post" as const,
      published_at: "2026-11-14T08:00:00Z",
      thumbnail_url: null,
      title: null,
    };

    expect(contentRowMeta(payload, now)).toBe("AC Como · 2 h");
    expect(contentRowMeta({ ...payload, author: null, published_at: null }, now)).toBe("");
  });

  it("la riga è una sola unità semantica: tipo, titolo, autore, verifica e tempo (§179)", () => {
    const now = new Date("2026-11-14T10:00:00Z");

    expect(
      contentRowAccessibilityLabel(
        {
          author: { id: "c", is_verified: true, name: "AC Como", type: "society" },
          duration_seconds: 204,
          excerpt: null,
          item_kind: "video",
          published_at: "2026-11-14T08:00:00Z",
          thumbnail_url: "https://x/t.jpg",
          title: "Highlights: Como - Lecco 2-1",
        },
        now,
      ),
    ).toBe("Video, Highlights: Como - Lecco 2-1, AC Como, profilo verificato, 2 h");
  });

  it("profilo: ruolo canonico («Procuratore», non «Agente») e società (§51, §123)", () => {
    const base = {
      avatar_url: null,
      club_name: null,
      is_verified: false,
      name: "Alessio Conti",
      primary_position: null,
      role: "agent",
      team_label: null,
    };

    expect(profileRowSubtitle(base)).toBe("Procuratore");
    expect(profileRowSubtitle({ ...base, club_name: "AC Como", role: "coach" })).toBe(
      "Allenatore · AC Como",
    );
    expect(profileRowSubtitle({ ...base, role: null })).toBe("");
  });

  it("società e squadra: «Squadra · Società» dentro la stessa categoria (§82, §125)", () => {
    const club = parseSavedRow(
      wire({ payload: { club_category: "Serie D", name: "Varese Calcio" }, target_type: "society" }),
    ) as Extract<SavedRow, { kind: "society" }>;
    const team = parseSavedRow(
      wire({
        payload: { club_category: "Primavera", club_name: "AC Como", name: "Under 18" },
        target_type: "team",
      }),
    ) as Extract<SavedRow, { kind: "team" }>;

    expect(societyRowTitle(club)).toBe("Varese Calcio");
    expect(societyRowSubtitle(club)).toBe("Serie D");
    expect(societyRowTitle(team)).toBe("Under 18");
    expect(societyRowSubtitle(team)).toBe("Squadra · AC Como");
  });

  it("posizione: ruolo, società e squadra, categoria e località; mai scadenza o candidati (§127–§128)", () => {
    const payload = {
      category: "Serie C",
      club_name: "AC Como",
      lifecycle: "open" as const,
      location: "Como",
      role_label: "Portiere",
      target_role: "player",
      team_label: "Prima squadra",
    };

    expect(positionRowTitle(payload)).toBe("Portiere");
    expect(positionRowSubtitle(payload)).toBe("AC Como · Prima squadra");
    expect(positionRowMeta(payload)).toBe("Serie C · Como");
    expect(positionRowTitle({ ...payload, role_label: null })).toBe("Calciatore");
    expect(Object.keys(payload)).not.toEqual(
      expect.arrayContaining(["deadline", "applicants", "match_score"]),
    );
  });
});

describe("analytics Salvati (§189–§190)", () => {
  it("i dieci eventi Salvati del §189, in forma tipizzata", () => {
    expect([...SAVED_ANALYTICS_EVENT_NAMES]).toEqual([
      "save_attempt",
      "save_success",
      "unsave_attempt",
      "unsave_success",
      "save_failure",
      "saved_center_open",
      "saved_category_changed",
      "saved_target_open",
      "saved_target_removed",
      "saved_remove_undo",
    ]);
  });

  it("le proprietà non portano mai id, titolo o testo del contenuto (§190)", () => {
    const props = targetProps(
      { contentType: "club_media", id: "segreto-123", type: "content" },
      "feed",
    );

    expect(props).toEqual({ contentType: "club_media", surface: "feed", targetType: "content" });
    expect(JSON.stringify(props)).not.toContain("segreto-123");
    expect(targetProps({ id: "u1", type: "profile" }, "search").contentType).toBeNull();
  });
});
