import { describe, expect, it } from "vitest";

import { isBlockedIp, parseIpv6 } from "./ip-guard.ts";

describe("isBlockedIp — IPv4", () => {
  const blocked = [
    "0.0.0.0", "0.1.2.3", "10.0.0.1", "10.255.255.255", "127.0.0.1", "127.8.8.8",
    "100.64.0.1", "100.127.255.255", "169.254.169.254", "169.254.0.1",
    "172.16.0.1", "172.31.255.255", "192.0.0.1", "192.0.2.5", "192.168.1.1",
    "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.9",
    "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255",
  ];
  const allowed = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "100.63.255.255", "100.128.0.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "198.17.0.1", "223.255.255.255"];

  it.each(blocked)("blocca %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it.each(allowed)("lascia passare %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("isBlockedIp — IPv6", () => {
  const blocked = [
    "::", "::1", "fe80::1", "febf::1", "fc00::1", "fd00:ec2::254", "fdff::1", "ff02::1", "ff00::",
    "2001:db8::1", "::ffff:127.0.0.1", "::ffff:10.1.2.3", "::ffff:7f00:1", "::ffff:a9fe:a9fe",
    "::192.168.0.1", "64:ff9b::7f00:1", "64:ff9b::10.0.0.1", "2002:7f00:1::1", "2002:a9fe:a9fe::",
    "[::1]", "fe80::1%eth0",
  ];
  const allowed = ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1", "2a00:1450:4002::65"];

  it.each(blocked)("blocca %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it.each(allowed)("lascia passare %s", (ip) => expect(isBlockedIp(ip)).toBe(false));

  it("un indirizzo non valido è bloccato", () => {
    for (const ip of ["", "abc", "1.2.3", "999.1.1.1", "1:2:3:4:5:6:7:8:9", "::g", "1::2::3"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("espande la forma compressa in 8 gruppi", () => {
    expect(parseIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6("2001:db8::ff00:42:8329")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0xff00, 0x42, 0x8329]);
    expect(parseIpv6("::ffff:1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
  });
});
