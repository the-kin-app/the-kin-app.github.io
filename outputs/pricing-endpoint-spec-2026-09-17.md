# `POST /pricing` — handover spec for `min-waitlist-worker`

Everything the Worker needs to accept `/survey/pro/`. The page is live and
already posting to `api.hellomin.app/pricing`; until this lands it will show
"Something went wrong" on submit.

Written to match the existing `/survey` and `/business` handlers, so the shape,
the honeypot, the rate limit and the admin route should all be copied from
whichever of those is closest rather than invented here.

- Page: `hellomin.app/survey/pro/`
- Client: `kin-site/assets/js/pro-survey.js` (`SUBMIT_URL`)
- Instrument: `min-brain/Ideas/Inbox/2026-09-17 user willingness-to-pay survey.md`
- Model it feeds: `min-brain/Business/Money/business model/consumer-subscription analysis.md`

**What the survey is for**, because it decides how the data is read: which
extras to gate, and at what price. Every respondent prices **the bundle they
personally ticked**, so `price` on its own is meaningless. It is only ever read
next to `extras_wanted`.

*Revised 2026-09-18: the ten-point budget, the general subscription audit and
the AI-usage question were all cut. Do not carry forward any earlier draft.*

---

## Request

`POST /pricing`, `Content-Type: application/json`. Every field is nullable,
because nothing on the page is required. A body where all fields are null but
the honeypot is empty is still a valid row: it records somebody who opened the
page and sent nothing, which is a completion-rate signal.

```jsonc
{
  "services_paid":  ["dating", "gym", "guild"],  // string[], from SERVICE_KEYS
  "services_other": "Climbing gym membership",    // string, ≤150
  "reaction":       "would_use",                  // enum
  "reaction_why":   "I don't believe…",            // string, ≤1000
  "intents":        ["friends", "activity"],      // string[], from INTENT_KEYS
  "extras_wanted":  ["choose", "when"],           // string[], from EXTRA_KEYS
  "price":          5,                            // number, 0–9999, ≤2dp, or null
  "would_not_pay":  false,                        // bool
  "billing_pref":   "annual",                     // enum
  "email":          "a@b.fi",                     // string, ≤254
  "campus":         "Otaniemi",                   // string, ≤100
  "gender":         "woman",                      // enum
  "gender_self_describe": null,                   // string, ≤60
  "comments":       "…",                          // string, ≤1000
  "website":        ""                            // honeypot, must be empty
}
```

### Allowlists

Anything not on these lists is **dropped**, not rejected, exactly as `APP_KEYS`
works in the survey handler. A dropped key must never fail the whole submission.

```js
const SERVICE_KEYS = ['dating','gym','sports_club','guild','hobby_club',
                      'language','course','meetup','events','online','none'];

const INTENT_KEYS  = ['friends','activity','company','new_city','language',
                      'dating','work','curious'];

const EXTRA_KEYS   = ['choose','when','where','sooner','more','knows',
                      'groups','custom','travel'];

const ENUMS = {
  reaction:     ['would_use','maybe','not_for_me'],
  billing_pref: ['monthly','annual','episodic','one_off'],
  gender:       ['woman','man','non_binary','self_describe','prefer_not'],
};
```

⚠️ **These lists live in two files.** `SERVICE_KEYS`, `INTENT_KEYS` and
`EXTRA_KEYS` must stay in step with `SERVICES`, `INTENTS` and `EXTRAS` in
`kin-site/assets/js/pro-survey.js`, the same rule the poster lists already
follow. A row added on one side only is a box people can tick that records
nothing.

Note `language` and `dating` appear in two different lists and mean different
things in each. Validate each array against its own allowlist, never against a
merged set.

### Validation

| Field | Rule | On failure |
| --- | --- | --- |
| `website` | must be empty string | **200 OK, store nothing.** Never tell a bot it was caught |
| `price` | number 0–9999, at most 2dp | null it, keep the row |
| `would_not_pay` | if true, force `price` to null | store both, do not reject |
| `email` | shape only, if present | 400 with `{"error": "…"}` |
| everything else | truncate to the max length | truncate silently |

