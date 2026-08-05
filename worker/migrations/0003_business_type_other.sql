-- Free-text follow-up for the "Something else, what?" option on the
-- business-type question. Only populated when business_type = 'other';
-- NULL for every other category (and for rows created before this ran).
--
-- Written through the same parameterized .bind() path as every other
-- column in src/index.js — the value is never concatenated into SQL.
ALTER TABLE business_signups ADD COLUMN business_type_other TEXT;
