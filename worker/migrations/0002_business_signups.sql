-- Business interest form submissions (Kin for Business, /business).
-- Only business_name and location are required; everything else is
-- optional questionnaire signal from the hyperlocal-ads market research.
CREATE TABLE IF NOT EXISTS business_signups (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name      TEXT NOT NULL,
  location           TEXT NOT NULL,
  business_type      TEXT,
  contact_name       TEXT,
  contact_method     TEXT CHECK (contact_method IN ('email', 'phone') OR contact_method IS NULL),
  email              TEXT,
  phone              TEXT,
  current_marketing  TEXT, -- comma-separated selected options
  slow_times         TEXT,
  concept_interest   TEXT, -- 'definitely' | 'maybe' | 'not_really'
  walkin_value       TEXT,
  pricing_pref       TEXT, -- 'per_post' | 'monthly' | 'per_redemption' | 'not_sure'
  pilot_interest     TEXT, -- 'yes' | 'maybe' | 'no'
  trust_notes        TEXT,
  created_at         TEXT NOT NULL
);

-- Same dedup pattern as signups: case-insensitive on email, plain on
-- phone, partial indexes so an absent contact method never collides.
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_signups_email
  ON business_signups (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_signups_phone
  ON business_signups (phone) WHERE phone IS NOT NULL;
