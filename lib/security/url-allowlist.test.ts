import { describe, expect, it } from 'vitest';
import { isAllowlistedUrl } from './url-allowlist';

describe('isAllowlistedUrl', () => {
  it('accepts *.gov.ph hosts', () => {
    expect(isAllowlistedUrl('https://ched.gov.ph/cmsp')).toBe(true);
    expect(isAllowlistedUrl('https://sei.dost.gov.ph/undergrad')).toBe(true);
  });

  it('accepts *.edu.ph hosts', () => {
    expect(isAllowlistedUrl('https://www.up.edu.ph')).toBe(true);
  });

  it('rejects hosts not on gov.ph/edu.ph or the curated list', () => {
    expect(isAllowlistedUrl('https://example-scam.tld')).toBe(false);
    expect(isAllowlistedUrl('https://notgov.ph.evil.com')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowlistedUrl('not a url')).toBe(false);
    expect(isAllowlistedUrl('')).toBe(false);
  });

  it('rejects a bare domain masquerading via a subdomain trick', () => {
    expect(isAllowlistedUrl('https://gov.ph.attacker.net')).toBe(false);
  });
});
