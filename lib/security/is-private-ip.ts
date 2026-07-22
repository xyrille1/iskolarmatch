// SSRF defense helper: is a resolved IP address in a private / loopback /
// link-local / cloud-metadata range? Used by lib/source-watcher/fetch-source.ts
// to reject a URL whose hostname resolves to an internal address, even if the
// hostname itself is on the gov.ph/edu.ph allowlist (DNS-rebinding defense).
//
// Pure and I/O-free (it does not resolve DNS itself -- the caller does that and
// passes the resolved address in), so it unit-tests like lib/matching/*.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function inRange(ipInt: number, cidrBase: string, prefix: number): boolean {
  const base = ipv4ToInt(cidrBase);
  if (base === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8], // RFC1918
  ["172.16.0.0", 12], // RFC1918
  ["192.168.0.0", 16], // RFC1918
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (incl. 169.254.169.254 cloud metadata)
  ["0.0.0.0", 8], // "this host"
  ["100.64.0.0", 10], // carrier-grade NAT
  ["192.0.0.0", 24], // IETF protocol assignments
];

export function isPrivateIp(address: string): boolean {
  const addr = address.trim().toLowerCase();

  // IPv6 forms we treat as internal.
  if (addr === "::1" || addr === "::" || addr === "0:0:0:0:0:0:0:1") return true;
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique local fc00::/7
  if (addr.startsWith("fe80")) return true; // link-local fe80::/10

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) -- validate the embedded v4 part.
  const mapped = addr.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) {
    return isPrivateIp(mapped[1]);
  }

  const ipInt = ipv4ToInt(addr);
  if (ipInt === null) {
    // Unrecognized format: fail closed (treat as private/unsafe).
    return true;
  }

  return PRIVATE_V4_RANGES.some(([base, prefix]) => inRange(ipInt, base, prefix));
}
