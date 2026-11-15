/**
 * La route del flow Segnala: href, parsing dei parametri, target non validi (HOM-11 §79,
 * §116–§119, D7).
 */
import { describe, expect, it } from "vitest";

import { parseReportTarget, parseReportTargetType, reportHref } from "./moderation-routes";

describe("reportHref — D7", () => {
  it("contenuto: tipo contenuto e origin in query, un segmento per tipo di target", () => {
    expect(
      reportHref({
        contentType: "club_media",
        origin: "HOME_PER_TE",
        parentContentId: null,
        targetId: "p-1",
        targetType: "CONTENT",
      }),
    ).toBe("/report/content/p-1?contentType=club_media&origin=HOME_PER_TE");
  });

  it("commento: id del commento, tipo e id del contenuto padre (§104, §132)", () => {
    expect(
      reportHref({
        contentType: "profile_post",
        origin: "HOME_SEGUITI",
        parentContentId: "p-1",
        targetId: "c-1",
        targetType: "COMMENT",
      }),
    ).toBe("/report/comment/c-1?contentType=profile_post&contentId=p-1&origin=HOME_SEGUITI");
  });

  it("senza origin la query non lo porta", () => {
    expect(
      reportHref({
        contentType: "media_profile",
        origin: null,
        parentContentId: null,
        targetId: "a-1",
        targetType: "CONTENT",
      }),
    ).toBe("/report/content/a-1?contentType=media_profile");
  });
});

describe("parseReportTargetType", () => {
  it("accetta i due segmenti, in qualunque maiuscola", () => {
    expect(parseReportTargetType("content")).toBe("CONTENT");
    expect(parseReportTargetType("COMMENT")).toBe("COMMENT");
    expect(parseReportTargetType(["comment"])).toBe("COMMENT");
  });

  it("un segmento sconosciuto non è un target", () => {
    expect(parseReportTargetType("profile")).toBeNull();
    expect(parseReportTargetType(undefined)).toBeNull();
  });
});

describe("parseReportTarget", () => {
  const base = { contentId: undefined, contentType: "club_media", id: "p-1", origin: "HOME_PER_TE", targetType: "content" };

  it("un contenuto valido", () => {
    expect(parseReportTarget(base)).toEqual({
      contentType: "club_media",
      origin: "HOME_PER_TE",
      parentContentId: null,
      targetId: "p-1",
      targetType: "CONTENT",
    });
  });

  it("un commento porta il contenuto padre", () => {
    expect(
      parseReportTarget({ ...base, contentId: "p-9", id: "c-1", targetType: "comment" }),
    ).toEqual({
      contentType: "club_media",
      origin: "HOME_PER_TE",
      parentContentId: "p-9",
      targetId: "c-1",
      targetType: "COMMENT",
    });
  });

  it("un'origin sconosciuta vale «nessuna provenienza»", () => {
    expect(parseReportTarget({ ...base, origin: "boh" })?.origin).toBeNull();
    expect(parseReportTarget({ ...base, origin: undefined })?.origin).toBeNull();
  });

  it("senza id, tipo o con un segmento sconosciuto non c'è un target (§159)", () => {
    expect(parseReportTarget({ ...base, id: undefined })).toBeNull();
    expect(parseReportTarget({ ...base, contentType: undefined })).toBeNull();
    expect(parseReportTarget({ ...base, targetType: "profilo" })).toBeNull();
  });

  it("un CONTENT con un tipo contenuto sconosciuto non è segnalabile; un COMMENT sì (il tipo è del padre)", () => {
    expect(parseReportTarget({ ...base, contentType: "robot" })).toBeNull();
    expect(
      parseReportTarget({ ...base, contentType: "robot", id: "c-1", targetType: "comment" }),
    ).not.toBeNull();
  });
});
