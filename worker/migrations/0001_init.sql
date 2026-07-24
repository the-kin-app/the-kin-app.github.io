-- Waitlist signups. Deliberately excludes IP address and user agent — only
-- what the form collects: a name, and one of email/phone.
CREATE TABLE IF NOT EXISTS signups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('email', 'phone')),
  email          TEXT,
  phone          TEXT,
  created_at     TEXT NOT NULL
);

-- Case-insensitive uniqueness on email (app layer lower-cases before insert);
-- plain uniqueness on phone. Partial indexes so the unused column being NULL
-- never collides.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_email
  ON signups (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_phone
  ON signups (phone) WHERE phone IS NOT NULL;
