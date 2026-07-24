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

    // FR21 application-tracker tables are owner-scoped to `authenticated`
    // (user_id = auth.uid()) with NO anon policy -- default-deny for anon,
    // exactly like reminders / saved_scholarships. An anon caller sees nothing
    // and can write nothing.
    it.each(['application_progress', 'requirement_checkoffs'])(
      'cannot read %s as anon (owner-only, no anon policy)',
      async (table) => {
        const { data } = await supabase.from(table).select('id');
        expect(data ?? []).toHaveLength(0);
      }
    );

    it('cannot insert application_progress as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('application_progress').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        scholarship_id: '00000000-0000-0000-0000-000000000000',
        status: 'applied',
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert requirement_checkoffs as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('requirement_checkoffs').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        requirement_id: '00000000-0000-0000-0000-000000000000',
      });

      expect(error).not.toBeNull();
    });

    // FR22 discovery tables (source_index_pages, scholarship_candidates) follow
    // the exact same zero-policy, service-role-only posture as
    // source_documents/source_sections/scholarship_suggestions above; FR13's
    // scholarship_reports is the same shape deliberately (docs/DATABASE.md §5) --
    // this app's first anon-facing WRITE path, which must NOT get its own anon
    // insert policy, so both read and write stay default-deny here.
    // docs/QA-CHECKLIST.md P0-03: previously untested tables.
    it.each(['source_index_pages', 'scholarship_candidates', 'scholarship_reports'])(
      'cannot read %s as anon (RLS enabled, zero policies)',
      async (table) => {
        const { data } = await supabase.from(table).select('id');
        expect(data ?? []).toHaveLength(0);
      }
    );

    it('cannot insert a scholarship_report as anon (no anon write policy -- goes through a rate-limited Server Action instead)', async () => {
      const { error } = await supabase.from('scholarship_reports').insert({
        scholarship_id: '00000000-0000-0000-0000-000000000101',
        reason: 'other',
        detail: 'rls test -- should be rejected',
      });

      expect(error).not.toBeNull();
    });

    // Owner-scoped tables (RLS: `to authenticated` only, `user_id = auth.uid()`)
    // previously missing from this suite (docs/QA-CHECKLIST.md P0-03). Anon has
    // no session (auth.uid() is null) and, per the GRANT migrations, no anon
    // GRANT at all on most of these -- either mechanism independently blocks
    // anon, and this assertion doesn't care which one fired.
    it.each(['saved_scholarships', 'reminders', 'push_subscriptions', 'saved_profiles', 'saved_list_shares'])(
      'cannot read %s as anon (owner-only, no anon policy)',
      async (table) => {
        const { data } = await supabase.from(table).select('id');
        expect(data ?? []).toHaveLength(0);
      }
    );

    it('cannot insert saved_scholarships as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('saved_scholarships').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        scholarship_id: '00000000-0000-0000-0000-000000000101',
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert reminders as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('reminders').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        scholarship_id: '00000000-0000-0000-0000-000000000101',
        remind_on: '2026-01-01',
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert push_subscriptions as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        endpoint: 'https://example.com/push/rls-test-fake-endpoint',
        p256dh: 'fake',
        auth: 'fake',
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert saved_profiles as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('saved_profiles').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        profile: {},
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert saved_list_shares as anon (no anon write policy exists)', async () => {
      const { error } = await supabase.from('saved_list_shares').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        slug: 'rls-test-fake-slug',
      });

      expect(error).not.toBeNull();
    });

    // admin_users / audit_log: admin_users' own policy is "self read" (a user
    // reads only their own row); audit_log is admin-only via is_admin(). Anon
    // has no session and no GRANT on either table -- both must stay empty and
    // unwritable (docs/QA-CHECKLIST.md P0-03).
    it.each(['admin_users', 'audit_log'])(
      'cannot read %s as anon (self/admin-only, no anon policy)',
      async (table) => {
        const { data } = await supabase.from(table).select('*');
        expect(data ?? []).toHaveLength(0);
      }
    );

    it('cannot insert admin_users as anon (no anon write policy -- grants are service-role/manual only)', async () => {
      const { error } = await supabase.from('admin_users').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
      });

      expect(error).not.toBeNull();
    });

    it('cannot insert audit_log as anon (append-only, service-role writes only)', async () => {
      const { error } = await supabase.from('audit_log').insert({
        actor_id: '00000000-0000-0000-0000-000000000000',
        action: 'rls-test',
        entity_type: 'rls-test',
      });

      expect(error).not.toBeNull();
    });

    // saved_list_shares' only anon-facing READ surface is the narrow
    // security-definer RPC (never the table directly, see migration
    // 20260101000010) -- this is the "allow" side of that table's posture: the
    // RPC itself must be callable by anon and degrade to an empty result for
    // an unknown slug, not a permission error, since granting EXECUTE is the
    // documented exception to "no anon read policy" for this table.
    it('can call get_shared_saved_list as anon (the one sanctioned anon-read path for saved_list_shares)', async () => {
      const { data, error } = await supabase.rpc('get_shared_saved_list', {
        share_slug: 'rls-test-nonexistent-slug',
      });

      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });
} else {
  describe.skip('RLS: anon access to scholarships (skipped: TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY not set)', () => {
    it('requires a local Supabase stack', () => {});
  });
}