`price` and `would_not_pay` can disagree if somebody types an amount and then
ticks the box with JavaScript off. The tick wins: it is an explicit decision,
and a number left in a field is not.

### Response

Same envelope as `/survey`: `200 {"ok": true}`, or `4xx {"error": "message"}`.
The client surfaces `error` verbatim in the status line, so it has to be a
sentence a student can read.

### Rate limit

Copy `/survey`'s. This page is sent to a recruited cohort, so volume is low and
the limit is there for abuse, not load.

---

## D1 schema

```sql
CREATE TABLE pricing_responses (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),

  services_paid        TEXT,            -- JSON array, allowlisted keys only
  services_other       TEXT,
  reaction             TEXT,
  reaction_why         TEXT,
  intents              TEXT,            -- JSON array
  extras_wanted        TEXT,            -- JSON array
  price                REAL,
  would_not_pay        INTEGER,         -- 0 / 1
  billing_pref         TEXT,
  email                TEXT,
  campus               TEXT,
  gender               TEXT,
  gender_self_describe TEXT,
  comments             TEXT,

  user_agent           TEXT,
  country              TEXT             -- cf.country, as /survey stores it
);

CREATE INDEX idx_pricing_created ON pricing_responses (created_at);
CREATE INDEX idx_pricing_gender  ON pricing_responses (gender);
```

The gender index is not demographics housekeeping. The `choose` extra is read
split by gender, because it is a safety feature to one half of the cohort and a
filtering feature to the other, and an unsplit average of the two describes
nobody.

The three arrays stay JSON rather than becoming junction tables. The lists will
change before the analysis does, and a JSON blob survives that without a
migration.

---

## Admin

Add `GET /admin/pricing` beside the existing admin routes, same auth. Three
things it has to emit, because they are the analysis:

**1. CSV of every row**, for the spreadsheet.

**2. Price by extra.** The gating answer: for each extra, what the people who
wanted it were willing to pay.

```sql
SELECT  e.key                              AS extra,
        COUNT(*)                           AS wanted_by,
        ROUND(AVG(r.price), 2)             AS avg_price,
        ROUND(MEDIAN(r.price), 2)          AS median_price,
        SUM(r.would_not_pay)               AS wouldnt_pay
FROM    pricing_responses r
JOIN    json_each(r.extras_wanted) e
GROUP BY e.key
ORDER BY avg_price DESC;
```

⚠️ **This is not a price per feature, and must not be quoted as one.** Somebody
who ticked four extras and said €6 contributes €6 to all four rows. The number
means "people who wanted this were willing to pay X for their whole bundle",
which is what tells you which extras travel with a higher price, not what any
one extra is worth alone.

⚠️ SQLite has no `MEDIAN`. Either drop it or compute it in the handler. With a
campus-sized sample the median is the honest one, since a single €50 answer
moves the mean and nothing else.

**3. The `choose` extra, split by gender**, and `when` beside it. A male-skewed
tick on both is the filter spiral wearing a calendar, which is the objection the
"chance vs control as the pro line" note raises against itself.

```sql
SELECT  r.gender,
        COUNT(*)                                        AS n,
        SUM(r.extras_wanted LIKE '%"choose"%')          AS wants_choose,
        SUM(r.extras_wanted LIKE '%"when"%')            AS wants_when,
        SUM(r.extras_wanted LIKE '%"where"%')           AS wants_where,
        ROUND(AVG(r.price), 2)                          AS avg_price
FROM    pricing_responses r
GROUP BY r.gender;
```

---

## Two things the endpoint must not do

- **Never email on submit.** `/survey` sends the patch mail; this page promises
  only that we write when patches reach campus, and a second automated mail to
  the same cohort is how a recruited sample stops answering.
- **Never join `pricing_responses` to the waitlist table on email.** The email
  is optional and collected for patch logistics. Linking priced answers to a
  named waitlist row turns an anonymous instrument into a profile, and the page
  does not say that is what happens.
