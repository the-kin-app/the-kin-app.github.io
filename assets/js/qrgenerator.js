/* ============================================================
   Min — QR generator page
   ------------------------------------------------------------
   Wires the controls to qr-encode.js + qr-style.js, and handles
   getting the artwork out: one SVG, one PNG, or the whole print run
   as a ZIP.

   The location and poster lists are the same vocabulary the Worker
   accepts (worker/src/index.js). They are duplicated here rather
   than fetched because this page has to work with no network, and a
   fetch that quietly fails would generate codes pointing at URLs
   the Worker rejects — the scan would still land on /waitlist/, so
   nothing would look broken while every row in the scoreboard
   stayed empty. A list that goes stale is visible; a silent
   mismatch is not. Adding a poster is an edit in both files.
   ============================================================ */

(function () {
  'use strict';

  // The scan URL is on the WORKER's host, not the site's. hellomin.app is
  // GitHub Pages and knows nothing about /<location>/<poster> — a code
  // pointing there 404s without the scan ever being counted. The Worker
  // lives at api.hellomin.app (worker/wrangler.toml `routes`), counts the
  // hit, and 302s to hellomin.app/waitlist/?l=&p= itself.
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

  // Posters are named after their tagline, so a filename says which artwork
  // it is. The label is only for this page — the slug is what gets printed.
  const POSTERS = [
    { slug: 'unclesam', label: 'Uncle Sam' },
    { slug: 'happy', label: 'Happy' },
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    modes: $('mode-toggles'), posterFields: $('poster-fields'), customFields: $('custom-fields'),
    location: $('location'), poster: $('poster'), customUrl: $('custom-url'), targetNote: $('target-note'),
    palette: $('palette'), shape: $('shape'), eye: $('eye'), frame: $('frame'),
    level: $('level'), quiet: $('quiet'), pixels: $('pixels'), logo: $('logo'),
    stage: $('stage'), meta: $('meta'), urlOut: $('url-out'), notes: $('notes'),
    dlSvg: $('dl-svg'), dlPng: $('dl-png'), copySvg: $('copy-svg'),
    sheet: $('sheet'), sheetNote: $('sheet-note'), dlZip: $('dl-zip'), printSheet: $('print-sheet'),
  };

  let mode = 'poster';

  // ---- Options, remembered ------------------------------------------
  // The style is a print decision: whoever laid out the last poster batch
  // should find the same settings tomorrow, not the defaults.
  const STORE = 'kin-qrgen-v1';

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
        location: els.location.value, poster: els.poster.value, custom: els.customUrl.value,
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
    set(els.pixels, s.pixels); set(els.location, s.location); set(els.poster, s.poster);
    set(els.customUrl, s.custom);
    if (typeof s.logo === 'boolean') els.logo.checked = s.logo;
    if (s.mode === 'custom' || s.mode === 'poster') setMode(s.mode, true);
  }

  // ---- Targets ------------------------------------------------------
  const posterUrl = (location, poster) => `${API}/${location}/${poster}`;

  function currentTarget() {
    if (mode === 'custom') {
      return { url: els.customUrl.value.trim(), name: 'kin-qr-custom' };
    }
    const l = els.location.value;
    const p = els.poster.value;
    return { url: posterUrl(l, p), name: `kin-qr-${l}-${p}` };
  }

  function setMode(next, quiet) {
    mode = next;
    els.posterFields.style.display = next === 'poster' ? '' : 'none';
    els.customFields.style.display = next === 'custom' ? '' : 'none';
    for (const b of els.modes.querySelectorAll('.toggle')) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === next));
    }
    if (!quiet) update();
  }

  // ---- Populate the selects ----------------------------------------
  function fillSelects() {
    els.location.innerHTML = LOCATIONS
      .map((l) => `<option value="${l}">${l.charAt(0).toUpperCase() + l.slice(1)}</option>`).join('');
    els.poster.innerHTML = POSTERS
      .map((p) => `<option value="${p.slug}">${p.label}</option>`).join('');
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
      const res = await fetch('/assets/img/kin-logos/kin-logo-flat.svg');
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
    if (mode === 'poster') {
      notes.push({ kind: 'ok', text: 'Tracked: the Worker counts this scan, then forwards to the waitlist ' +
        'with the location and poster attached.' });
    } else if (/^https:\/\/api\.(hellomin\.app|kinapp\.social)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(target.url)) {
      const legacy = target.url.startsWith(LEGACY_API);
      const [, l, p] = target.url.replace(`${legacy ? LEGACY_API : API}/`, '/').split('/');
      const known = LOCATIONS.includes(l) && POSTERS.some((x) => x.slug === p);
      notes.push(!known
        ? { kind: 'warn', text: `The Worker does not know "${l}/${p}". A scan will still reach the waitlist, ` +
            'but it will not be counted — add the slug to worker/src/index.js first.' }
        : legacy
          ? { kind: 'warn', text: 'Tracked, but on the old api.kinapp.social host. That route stays live for posters ' +
              'already printed — anything new should point at api.hellomin.app.' }
          : { kind: 'ok', text: 'This is a tracked poster URL.' });
    } else if (/^https:\/\/(hellomin\.app|kinapp\.social)\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(target.url)) {
      notes.push({ kind: 'bad', text: 'This looks like a tracking URL on the wrong host. hellomin.app is the ' +
        'static site — it will 404 and count nothing. Tracking lives on api.hellomin.app.' });
    } else {
      notes.push({ kind: 'warn', text: 'Untracked URL. Scans of this code will not appear in the poster scoreboard.' });
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
  function allTargets() {
    const out = [];
    for (const l of LOCATIONS) {
      for (const p of POSTERS) out.push({ location: l, poster: p, url: posterUrl(l, p.slug) });
    }
    return out;
  }

  function renderSheet(options) {
    const targets = allTargets();
    els.sheetNote.textContent = `${targets.length} codes — every location crossed with every poster, ` +
      'in the style set above. Labels sit beside each code, never inside it.';
    els.sheet.innerHTML = targets.map((t) => {
      const { svg } = build(t.url, { ...options, pixels: 300, idScope: 'sheet' });
      return `<figure class="sheet-cell">${svg}` +
        `<figcaption><p class="sheet-cell__label">${t.location}<b>${escapeHtml(t.poster.label)}</b></p>` +
        `<p class="sheet-cell__sub">${t.url.replace(API, '')}</p></figcaption>` +
        `<button type="button" class="sheet-cell__dl" data-l="${t.location}" data-p="${t.poster.slug}">SVG</button>` +
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
        'Each file is named for the URL it encodes: kin-qr-<location>-<poster>.',
        `That URL is ${API}/<location>/<poster> — the Worker's host, not the`,
        'site\'s. The Worker counts the scan, then forwards to',
        `${SITE}/waitlist/?l=&p=. Print the file whose name matches`,
        'the poster and the wall it is going on — a mismatch is not visible on the',
        'poster and quietly ruins the numbers.',
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

      for (const t of allTargets()) {
        const { svg } = build(t.url, options);
        const base = `kin-qr-${t.location}-${t.poster.slug}`;
        files.push({ name: `svg/${base}.svg`, bytes: enc.encode(svg) });
        const png = await toPng(svg, options.pixels);
        files.push({ name: `png/${base}.png`, bytes: new Uint8Array(await png.arrayBuffer()) });
      }
      download(zip(files), `kin-poster-qr-${level.toLowerCase()}-${options.palette}.zip`);
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
    const { l, p } = btn.dataset;
    const { svg } = build(posterUrl(l, p), readOptions());
    download(svgBlob(svg), `kin-qr-${l}-${p}.svg`);
  });

  els.dlZip.addEventListener('click', downloadAll);
  els.printSheet.addEventListener('click', () => window.print());

  // The badge needs the wordmark, so draw once now (dot fallback, instant)
  // and again the moment it lands.
  update();
  loadWordmark().then(update);
})();
