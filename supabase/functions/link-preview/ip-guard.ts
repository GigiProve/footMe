/**
 * HOM-06.1 §77 — protezione SSRF: nessuna richiesta verso reti interne.
 * Modulo puro (nessun import Deno). Vale per ogni indirizzo risolto, a ogni
 * hop di redirect e per il target finale (§79).
 *
 * Bloccati: loopback, privati RFC1918, link-local (incluso il metadata cloud
 * 169.254.169.254), CGNAT 100.64.0.0/10, "this network", benchmark, documentazione,
 * multicast, riservati/broadcast; IPv6: unspecified, loopback, link-local fe80::/10,
 * ULA fc00::/7 (include il metadata fd00:ec2::254), multicast ff00::/8, documentazione
 * 2001:db8::/32, e le forme che incorporano un IPv4 (IPv4-mapped ::ffff:a.b.c.d,
 * compatibile ::a.b.c.d, NAT64 64:ff9b::/96, 6to4 2002::/16) che si valutano sull'IPv4.
 */

function parseIpv4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) {
    return null;
  }
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

export function isBlockedIpv4(parts: number[]): boolean {
  const [a, b, c] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 169 && b === 254) || // link-local + metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 (IETF)
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 88 && c === 99) || // 6to4 relay (deprecato)
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // benchmark 198.18.0.0/15
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast 224/4, riservati 240/4, broadcast
  );
}

/** Espande un IPv6 testuale in 8 gruppi da 16 bit; null se non valido. */
export function parseIpv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  const zone = ip.indexOf("%");
  if (zone >= 0) {
    ip = ip.slice(0, zone);
  }
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  // Coda IPv4 (::ffff:1.2.3.4) → due gruppi.
  const v4tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (v4tail) {
    const v4 = parseIpv4(v4tail[1]);
    if (!v4) {
      return null;
    }
    ip = ip.slice(0, v4tail.index) + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }

  const halves = ip.split("::");
  if (halves.length > 2) {
    return null;
  }

  const toGroups = (s: string): number[] | null => {
    if (s === "") {
      return [];
    }
    const out: number[] = [];
    for (const g of s.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) {
        return null;
      }
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || tail === null) {
    return null;
  }

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 1) {
    return null;
  }
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

export function isBlockedIpv6(g: number[]): boolean {
  const allZeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroUntil(7) && (g[7] === 0 || g[7] === 1)) {
    return true; // :: e ::1
  }
  if ((g[0] & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link-local
  }
  if ((g[0] & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 ULA (metadata fd00:ec2::254)
  }
  if ((g[0] & 0xff00) === 0xff00) {
    return true; // ff00::/8 multicast
  }
  if (g[0] === 0x2001 && g[1] === 0x0db8) {
    return true; // documentazione
  }

  const embedded = (hi: number, lo: number) => isBlockedIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  if (allZeroUntil(5) && g[5] === 0xffff) {
    return embedded(g[6], g[7]); // IPv4-mapped
  }
  if (allZeroUntil(6)) {
    return embedded(g[6], g[7]); // IPv4-compatibile (deprecato)
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return embedded(g[6], g[7]); // NAT64 64:ff9b::/96
  }
  if (g[0] === 0x2002) {
    return embedded(g[1], g[2]); // 6to4: l'IPv4 sta nei gruppi 1–2
  }
  return false;
}

/** true se l'indirizzo (testuale, v4 o v6) non è raggiungibile dalla Edge Function. Non valido = bloccato. */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4) {
    return isBlockedIpv4(v4);
  }
  const v6 = parseIpv6(ip);
  if (v6) {
    return isBlockedIpv6(v6);
  }
  return true;
}
