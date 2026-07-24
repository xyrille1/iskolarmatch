// Tunables for the notification crons (send-reminders, send-digest). Batched
// and budgeted the same way the crawlers already are (see
// lib/source-discovery/config.ts, lib/source-watcher/config.ts) so a growing
// user base can't blow the serverless duration budget in one run. Both crons'
// existing idempotency guards (`sent_at` / `notified_scholarship_ids`) mean an
// unprocessed remainder is safely picked up on the next run rather than ever
// being resent (docs/QA-CHECKLIST.md P1-05).

// Due reminder rows processed per cron tick, oldest-due first.
export const REMINDER_BATCH_SIZE = 200;

// Digest-opted-in profiles processed per cron tick, longest-since-last-digest
// (or never-digested) first.
export const DIGEST_BATCH_SIZE = 100;
