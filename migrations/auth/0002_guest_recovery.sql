-- Better Auth's anonymous plugin field; registered users remain non-anonymous.
ALTER TABLE "user" ADD COLUMN "isAnonymous" INTEGER DEFAULT 0;
-- Raw recovery codes never enter this table. Each successful recovery replaces
-- the digest and revokes previous guest sessions; generation replaces old codes.
CREATE TABLE guest_recovery (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL UNIQUE CHECK(length(secret_hash)=64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
