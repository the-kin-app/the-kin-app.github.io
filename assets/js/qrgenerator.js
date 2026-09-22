/* ============================================================
   Min — QR generator page
   ------------------------------------------------------------
   Wires the controls to qr-encode.js + qr-style.js, and handles
   getting the artwork out: one SVG, one PNG, or the whole print run
   as a ZIP.

   The location, asset and design lists are the same vocabulary the
   Worker accepts (min-waitlist-worker src/index.js). They are duplicated
   here rather than fetched because this page has to work with no
   network, and a fetch that quietly fails would generate codes
   pointing at URLs the Worker rejects — the scan would still land on
   the homepage, so nothing would look broken while every row in the
   scoreboard stayed empty. A list that goes stale is visible; a silent
   mismatch is not. Adding a design or an asset type is an edit in both
   files.
   ============================================================ */

(function () {
  'use strict';

  // The scan URL is on the WORKER's host, not the site's. hellomin.app is
  // GitHub Pages and knows nothing about /<location>/<asset>/<design> or the
  // locationless /<asset>/<design> a card carries — a code
  // pointing there 404s without the scan ever being counted. The Worker
  // lives at api.hellomin.app (min-waitlist-worker wrangler.toml `routes`), counts the
  // hit, and 302s to hellomin.app/?l=&a=&p=&v=&s= itself.
  const API = 'https://api.hellomin.app';
  const SITE = 'https://hellomin.app';

  // Posters printed before the kinapp.social -> hellomin.app move point at the
  // old Worker host. That route is still live and still counts scans, so those
  // codes stay valid and the generator recognises them — but it never mints a
  // new one there. Retiring the route would break paper already on walls.
  const LEGACY_API = 'https://api.kinapp.social';

  const LOCATIONS = [
    'meilahti', 'pasila', 'myllypuro', 'kumpula', 'keskusta', 'arabia',
    'viikki', 'otaniemi', 'hanken', 'uniarts', 'diak', 'myyrmaki',
  ];

  // What the artwork is printed on. A poster goes on a wall and is scanned by
  // whoever walks past; a card is handed to one person. They pull utterly
  // different numbers off the same design, which is why the Worker keys every
  // count on the pair — so the code has to carry both.
  //
  // Each asset type owns its own design list, because a design that reads at
  // three metres is not the design that reads in a hand. The lists are
  // disjoint today, but nothing here assumes that: two asset types may share a
  // design slug, and if they ever do they stay two separate cells everywhere
  // downstream, because the PAIR is the key and not the design. Designs are
  // named after their tagline, so a filename says which artwork it is. Labels
  // are only for this page — the slugs are what gets printed.
  //
  // `located` says whether the artwork is somewhere. A poster hangs on a wall
  // and WHICH wall is half of what it measures. A card is handed over: it has
  // no wall, it travels in a pocket, and the place it changed hands says
  // nothing anyone could act on. So a located asset is one code per location
  // per design, and an unlocated one is a single code per design.
  const ASSETS = [
    {
      slug: 'poster',
      label: 'Poster',
      note: 'on a wall',
      located: true,
      designs: [
        { slug: 'unclesam', label: 'Uncle Sam' },
        { slug: 'unclesam-footer', label: 'Uncle Sam footer' },
        { slug: 'happy', label: 'Happy' },
      ],
    },
    {
      slug: 'card',
      label: 'Card',
      note: 'handed over',
      located: false,
      designs: [
        { slug: 'unclemin', label: 'Uncle Min' },
        { slug: 'help', label: 'Help' },
      ],
    },
  ];

  const assetBySlug = (slug) => ASSETS.find((a) => a.slug === slug) || ASSETS[0];

  // What a two-segment URL means. Every code printed before 2026-09-22 has
  // that shape, it is on walls, and paper cannot be reissued — so the Worker
  // resolves it to 'poster' permanently. This page recognises the short form
  // and never mints another one.
  const LEGACY_ASSET = 'poster';

  const $ = (id) => document.getElementById(id);
  const els = {
    modes: $('mode-toggles'), posterFields: $('poster-fields'), customFields: $('custom-fields'),
    location: $('location'), asset: $('asset'), poster: $('poster'),
    customUrl: $('custom-url'), targetNote: $('target-note'),
    palette: $('palette'), shape: $('shape'), eye: $('eye'), frame: $('frame'),
    level: $('level'), quiet: $('quiet'), pixels: $('pixels'), logo: $('logo'),
    stage: $('stage'), meta: $('meta'), urlOut: $('url-out'), notes: $('notes'),
    dlSvg: $('dl-svg'), dlPng: $('dl-png'), copySvg: $('copy-svg'),
    sheet: $('sheet'), sheetNote: $('sheet-note'), dlZip: $('dl-zip'), printSheet: $('print-sheet'),
  };

  // 'tracked' — a code the Worker counts — or 'custom', a URL typed in. Not
  // named 'poster' any more: that word now means one asset type, and a mode
  // sharing its name with a value inside the mode is how a rename goes wrong.
  let mode = 'tracked';

  // ---- Options, remembered ------------------------------------------
  // The style is a print decision: whoever laid out the last poster batch
  // should find the same settings tomorrow, not the defaults.
  // v2: the stored shape gained an asset, and the mode was renamed. A v1 blob
  // would restore a mode that no longer exists and a design list belonging to
  // no asset type, so the key is bumped rather than migrated — the cost is one
  // person re-picking their palette once.
  const STORE = 'kin-qrgen-v2';

  function readOptions() {
    return {
      palette: els.palette.value,
      moduleShape: els.shape.value,
      eyeStyle: els.eye.value,
      frame: els.frame.value,
      logo: els.logo.checked,
      quiet: clamp(parseInt(els.quiet.value, 10) || 4, 0, 12),
      pixels: clamp(parseInt(els.pixels.value, 10) || 1024, 256, 4096),
    };
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        ...readOptions(), level: els.level.value, mode,
        location: els.location.value, asset: els.asset.value, poster: els.poster.value,
        custom: els.customUrl.value,
      }));
    } catch (e) { /* private browsing, or storage full — the tool still works */ }
  }

  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { s = null; }
    if (!s) return;
    const set = (el, v) => { if (v !== undefined && v !== null && el) el.value = v; };
    set(els.palette, s.palette); set(els.shape, s.moduleShape); set(els.eye, s.eyeStyle);
    set(els.frame, s.frame); set(els.level, s.level); set(els.quiet, s.quiet);
    set(els.pixels, s.pixels); set(els.location, s.location);
    // The asset first, then its designs, then the design — the list the design
    // has to exist in does not exist until the asset is set.
    set(els.asset, s.asset);
    fillDesigns();
    syncLocationField();
    set(els.poster, s.poster);
    set(els.customUrl, s.custom);
    if (typeof s.logo === 'boolean') els.logo.checked = s.logo;
    if (s.mode === 'custom' || s.mode === 'tracked') setMode(s.mode, true);
  }

  // ---- Targets ------------------------------------------------------
  // The LOCATION IS AN OPTIONAL LEADING SEGMENT:
  //   /<location>/<asset>/<design>  a located asset — a poster
  //   /<asset>/<design>             an unlocated one — a card
  //
  // The old two-segment /<location>/<design>, which the Worker still resolves
  // to a poster, is deliberately never generated here — see LEGACY_ASSET.
  const targetUrl = (location, asset, design) => (location
    ? `${API}/${location}/${asset}/${design}`
    : `${API}/${asset}/${design}`);

  // Same rule for the filename, so a file's name is readable back into the URL
  // it encodes. The asset is always in it: without it, the card and the poster
  // of one design would overwrite each other in a download folder, a mix-up
  // nobody can see once the file is at the print shop.
  const targetName = (location, asset, design) => (location
    ? `kin-qr-${location}-${asset}-${design}`
    : `kin-qr-${asset}-${design}`);

  function currentTarget() {
    if (mode === 'custom') {
      return { url: els.customUrl.value.trim(), name: 'kin-qr-custom' };
    }
    const a = els.asset.value;
    const p = els.poster.value;
    // The select keeps its value while the field is hidden, so read the asset
    // rather than the select: an unlocated asset takes no location even though
    // there is still one sitting in the control.
    const l = assetBySlug(a).located ? els.location.value : null;
    return { url: targetUrl(l, a, p), name: targetName(l, a, p) };
  }

  function setMode(next, quiet) {
    mode = next;
    els.posterFields.style.display = next === 'tracked' ? '' : 'none';
    els.customFields.style.display = next === 'custom' ? '' : 'none';
    for (const b of els.modes.querySelectorAll('.toggle')) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === next));
    }
    if (!quiet) update();
  }

  // ---- Populate the selects ----------------------------------------
  // The design list belongs to the asset type, so it is rebuilt every time the
  // asset changes. The current design is kept if the new asset also has it —
  // switching poster/card to compare the same artwork is the common move, and
  // silently resetting to the first design would mint a code for artwork
  // nobody chose.
  // The Location control is hidden for an asset that has none. Hidden rather
  // than disabled: a greyed-out control says "you could set this", and for a
  // card there is nothing to set — the location is not part of what a card
  // measures.
  function syncLocationField() {
    const wrap = els.location.closest('.ctl');
    if (wrap) wrap.style.display = assetBySlug(els.asset.value).located ? '' : 'none';
  }

  function fillDesigns() {
    const wanted = els.poster.value;
    const designs = assetBySlug(els.asset.value).designs;
    els.poster.innerHTML = designs
      .map((p) => `<option value="${p.slug}">${p.label}</option>`).join('');
    if (designs.some((d) => d.slug === wanted)) els.poster.value = wanted;
  }

  function fillSelects() {
    els.location.innerHTML = LOCATIONS
      .map((l) => `<option value="${l}">${l.charAt(0).toUpperCase() + l.slice(1)}</option>`).join('');
    els.asset.innerHTML = ASSETS
      .map((a) => `<option value="${a.slug}">${a.label} — ${a.note}</option>`).join('');
    fillDesigns();
    syncLocationField();
    els.palette.innerHTML = Object.entries(KinQRStyle.PALETTES)
      .map(([key, p]) => `<option value="${key}">${p.label}</option>`).join('');
  }

  // ---- The wordmark, inlined ----------------------------------------
  // Fetched once and injected as source, so a downloaded SVG carries the
  // logo with it instead of a link back to this site. If the fetch fails
  // (opened straight off the filesystem, say) the badge falls back to the
  // violet dot — see qr-style.js — rather than a broken image.
  async function loadWordmark() {
    try {
      const res = await fetch('/assets/img/min-logo-flat.svg');
      if (!res.ok) throw new Error(res.status);
      const src = await res.text();
      const paths = (src.match(/<path[\s\S]*?\/>/g) || []).join('');
      const viewBox = (src.match(/viewBox="([^"]+)"/) || [])[1];
      if (paths) KinQRStyle.setWordmark(paths, viewBox);
    } catch (e) {
      // Left deliberately quiet in the console: the page renders fine.
    }
  }

  // ---- Render -------------------------------------------------------
  function build(url, options) {
    const qr = KinQR.encode(url, els.level.value);
    return { qr, svg: KinQRStyle.render(qr, { ...options, label: url.replace(/^https?:\/\//, '') }) };
  }

  let current = null;

  // ---- Reading a hand-typed URL back -------------------------------
  // The custom field is where a URL from somewhere else gets checked, so this
  // has to recognise every shape the Worker still answers — including the two
  // shapes we never mint any more. A code already on paper is not a mistake
  // to be flagged; only a code about to be printed is.
  const TRACKED_RE = /^https:\/\/api\.(?:hellomin\.app|kinapp\.social)\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/;
  const WRONG_HOST_RE = /^https:\/\/(?:hellomin\.app|kinapp\.social)\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/;

  function customUrlNote(url) {
    const m = TRACKED_RE.exec(url);
    if (m) {
      const legacyHost = url.startsWith(LEGACY_API);

      // The location is an optional leading segment, so two segments is one of
      // two different things and the FIRST ONE tells them apart:
      //   /<asset>/<design>     an asset with no location — a card
      //   /<location>/<design>  pre-2026-09-22, means a poster
      // No slug is both a location and an asset type (the Worker throws at
      // startup if that ever changes), so there is nothing to guess.
      const threeSeg = !!m[3];
      const firstIsAsset = !threeSeg && ASSETS.some((a) => a.slug === m[1]);
      const legacyShort = !threeSeg && !firstIsAsset;

      const location = (threeSeg || legacyShort) ? m[1] : null;
      const asset = threeSeg ? m[2] : (firstIsAsset ? m[1] : LEGACY_ASSET);
      const design = threeSeg ? m[3] : m[2];

      const entry = ASSETS.find((a) => a.slug === asset);
      const designOk = !!entry && entry.designs.some((d) => d.slug === design);
      // A located asset needs a real location. An unlocated one may carry one
      // — cards printed before they stopped having a location do — and the
      // Worker drops it rather than refusing the scan.
      const locationOk = entry && entry.located
        ? LOCATIONS.includes(location)
        : (location === null || LOCATIONS.includes(location));

      if (!designOk || !locationOk) {
        const shown = [location, asset, design].filter(Boolean).join('/');
        return [{ kind: 'warn', text: `The Worker does not know "${shown}". A scan will ` +
          'still reach the homepage, but it will not be counted — add the slug to min-waitlist-worker ' +
          'src/index.js and to the lists at the top of this file first.' }];
      }
      const out = [{ kind: 'ok', text: `This is a tracked ${asset} URL.` }];
      if (legacyHost) {
        out.push({ kind: 'warn', text: 'On the old api.kinapp.social host. That route stays live for artwork ' +
          'already printed — anything new should point at api.hellomin.app.' });
      }
      if (legacyShort) {
        out.push({ kind: 'warn', text: 'No asset type in the path, so the Worker will count it as a poster. ' +
          'That is correct for codes printed before 2026-09-22 and wrong for anything new — print the ' +
          'three-segment form instead.' });
      }
      if (location && entry && !entry.located) {
        out.push({ kind: 'warn', text: `A ${asset} has no location, so the Worker will count this scan and ` +
          `drop the "${location}". That is correct for ${asset}s printed before 2026-09-22 and wrong for ` +
          `anything new — print ${API.replace('https://', '')}/${asset}/${design} instead.` });
      }
      return out;
    }
    if (WRONG_HOST_RE.test(url)) {
      return [{ kind: 'bad', text: 'This looks like a tracking URL on the wrong host. hellomin.app is the ' +
        'static site — it will 404 and count nothing. Tracking lives on api.hellomin.app.' }];
    }
    return [{ kind: 'warn', text: 'Untracked URL. Scans of this code will not appear in the poster scoreboard.' }];
  }

  function update() {
    const target = currentTarget();
    const options = readOptions();
    els.urlOut.textContent = target.url || '—';

    if (!target.url) {
      els.stage.innerHTML = '';
      els.meta.textContent = '';
      showNotes([{ kind: 'bad', text: 'Enter a URL to encode.' }]);
      current = null;
      return;
    }

    let built;
    try {
      built = build(target.url, options);
    } catch (err) {
      els.stage.innerHTML = '';
      els.meta.textContent = '';
      showNotes([{ kind: 'bad', text: err.message }]);
      current = null;
      return;
    }

    current = { ...built, ...target, options };
    // The preview and the sheet both show the selected code; scoping the
    // preview's gradient ids keeps the two copies from sharing an id.
    els.stage.innerHTML = build(target.url, { ...options, idScope: 'preview' }).svg;
    els.meta.textContent = `Version ${built.qr.version} · ${built.qr.size}×${built.qr.size} modules · ` +
      `level ${built.qr.level} · mask ${built.qr.mask}`;

    const notes = [];
    if (mode === 'tracked') {
      notes.push({ kind: 'ok', text: 'Tracked: the Worker counts this scan, then forwards to the landing page ' +
        'with the location, the asset type and the design attached.' });
    } else {
      notes.push(...customUrlNote(target.url));
    }
    for (const w of KinQRStyle.audit(built.qr, options)) notes.push({ kind: 'warn', text: w });
    if (options.logo) {
      notes.push({ kind: 'ok', text: `Centre badge covers ${(KinQRStyle.logoCoverage(built.qr) * 100).toFixed(1)}% ` +
        `of the code; level ${built.qr.level} recovers far more than that.` });
    }
    showNotes(notes);

    renderSheet(options);
    saveState();
  }

  function showNotes(notes) {
    els.notes.innerHTML = notes.map((n) =>
      `<p class="note-line note-line--${n.kind}"><span>${n.kind === 'ok' ? '✓' : '!'}</span><span>${escapeHtml(n.text)}</span></p>`
    ).join('');
  }

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---- The full print run ------------------------------------------
  // Rendered at a small preview width; the downloads re-render at the
  // export size, because a 24-code grid at 1024 px each is a lot of DOM
  // for something nobody looks at closely.
  // Asset-major, so a print run for cards is a contiguous block on the sheet
  // rather than two rows scattered through twelve locations.
  //
  // A located asset is one code per location per design. An unlocated one is a
  // single code per design — twelve identical card codes would be twelve ways
  // to print the same thing and one more chance to grab the wrong file.
  function allTargets() {
    const out = [];
    for (const a of ASSETS) {
      for (const p of a.designs) {
        if (a.located) {
          for (const l of LOCATIONS) {
            out.push({ location: l, asset: a, poster: p, url: targetUrl(l, a.slug, p.slug) });
          }
        } else {
          out.push({ location: null, asset: a, poster: p, url: targetUrl(null, a.slug, p.slug) });
        }
      }
    }
    return out;
  }

  function renderSheet(options) {
    const targets = allTargets();
    els.sheetNote.textContent = `${targets.length} codes — every located asset crossed with every ` +
      'location, and one code for each design that has none. In the style set above; labels sit ' +
      'beside each code, never inside it.';
    els.sheet.innerHTML = targets.map((t) => {
      const { svg } = build(t.url, { ...options, pixels: 300, idScope: 'sheet' });
      // An unlocated code says so in place of a location, rather than leaving a
      // blank line where every other cell has a word. A gap reads as a bug.
      const where = t.location || 'anywhere';
      return `<figure class="sheet-cell">${svg}` +
        `<figcaption><p class="sheet-cell__label">${escapeHtml(where)}` +
        `<b>${escapeHtml(`${t.asset.label} · ${t.poster.label}`)}</b></p>` +
        `<p class="sheet-cell__sub">${t.url.replace(API, '')}</p></figcaption>` +
        `<button type="button" class="sheet-cell__dl" data-l="${t.location || ''}" ` +
        `data-a="${t.asset.slug}" data-p="${t.poster.slug}">SVG</button>` +
        `</figure>`;
    }).join('');
  }

  // ---- Getting files out -------------------------------------------
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick: Safari needs the URL to still be live when
    // the click is handled.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const svgBlob = (svg) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

  // SVG -> PNG through a canvas. The SVG carries no external references —
  // no linked image, no webfont — which is the only reason this is allowed
  // to touch the canvas at all: a foreign resource would taint it and
  // toBlob would throw.
  function toPng(svg, width) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(svgBlob(svg));
      const img = new Image();
      img.onload = () => {
        const scale = width / (img.naturalWidth || width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((img.naturalWidth || width) * scale);
        canvas.height = Math.round((img.naturalHeight || width) * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not rasterise'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load the SVG')); };
      img.src = url;
    });
  }

  // ---- A very small ZIP writer -------------------------------------
  // Stored (uncompressed) entries only. A generator that needs a library
  // to hand over its output is a generator that breaks when the library
  // moves, and SVG text zips down so well that the saving is not worth
  // the dependency. Local header + central directory + EOCD, nothing else.
  function crc32(bytes) {
    let table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

    for (const file of files) {
      const name = enc.encode(file.name);
      const body = file.bytes;
      const crc = crc32(body);
      // Version 2.0, no flags, method 0 (stored). Dates are left at zero:
      // reproducibility beats a timestamp nobody reads — regenerating the
      // same batch twice should produce the same file.
      const local = [
        ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(body.length), ...u32(body.length), ...u16(name.length), ...u16(0),
      ];
      chunks.push(new Uint8Array(local), name, body);
      central.push({ name, crc, size: body.length, offset });
      offset += local.length + name.length + body.length;
    }

    const dir = [];
    for (const e of central) {
      dir.push(new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.size), ...u32(e.size),
        ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(e.offset),
      ]), e.name);
    }
    const dirBytes = dir.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(central.length), ...u16(central.length), ...u32(dirBytes), ...u32(offset), ...u16(0),
    ]);

    return new Blob([...chunks, ...dir, eocd], { type: 'application/zip' });
  }

  async function downloadAll() {
    const options = readOptions();
    const level = els.level.value;
    els.dlZip.disabled = true;
    const was = els.dlZip.textContent;
    els.dlZip.textContent = 'Building…';
    try {
      const enc = new TextEncoder();
      const files = [];
      const readme = [
        'Min poster QR codes',
        '===================',
        '',
        `Generated by /qrgenerator/ · error correction ${level} · ` +
          `${options.palette} palette · ${options.moduleShape} modules · ${options.eyeStyle} eyes · ` +
          `${options.frame} ground · badge ${options.logo ? 'on' : 'off'} · quiet zone ${options.quiet}`,
        '',
        'Each file is named for the URL it encodes:',
        'kin-qr-<location>-<asset>-<design>, or kin-qr-<asset>-<design> for',
        'artwork that has no location.',
        `That URL is ${API}/<location>/<asset>/<design> — the Worker's host,`,
        'not the site\'s. The Worker counts the scan, then forwards to',
        `${SITE}/?l=&a=&p=&v=&s=. Print the file whose name matches the artwork,`,
        'what it is being printed on, and where it is going — a mismatch is not',
        'visible on the artwork and quietly ruins the numbers.',
        '',
        'The asset type is a dimension of the measurement, not a label. A poster',
        'is walked past by hundreds and a card is handed to one person, so the',
        'same design converts at rates that cannot be pooled — which is why the',
        'two are never the same file.',
        '',
        'THE LOCATION IS AN OPTIONAL LEADING SEGMENT. A poster hangs on a wall and',
        'which wall is half of what it measures, so there is one poster code per',
        'location. A card is handed over: it has no wall, it travels in a pocket,',
        'and the place it changed hands says nothing anyone could act on. So there',
        'is ONE card code per design, it carries no location, and the same file is',
        'the one to print wherever the cards are going.',
        '',
        'The SVGs are vector and self-contained: no linked images, no webfonts.',
        `The PNGs are ${options.pixels} px wide.`,
        '',
        'Print notes',
        '-----------',
        '· 40 mm square is the smallest that scans comfortably at arm\'s length.',
        '  The poster template reserves exactly that (see assets/css/poster.css).',
        '· Keep the quiet zone. It is part of the artwork, not a margin to trim.',
        '· Warm ink on the resin ground is the print default. The cave palette is',
        '  inverted and belongs on screens.',
        '',
      ].join('\n');
      files.push({ name: 'README.txt', bytes: enc.encode(readme) });

      // Foldered by asset type as well as format, so a print run for cards is
      // one folder to hand over rather than a filename prefix to filter on.
      for (const t of allTargets()) {
        const { svg } = build(t.url, options);
        const base = targetName(t.location, t.asset.slug, t.poster.slug);
        files.push({ name: `${t.asset.slug}/svg/${base}.svg`, bytes: enc.encode(svg) });
        const png = await toPng(svg, options.pixels);
        files.push({ name: `${t.asset.slug}/png/${base}.png`, bytes: new Uint8Array(await png.arrayBuffer()) });
      }
      download(zip(files), `kin-print-qr-${level.toLowerCase()}-${options.palette}.zip`);
    } catch (err) {
      showNotes([{ kind: 'bad', text: `Could not build the ZIP: ${err.message}` }]);
    } finally {
      els.dlZip.disabled = false;
      els.dlZip.textContent = was;
    }
  }

  // ---- Wiring -------------------------------------------------------
  fillSelects();
  loadState();

  els.modes.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle');
    if (btn) setMode(btn.dataset.mode);
  });

  // The asset owns the design list, so it rebuilds that list before the redraw.
  els.asset.addEventListener('change', () => { fillDesigns(); syncLocationField(); update(); });

  for (const el of [els.location, els.poster, els.palette, els.shape, els.eye, els.frame,
                    els.level, els.quiet, els.pixels, els.logo]) {
    el.addEventListener('change', update);
  }
  els.customUrl.addEventListener('input', update);

  els.dlSvg.addEventListener('click', () => {
    if (current) download(svgBlob(current.svg), `${current.name}.svg`);
  });

  els.dlPng.addEventListener('click', async () => {
    if (!current) return;
    try {
      download(await toPng(current.svg, current.options.pixels), `${current.name}.png`);
    } catch (err) {
      showNotes([{ kind: 'bad', text: `Could not make the PNG: ${err.message}` }]);
    }
  });

  els.copySvg.addEventListener('click', async () => {
    if (!current) return;
    const was = els.copySvg.textContent;
    try {
      await navigator.clipboard.writeText(current.svg);
      els.copySvg.textContent = 'Copied';
    } catch (e) {
      els.copySvg.textContent = 'Copy blocked';
    }
    setTimeout(() => { els.copySvg.textContent = was; }, 1400);
  });

  els.sheet.addEventListener('click', (e) => {
    const btn = e.target.closest('.sheet-cell__dl');
    if (!btn) return;
    const { l, a, p } = btn.dataset;
    // data-l is empty for an unlocated code, which reads back as null here.
    const loc = l || null;
    const { svg } = build(targetUrl(loc, a, p), readOptions());
    download(svgBlob(svg), `${targetName(loc, a, p)}.svg`);
  });

  els.dlZip.addEventListener('click', downloadAll);
  els.printSheet.addEventListener('click', () => window.print());

  // The badge needs the wordmark, so draw once now (dot fallback, instant)
  // and again the moment it lands.
  update();
  loadWordmark().then(update);
})();
