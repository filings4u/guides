# Guide Builder Supabase backend

Production project: `elpbnytpciqnbexiaebp`

The live Guide Builder backend is intentionally isolated from portal operational tables.

## Live database objects

- `public.guide_builder_members`
- `public.guide_builder_guides`
- `public.guide_builder_steps`
- `public.guide_builder_versions`
- `public.guide_builder_exports`
- private Storage bucket: `guide-builder`
- Edge Function: `guide-builder`

RLS is enabled on every Guide Builder table. Access is limited to authenticated users present in `guide_builder_members`. Roles are `admin`, `editor`, and `viewer`.

The production migrations applied on 2026-09-30 are:

- `guide_builder_connection_test` (connectivity check; table later removed)
- `create_guide_builder_platform`
- `harden_guide_builder_bootstrap`

The first production administrator was seeded from the existing active management super-administrator account. Additional users are added from the Guide Builder Members page.

The Edge Function source is versioned in `supabase/functions/guide-builder/index.ts`.
