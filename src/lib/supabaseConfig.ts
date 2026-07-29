// Supabase project URL + anon (publishable) key — public by design, safe to
// commit; row-level security is the security boundary. An empty URL keeps
// the whole backend inert (same convention as WEBSITE_ID in analytics.ts),
// which is also the rollback switch. Setup steps: supabase/README.md.
export const SUPABASE_URL: string = "https://jndqtwogenijoholhyep.supabase.co";
export const SUPABASE_ANON_KEY: string =
  "sb_publishable_nC1TIXe0cwfPiW1HAjrRFA_F0kMpIwP";

export const backendEnabled = SUPABASE_URL !== "";
