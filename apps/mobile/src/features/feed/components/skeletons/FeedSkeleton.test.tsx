import React from "react";
import { describe, expect, it } from "vitest";

import { countTestId, hostByTestId, render } from "../feed-test-helpers";
import { ArticleSkeleton, FeedSkeleton, VideoPostSkeleton } from "./FeedSkeleton";

function ratioOf(node: { props: { style?: unknown } }): number | undefined {
  const style = node.props.style as { aspectRatio?: number } | { aspectRatio?: number }[];

  return (Array.isArray(style) ? style : [style]).find((entry) => entry?.aspectRatio !== undefined)
    ?.aspectRatio;
}

describe("FeedSkeleton — video e articolo (HOM-03 §123–125)", () => {
  it("la sequenza prevede lo skeleton video e quello articolo", () => {
    const tree = render(<FeedSkeleton />);

    expect(countTestId(tree, "feed-skeleton-position")).toBe(1);
    expect(countTestId(tree, "feed-skeleton-post")).toBe(1);
    expect(countTestId(tree, "feed-skeleton-video")).toBe(1);
    expect(countTestId(tree, "feed-skeleton-profiles")).toBe(1);
    expect(countTestId(tree, "feed-skeleton-article")).toBe(1);
  });

  it("video: autore, una riga di caption, area media 16:9, tre azioni (§124)", () => {
    const tree = render(<VideoPostSkeleton />);
    const [frame] = hostByTestId(tree, "feed-skeleton-video");
    const rows = frame.findAll(
      (node) => String(node.type) === "View" && node.props.style !== undefined,
    );
    const media = rows.find((node) => ratioOf(node) === 16 / 9);

    expect(media).toBeTruthy();
    // Una sola riga di caption (a differenza del Post, che ne ha due).
    const captionRows = frame.findAll(
      (node) =>
        String(node.type) === "View" &&
        Array.isArray(node.props.style) &&
        node.props.style.some((entry: { width?: string } | undefined) => entry?.width === "70%"),
    );
    expect(captionRows).toHaveLength(1);
  });

  it("articolo: autore, righe di titolo, miniatura piccola 96pt a destra, azioni (§125)", () => {
    const tree = render(<ArticleSkeleton />);
    const [frame] = hostByTestId(tree, "feed-skeleton-article");
    const thumb = frame.findAll(
      (node) =>
        String(node.type) === "View" &&
        ratioOf(node) === 4 / 5 &&
        (node.props.style as { width?: number }).width === 96,
    );

    expect(thumb).toHaveLength(1);
    // Nessuna area media 16:9 a tutta larghezza: è una preview compatta.
    expect(
      frame.findAll(
        (node) => String(node.type) === "View" && ratioOf(node) === 16 / 9,
      ),
    ).toHaveLength(0);
  });

  it("video e articolo non hanno segnalibro: tre aree azioni uguali", () => {
    for (const skeleton of [<VideoPostSkeleton key="v" />, <ArticleSkeleton key="a" />]) {
      const tree = render(skeleton);
      const actionRows = tree.root.findAll(
        (node) =>
          String(node.type) === "View" &&
          (node.props.style as { height?: number; marginTop?: number } | undefined)?.height === 44,
      );

      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].children).toHaveLength(3);
    }
  });
});
