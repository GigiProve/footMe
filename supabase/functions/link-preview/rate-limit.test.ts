import { describe, expect, it } from "vitest";

import { NegativeCache, SlidingWindowLimiter } from "./rate-limit.ts";

describe("SlidingWindowLimiter", () => {
  it("lascia passare max tentativi per finestra e poi blocca", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(3, 1000, () => t);
    expect([l.take("u"), l.take("u"), l.take("u"), l.take("u")]).toEqual([true, true, true, false]);
  });

  it("la finestra scorre: dopo windowMs si riparte", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(2, 1000, () => t);
    l.take("u");
    t = 500;
    l.take("u");
    expect(l.take("u")).toBe(false);
    t = 1001; // il primo tentativo è uscito dalla finestra
    expect(l.take("u")).toBe(true);
    expect(l.take("u")).toBe(false);
  });

  it("chiavi indipendenti; un tentativo rifiutato non allunga il blocco", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(1, 1000, () => t);
    expect(l.take("a")).toBe(true);
    expect(l.take("b")).toBe(true);
    t = 900;
    expect(l.take("a")).toBe(false);
    t = 1001;
    expect(l.take("a")).toBe(true);
  });
});

describe("NegativeCache", () => {
  it("ricorda un fallimento fino alla scadenza", () => {
    let t = 0;
    const c = new NegativeCache<string>(60_000, 10, () => t);
    c.set("https://example.com/x", "unavailable");
    t = 59_999;
    expect(c.get("https://example.com/x")).toBe("unavailable");
    t = 60_000;
    expect(c.get("https://example.com/x")).toBeUndefined();
  });

  it("rispetta il tetto di voci scartando la più vecchia", () => {
    const c = new NegativeCache<string>(60_000, 2, () => 0);
    c.set("a", "1");
    c.set("b", "2");
    c.set("c", "3");
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe("2");
    expect(c.get("c")).toBe("3");
  });
});
