# `school` on `POST /waitlist` — handover spec for `min-waitlist-worker`

Everything the Worker needs to accept the new ad landing page. `/ads/` is
built and will post `school` the moment it deploys; until this lands, every
one of those signups is either **rejected** or **stored without the one field
the page exists to collect** — see "What happens today" below, which is the
first thing to check.

Written to match how `poster` and `poster_location` already work, so the
allowlist, the NULL-on-unknown rule and the admin column should be copied
from those rather than invented here.

- Page: `hellomin.app/ads/`
- Client: `kin-site/assets/js/waitlist-form.js`
- Why the page exists: `min-brain/Business/Market/social ads strategy.md` §3
- Where the answer is spent: `min-brain/Business/Market/beachhead plan.md` §2

---

## 0. What happens today, and why this is urgent

The page adds **one key** to the existing `/waitlist` body:

```jsonc
{
  "name": "Sam Okonkwo",
  "contact_method": "email",
  "email": "sam.okonkwo@gmail.com",
  "phone": null,
  "website": "",
  "poster": "hook-freehour",
  "poster_location": "ads",
  "variant": null,
  "scan_token": null,
  "school": "aalto"        // ← NEW, and only ever sent by /ads/
}
```

**The one thing to verify before anything else:** whether the current handler
*rejects* a body with an unknown key or quietly ignores it. If it rejects,
`/ads/` cannot go live at all and this is a launch blocker rather than a
data-quality one. If it ignores, the page works and every school answer is
silently thrown away, which is worse than an error because it looks fine.

No other page sends the key. `waitlist-form.js` adds it only when the form
it is bound to actually carries a `<select name="school">`, so the body posted
by `/` and `/waitlist/` is byte-for-byte the one the Worker has always had.
That is deliberate: the poster funnel must not change while the landing A/B
is running.

---

## 1. The field

| | |
| --- | --- |
| Key | `school` |
| Type | string, or absent |
| Values | one of `SCHOOL_KEYS` below |
| Required | **No, at the Worker.** Required in the browser, on `/ads/` only |
| Unknown value | store `NULL`, accept the row |

`school` is **not** validated as required server-side, for the same reason
`poster` is not: a signup that reaches the Worker is worth more than a clean
column. A body with no `school`, or with a value off the list, is a normal
successful signup with `school = NULL`.

### `SCHOOL_KEYS`

Alphabetical, matching the `<option value>` order in `ads/index.html`. The two
at the end are real answers and must be stored, not treated as "no answer" —
telling *"did not say"* apart from *"said they are not a student"* is the
entire read on whether the ad targeting is hitting the right people.

```js
const SCHOOL_KEYS = [
  'aalto',        // Aalto University
  'arcada',       // Arcada
  'diak',         // Diak
  'haaga-helia',  // Haaga-Helia
  'hanken',       // Hanken
  'humak',        // Humak
  'laurea',       // Laurea
  'metropolia',   // Metropolia
  'uniarts',      // Uniarts
  'helsinki',     // University of Helsinki
  'other',        // another school — a student, wrong city or wrong list
  'none',         // not a student — counted, not turned away
];
```

**These are schools, not poster locations.** `hanken`, `uniarts` and `diak`
appear in both `LOCATIONS` and this list and mean different things: there, a
wall a poster hangs on; here, an institution a person attends. Two namespaces
that happen to share three strings. Do not merge them, and do not validate one
against the other.

**The list lives in two files.** `SCHOOL_KEYS` here and the `<option>` values
in `kin-site/ads/index.html` — same rule the poster lists already follow.
Adding a school is an edit in both, and a school added on one side only is a
row in the dropdown that records `NULL`.

---

## 2. Storage

```sql
ALTER TABLE signups ADD COLUMN school TEXT;
```

Nullable, no default, no backfill. Every row written before `/ads/` existed
has `school = NULL`, which is the honest value: nobody was asked.

No index needed at this volume. If one is ever wanted it is
`(school, created_at)`, because the only query is "who signed up from where,
over what window".

---

## 3. Admin

Add `school` to whatever `/admin/signups` already returns per row, and add a
count-by-school to the same place `/admin/posters` reports its breakdown.

The number the ad test actually reads is a ratio, not a count:

```
on-target share = (rows with school NOT IN ('other','none','') and NOT NULL)
                  ÷ (all rows from poster_location = 'ads')
```

That is what says whether €450 of Instagram bought Helsinki students or bought
strangers, and it is the finding `social ads strategy` §3 is paying for.
Please keep `NULL` out of the numerator *and* visible in the denominator —
folding unanswered in with "not a student" would flatter the number.

---

## 4. Also needed for the ads campaign: the allowlists

`/ads/` carries `?l=` and `?p=` through to the signup exactly like a poster
scan does, but nothing is scanned — the Worker never sees the click, so these
arrive on the signup only.

- **`LOCATIONS`** needs `ads`. Every ad URL is `?l=ads`, so that one value is
  what separates paid traffic from a poster in `poster_location`.
- **`POSTERS`** needs one slug per creative. Round 1 runs six
  (`social ads strategy` §4); suggested slugs, to be confirmed with whoever
  cuts the frames:

  ```
  hook-freehour   hook-proximity   hook-denial
  hook-newcomer   hook-mechanic    hook-antiphone
  ```

Until both are on their lists the attribution lands as `NULL` and Round 1 cannot
tell which of the six hooks produced which signups — which is the *primary*
read of the whole test, above CPL. This matters more than `school` does.

These slugs must **not** go into `kin-site/assets/js/qrgenerator.js`. That
file's lists mint printed QR codes, and there is no poster for an ad creative.

---

## 5. Two things the endpoint must not do

- **Never reject a signup over `school`.** Not for a missing value, not for an
  unknown one. The field is a filter applied after the fact; the moment it can
  fail a submission it becomes a gate, and the page's whole design says
  "Not a student" is an answer we want.
- **Never infer a school from the email domain.** An `@aalto.fi` address is not
  a more reliable answer than the one the person gave — most students sign up
  from a personal address, and an inferred value stored in the same column as a
  stated one makes the column unreadable. If domain inference is ever wanted it
  is a second column, named so nobody confuses the two.
