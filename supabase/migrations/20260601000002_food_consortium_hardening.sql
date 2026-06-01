-- Harden the food consortium per Supabase security advisors:
--   1. Pin immutable_array_to_string's search_path (it only uses pg_catalog's
--      array_to_string, which is always in scope, so '' is safe).
--   2. Move pg_trgm out of the public schema into the dedicated extensions
--      schema. Existing trigram indexes track the opclass by OID, and the
--      search RPCs already include `extensions` in their search_path.
alter function public.immutable_array_to_string(text[]) set search_path = '';

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
