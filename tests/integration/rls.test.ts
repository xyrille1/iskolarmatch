import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// Requires a running local Supabase stack (`npx supabase start`, needs Docker
// Desktop) seeded via `npx supabase db reset`. Skips entirely if the local
// stack's URL/anon key aren't provided -- this is NOT run in CI/sandboxes
// without Docker, only on a developer machine with the stack up.
//
// Set TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY (the local stack prints both
// on `supabase start`) to enable this suite.
const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;

if (url && anonKey) {
  const supabase = createClient(url, anonKey);

  describe('RLS: anon access to scholarships', () => {
    it('can read only published scholarships, not the draft fixture', async () => {
      const { data, error } = await supabase.from('scholarships').select('slug, is_published');

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.every((row) => row.is_published)).toBe(true);
      expect(data?.some((row) => row.slug === 'draft-unverified-scholarship-rls-fixture')).toBe(false);
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });

    it('cannot insert a scholarship as anon (no write policy exists)', async () => {
      const { error } = await supabase.from('scholarships').insert({
        title: 'Should be rejected',
        slug: 'should-be-rejected',
        official_url: 'https://ched.gov.ph/fake',
        is_published: false,
      });

      expect(error).not.toBeNull();
    });

    it('cannot read allowlisted_domains as anon (RLS enabled, zero policies)', async () => {
      const { data, error } = await supabase.from('allowlisted_domains').select('domain');

      // Default-deny with no policies returns an empty result set for anon,
      // not necessarily a query error -- assert no rows leak through either way.
      expect(data ?? []).toHaveLength(0);
      void error;
    });

    // FR10 source-watcher tables carry the same zero-policy, service-role-only
    // posture as allowlisted_domains / scholarship_reports (DATABASE.md).
    it.each(['source_documents', 'source_sections', 'scholarship_suggestions'])(
      'cannot read %s as anon (RLS enabled, zero policies)',
      async (table) => {
        const { data } = await supabase.from(table).select('id');
        expect(data ?? []).toHaveLength(0);
      }
    );

    it('cannot insert a scholarship_suggestion as anon (no write policy exists)', async () => {
      const { error } = await supabase.from('scholarship_suggestions').insert({
        scholarship_id: '00000000-0000-0000-0000-000000000000',
        source_document_id: '00000000-0000-0000-0000-000000000000',
        target_table: 'scholarships',
        target_row_id: '00000000-0000-0000-0000-000000000000',
        target_field: 'benefit_summary',
        change_kind: 'update_field',
        new_value: 'anon should not be able to write this',
        confidence: 'low',
      });

      expect(error).not.toBeNull();
    });
  });
} else {
  describe.skip('RLS: anon access to scholarships (skipped: TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY not set)', () => {
    it('requires a local Supabase stack', () => {});
  });
}
