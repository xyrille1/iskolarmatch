import { describe, expect, it } from "vitest";
import { isPrivateIp } from "./is-private-ip";

describe("isPrivateIp", () => {
  it("flags RFC1918 ranges", () => {
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("172.16.5.5")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
  });

  it("flags loopback and link-local", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata endpoint
  });

  it("flags IPv6 loopback and unique-local / link-local", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("flags IPv4-mapped IPv6 pointing at a private v4 address", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("13.107.42.14")).toBe(false);
  });

  it("just outside a private boundary is public", () => {
    expect(isPrivateIp("172.32.0.1")).toBe(false); // 172.16/12 ends at 172.31.x.x
    expect(isPrivateIp("11.0.0.1")).toBe(false);
  });

  it("fails closed on an unrecognized format", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("999.999.999.999")).toBe(true);
  });
});
