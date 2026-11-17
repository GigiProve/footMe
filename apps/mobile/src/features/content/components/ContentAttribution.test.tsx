import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ContentAttribution } from "./ContentAttribution";
import type { ContentTaggedTarget } from "./TaggedProfilesSheet";

function target(id: string, name: string): ContentTaggedTarget {
  return {
    avatar_url: null,
    display_name: name,
    subtitle: "Calciatore",
    target_id: id,
    target_type: "profile",
  };
}

function collectText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(collectText).join("");
  }
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    (children as { props?: { children?: unknown } }).props
  ) {
    return collectText((children as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function hasText(root: TestRenderer.ReactTestInstance, value: string) {
  return (
    root.findAll((node) => collectText(node.props.children).includes(value))
      .length > 0
  );
}

describe("ContentAttribution", () => {
  it("mostra «con X e altri N», la firma con «·» e apre ogni profilo taggato", () => {
    const onOpenTarget = vi.fn();
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ContentAttribution
          authorName="Luca Verdi"
          onOpenTarget={onOpenTarget}
          readingLabel="3 min di lettura"
          tagged={[
            target("p1", "Marco Rossi"),
            target("p2", "Luca Bianchi"),
            target("p3", "Carlo Neri"),
          ]}
        />,
      );
    });

    expect(hasText(tree!.root, "con")).toBe(true);
    expect(hasText(tree!.root, "Marco Rossi")).toBe(true);
    expect(hasText(tree!.root, "altri 2")).toBe(true);
    expect(hasText(tree!.root, "di Luca Verdi · 3 min di lettura")).toBe(true);
    // HOM-15 §26–§27: nome di chi pubblica e tempo stanno nell'header condiviso, non qui.
    expect(hasText(tree!.root, "•")).toBe(false);

    const firstLink = tree!.root.find(
      (node) => node.props.accessibilityLabel === "Apri Marco Rossi",
    );
    act(() => {
      firstLink.props.onPress();
    });
    expect(onOpenTarget).toHaveBeenCalledWith(
      expect.objectContaining({ target_id: "p1" }),
    );
  });

  it("con due tag mostra entrambi i nomi e nessun «altri»", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ContentAttribution
          onOpenTarget={vi.fn()}
          tagged={[target("p1", "Marco Rossi"), target("p2", "Luca Bianchi")]}
        />,
      );
    });

    expect(hasText(tree!.root, "Marco Rossi")).toBe(true);
    expect(hasText(tree!.root, "Luca Bianchi")).toBe(true);
    expect(hasText(tree!.root, "altri")).toBe(false);
  });

  it("senza tag né firma non disegna nulla", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<ContentAttribution onOpenTarget={vi.fn()} tagged={[]} />);
    });

    expect(tree!.toJSON()).toBeNull();
  });
});
