-- API keys for the hosted MCP endpoint.
--
-- The web API is cookie-authenticated and same-origin; a remote MCP client
-- has no cookie jar. A bearer key is the credential that client presents
-- instead, and this table is where it lives.
--
-- Only the SHA-256 hex digest of a key is stored, never the plaintext:
-- the plaintext is shown once at creation and then unrecoverable, which
-- is the point. A database leak yields digests that cannot be replayed.
--
-- Each row maps to exactly one owner, using the same two columns the
-- rest of the schema scopes by: `user_id` for a signed-in account,
-- `owner_uid` for an anonymous session. The CHECK makes a key with
-- neither, or both, unrepresentable -- a key that scoped no one would be
-- a credential that reaches nothing, and one scoped to both would be
-- ambiguous in exactly the way `api/_owner.ts` warns about.
--
-- Revocation is `revoked_at`, not a delete. The row survives so an
-- operator can see which keys existed and when each was cut off.

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      TEXT NOT NULL UNIQUE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  owner_uid     TEXT,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  CONSTRAINT api_keys_owner_pair_check CHECK (
    (user_id IS NOT NULL AND owner_uid IS NULL)
    OR (user_id IS NULL AND owner_uid IS NOT NULL)
  )
);

-- The lookup is `WHERE key_hash = $1 AND revoked_at IS NULL`; the UNIQUE
-- constraint already indexes the hash. This partial index additionally
-- excludes revoked rows so the lookup can skip them, and so the intent
-- is written down: a revoked key is not findable.
CREATE INDEX IF NOT EXISTS api_keys_hash_live
  ON api_keys (key_hash)
  WHERE revoked_at IS NULL;

-- An operator listing one owner's keys scopes by the same columns the
-- rest of the schema does.
CREATE INDEX IF NOT EXISTS api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_owner_uid ON api_keys (owner_uid);
