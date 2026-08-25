-- Poster A/B tracking across locations. Two poster designs (a, b) in each of
-- twelve locations, one QR code per combination, one waitlist form.
--
-- The QR lands on GET /<location>/<poster>, which counts the scan and
-- redirects to /waitlist/?l=<location>&p=<poster>; the page carries both
-- values through to the signup.
--
-- Nothing here is stored on the visitor's device and nothing here identifies
-- a person: a scan is a location, a poster id and a timestamp. Same stance as
-- the rest of this schema — no IP address, no user agent.
--
-- Location slugs are ASCII (myyrmaki, not myyrmäki) so the printed QR needs
-- no percent-encoding. src/index.js holds the authoritative allowlist.

-- Which poster brought a signup in, and where it was hanging. NULL for anyone
-- who arrived without scanning, including everyone who signed up before this
-- migration. Prefixed on this table because a bare `location` column on a
-- table of people would read as the person's location — which we don't
-- collect.
ALTER TABLE signups ADD COLUMN poster TEXT;
ALTER TABLE signups ADD COLUMN poster_location TEXT;

-- One row per scan.
CREATE TABLE IF NOT EXISTS poster_scans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  location   TEXT NOT NULL,
  poster     TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poster_scans_cell
  ON poster_scans (location, poster, created_at);
