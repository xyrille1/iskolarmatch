// Test stub for the `server-only` package. The real module throws when
// resolved outside a Server Component bundle; under Vitest we alias it here so
// server-only modules (e.g. lib/source-watcher/fetch-source.ts) can be unit
// tested. See vitest.config.ts resolve.alias.
export {};
