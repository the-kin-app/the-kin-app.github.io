-- The waitlist survey (site: /survey/, reached from the welcome email's
-- "Fill in the survey" button). Three questions and an optional address for
-- the patch — see the page for the wording.
--
-- Same stance as the rest of this schema: no IP address, no user agent, and
-- nothing here that the page didn't ask for out loud. The email column is the
-- only identifying field, it is optional, and it exists for one purpose —
-- telling somebody where to collect their patch.
--
-- No unique index on email on purpose. A duplicate submission is a person
-- changing their mind or a double-tap, and losing the second answer silently
-- is worse than holding both: dedup at read time, by taking the latest row
-- per address, where the decision is visible.

CREATE TABLE IF NOT EXISTS survey_responses (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Q1. Minutes a day per app, as a JSON object keyed by the slugs in
  -- APP_KEYS (src/index.js): {"instagram":90,"tiktok":45}. Only the rails the
  -- person actually moved are present — an absent app means "not answered",
  -- which is a different thing from a stored zero.
  --
  -- JSON rather than a column per app because the list of apps is a product
  -- question, not a schema one: the app everybody names in six months does not
  -- exist in this file yet, and it should not need a migration.
  app_usage          TEXT,
  app_usage_other    TEXT,

  -- Q2. 'yes' | 'no', plus the write-in that follows it. The write-in is the
  -- valuable half, and it stands alone: somebody can explain without picking.
  apps_verdict       TEXT CHECK (apps_verdict IN ('yes', 'no')),
  apps_verdict_why   TEXT,

  -- Q3. Conversations a week with somebody they didn't already know. 20 is the
  -- top of the rail, so it means "20 or more", not exactly 20.
  strangers_per_week INTEGER,

  -- For the patch only. Both optional; everything above counts without them.
  email              TEXT,
  campus             TEXT,

  created_at         TEXT NOT NULL
);

-- Reads are "the latest answers", and the patch run is "who left an address",
-- so those are the two indexes.
CREATE INDEX IF NOT EXISTS idx_survey_created ON survey_responses (created_at);
CREATE INDEX IF NOT EXISTS idx_survey_email
  ON survey_responses (email) WHERE email IS NOT NULL;
