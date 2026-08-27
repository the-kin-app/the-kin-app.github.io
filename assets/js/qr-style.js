/* ============================================================
   Min — QR styling
   ------------------------------------------------------------
   Turns the boolean grid from qr-encode.js into an SVG that looks
   like the rest of Min: warm ink, one violet accent, resin
   surfaces, pebble corners.

   The whole file works in module units — one module is 1 unit, and
   the viewBox is the grid plus its quiet zone. Pixel size is only
   ever the `width`/`height` attributes, so the same SVG is a 40 mm
   square on a poster and a 1024 px PNG with no rounding drift.

   Scannability rules that are not negotiable, because a pretty QR
   that does not scan is a broken poster:
     - the quiet zone stays (4 modules, the spec's minimum),
     - the three finders keep their exact 7×7 footprint and their
       1:1:3:1:1 proportions — only their corners soften,
     - modules touch. A separated-dot style was built and then removed:
       gaps break the timing pattern's alternating run, and a real decoder
       failed it at every dot size tried, including dots large enough to
       touch. Pebble modules already round every free corner, so a lone
       module still comes out as a circle — the look survives, the gaps do
       not,
     - anything covering the middle is checked against the error
       correction budget before it is drawn (see `logoCoverage`),
     - nothing is written INSIDE the sheet. A caption used to live under
       the code; small dense type turned out to produce false finder
       candidates, and one real decoder stopped reading the code at large
       raster sizes. Labels belong around the code, not in it — the
       filename carries them for downloads and the contact sheet draws
       them in HTML.

   Depends on nothing. Returns SVG source as a string, so the same
   function serves the live preview, the .svg download and the PNG
   rasteriser.
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KinQRStyle = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Palettes ----------------------------------------------------
  // Every value is a literal copy of a token in tokens.css. They are
  // literals rather than var() because these SVGs leave the site — they
  // go into print files and into other people's design tools, where a
  // CSS custom property resolves to nothing.
  const PALETTES = {
    ink: {
      label: 'Warm ink',
      module: '#23211E',       // --ink-primary
      eye: '#23211E',
      eyeDot: '#7A5A94',       // --violet-ink, the one accent
      ground: '#FAF7F2',       // --resin-light
      contrast: 'high',
    },
    violet: {
      label: 'Violet gradient',
      module: 'GRADIENT',   // swapped for the render's own gradient id
      eye: '#4A3560',
      eyeDot: '#5F4577',
      ground: '#FAF7F2',
      contrast: 'medium',
      // Both ends of this ramp are DARK violet, and that is a scanning
      // requirement rather than a taste call. The system's violet is a
      // light — #B287CC on cream measures 2.7:1, and a decoder threshold
      // lands right in the middle of that, so the code stopped reading at
      // most raster sizes. #4A3560 -> #7A5A94 measures 10:1 down to 5.3:1
      // and reads everywhere, while still being unmistakably the accent.
      gradient: { from: '#4A3560', to: '#7A5A94' },
    },
    cave: {
      label: 'Cave (inverted)',
      module: '#FAF7F2',       // --ink-inverse
      eye: '#FAF7F2',
      eyeDot: '#C9A8E0',       // --violet
      ground: '#2A2320',       // --world-cave
      contrast: 'high',
    },
    mono: {
      label: 'Pure mono (print-safe)',
      module: '#000000',
      eye: '#000000',
      eyeDot: '#000000',
      ground: '#FFFFFF',
      contrast: 'max',
    },
  };

  const DEFAULTS = {
    palette: 'ink',
    moduleShape: 'pebble',   // pebble | square
    eyeStyle: 'pebble',      // pebble | circle | square
    frame: 'resin',          // resin | plain | none
    logo: true,
    idScope: '',
    quiet: 4,
    pixels: 1024,
  };

  // The wordmark, injected by the page once it has loaded
  // /assets/img/min-logo-flat.svg. Kept as source rather than a
  // linked <image> so a downloaded SVG opens correctly anywhere.
  let wordmark = null;
  function setWordmark(paths, viewBox) {
    wordmark = paths ? { paths, viewBox: viewBox || '0 0 138 68' } : null;
  }
  const hasWordmark = () => wordmark !== null;

  // ---- Geometry helpers --------------------------------------------
  const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

  // Gradient ids have to be unique per code, because a page showing the
  // whole print run puts two dozen of these SVGs in one document and a
  // repeated id makes every `url(#...)` after the first resolve to the
  // wrong element — or to nothing. That is how the contact sheet lost all
  // its modules in print while keeping its flat-filled eyes.
  //
  // The suffix is a hash of what the code IS, not a counter or a random
  // string: regenerating the same artwork twice has to produce the same
  // file, byte for byte, or a re-export looks like a change in git.
  function idSuffix(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  // The logo badge, in module units, centred on the grid. Sized as a
  // fraction of the code so it holds its proportions at every version.
  function logoBox(size) {
    const w = Math.max(6, Math.round(size * 0.26));
    const h = Math.round(w * 0.62);
    return {
      x: (size - w) / 2,
      y: (size - h) / 2,
      w,
      h,
      // The cleared area is one module wider all round: modules touching
      // the badge would otherwise read as part of it.
      pad: 1,
    };
  }

  // How much of the code a badge eats, as a share of all modules. The
  // error correction budget is the real limit — H recovers ~30% of the
  // code, so a badge under ~10% leaves plenty of headroom for a scuffed
  // print and a bad camera angle.
  function logoCoverage(qr) {
    const box = logoBox(qr.size);
    const cleared = (box.w + box.pad * 2) * (box.h + box.pad * 2);
    return cleared / (qr.size * qr.size);
  }

  const BUDGET = { L: 0.07, M: 0.15, Q: 0.25, H: 0.30 };

  // Is this combination safe to print? Returns a list of plain warnings.
  function audit(qr, opts) {
    const o = { ...DEFAULTS, ...opts };
    const warnings = [];
    if (o.logo) {
      const coverage = logoCoverage(qr);
      const budget = BUDGET[qr.level];
      if (coverage > budget * 0.45) {
        warnings.push(`The centre badge covers ${(coverage * 100).toFixed(1)}% of the code, which is a lot for ` +
          `level ${qr.level}. Move to level H or turn the badge off.`);
      }
    }
    if (o.quiet < 4) {
      warnings.push('The quiet zone is under 4 modules. Some phone cameras will not find the code at all.');
    }
    if (o.frame === 'none') {
      warnings.push('With no ground of its own the code sits on whatever is behind it. Place it on a light, ' +
        'plain surface — over artwork or a dark colour it will not scan.');
    }
    if (o.palette === 'cave') {
      warnings.push('Light-on-dark is inverted. Phone cameras handle it, but older and cheaper scanners ' +
        'only look for dark-on-light. Keep it for screens and use Warm ink on print.');
    }
    return warnings;
  }

  // ---- Module drawing ----------------------------------------------
  // Pebble modules: a corner is rounded only where nothing dark sits
  // beside it, so runs of modules flow into one shape and lone modules
  // come out as circles. That neighbour test is the whole look — it is
  // what makes the code read as Min's material rather than as a grid.
  function pebblePath(dark, size, offset, radius) {
    const at = (r, c) => (r >= 0 && c >= 0 && r < size && c < size ? dark[r][c] : false);
    const parts = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!dark[r][c]) continue;
        const x = c + offset;
        const y = r + offset;
        const up = at(r - 1, c), down = at(r + 1, c), left = at(r, c - 1), right = at(r, c + 1);
        // Corner radii, clockwise from the top-left.
        const tl = !up && !left ? radius : 0;
        const tr = !up && !right ? radius : 0;
        const br = !down && !right ? radius : 0;
        const bl = !down && !left ? radius : 0;

        parts.push(
          `M${fmt(x + tl)} ${fmt(y)}` +
          `H${fmt(x + 1 - tr)}` + (tr ? `A${fmt(tr)} ${fmt(tr)} 0 0 1 ${fmt(x + 1)} ${fmt(y + tr)}` : '') +
          `V${fmt(y + 1 - br)}` + (br ? `A${fmt(br)} ${fmt(br)} 0 0 1 ${fmt(x + 1 - br)} ${fmt(y + 1)}` : '') +
          `H${fmt(x + bl)}` + (bl ? `A${fmt(bl)} ${fmt(bl)} 0 0 1 ${fmt(x)} ${fmt(y + 1 - bl)}` : '') +
          `V${fmt(y + tl)}` + (tl ? `A${fmt(tl)} ${fmt(tl)} 0 0 1 ${fmt(x + tl)} ${fmt(y)}` : '') +
          'Z'
        );
      }
    }
    return parts.join('');
  }

  function squarePath(dark, size, offset) {
    const parts = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!dark[r][c]) continue;
        parts.push(`M${fmt(c + offset)} ${fmt(r + offset)}h1v1h-1Z`);
      }
    }
    return parts.join('');
  }

  // ---- Finder eyes -------------------------------------------------
  // Drawn as shapes rather than modules so the corners can soften, but
  // the footprint stays exactly 7×7 with a 5×5 hole and a 3×3 pupil —
  // the proportions a decoder measures.
  function eye(x, y, style, colour, dotColour) {
    if (style === 'circle') {
      return `<g><circle cx="${fmt(x + 3.5)}" cy="${fmt(y + 3.5)}" r="3" fill="none" stroke="${colour}" stroke-width="1"/>` +
        `<circle cx="${fmt(x + 3.5)}" cy="${fmt(y + 3.5)}" r="1.5" fill="${dotColour}"/></g>`;
    }
    // The app's card is 82 radius on 340 wide — just under a quarter. The
    // eyes take the same ratio so they are recognisably the same corner.
    const outer = style === 'square' ? 0 : 7 * 0.24;
    const inner = style === 'square' ? 0 : 3 * 0.24;
    return `<g>` +
      `<rect x="${fmt(x + 0.5)}" y="${fmt(y + 0.5)}" width="6" height="6" rx="${fmt(outer * 0.86)}" ` +
      `fill="none" stroke="${colour}" stroke-width="1"/>` +
      `<rect x="${fmt(x + 2)}" y="${fmt(y + 2)}" width="3" height="3" rx="${fmt(inner)}" fill="${dotColour}"/>` +
      `</g>`;
  }

  // ---- The renderer ------------------------------------------------
  function render(qr, options) {
    const o = { ...DEFAULTS, ...options };
    const base = PALETTES[o.palette] || PALETTES.ink;
    // `idScope` separates two renders of the SAME artwork living in one
    // document — the preview and its own cell in the contact sheet. Left
    // empty for downloads, so a file's ids depend only on the code itself.
    const uid = idSuffix([o.idScope || '', o.palette, o.moduleShape, o.eyeStyle, o.frame, o.logo, o.quiet,
      o.label || '', qr.size, qr.level, qr.mask].join('|'));
    const gradId = `kin-qr-grad-${uid}`;
    const bloomId = `kin-qr-bloom-${uid}`;
    const pal = { ...base, module: base.module === 'GRADIENT' ? `url(#${gradId})` : base.module };
    const quiet = Math.max(0, Math.round(o.quiet));
    const grid = qr.size + quiet * 2;

    const height = grid;

    // Copy the grid, then take out everything drawn by hand: the three
    // finders, and the badge footprint if there is one.
    const dark = qr.modules.map((row) => row.slice());
    const clear = (r0, c0, rows, cols) => {
      for (let r = r0; r < r0 + rows; r++) {
        for (let c = c0; c < c0 + cols; c++) {
          if (r >= 0 && c >= 0 && r < qr.size && c < qr.size) dark[r][c] = false;
        }
      }
    };
    clear(0, 0, 7, 7);
    clear(0, qr.size - 7, 7, 7);
    clear(qr.size - 7, 0, 7, 7);

    const box = logoBox(qr.size);
    if (o.logo) {
      clear(Math.floor(box.y - box.pad), Math.floor(box.x - box.pad),
        Math.ceil(box.h + box.pad * 2), Math.ceil(box.w + box.pad * 2));
    }

    // Modules.
    let modules;
    if (o.moduleShape === 'square') {
      modules = `<path fill="${pal.module}" d="${squarePath(dark, qr.size, quiet)}"/>`;
    } else {
      modules = `<path fill="${pal.module}" d="${pebblePath(dark, qr.size, quiet, 0.5)}"/>`;
    }

    const eyes = [
      eye(quiet, quiet, o.eyeStyle, pal.eye, pal.eyeDot),
      eye(quiet + qr.size - 7, quiet, o.eyeStyle, pal.eye, pal.eyeDot),
      eye(quiet, quiet + qr.size - 7, o.eyeStyle, pal.eye, pal.eyeDot),
    ].join('');

    // Ground. The resin frame is the card recipe from tokens.css reduced
    // to what SVG can carry: a warm fill, a soft edge highlight, and a
    // corner radius on the site's scale.
    let ground = '';
    if (o.frame === 'resin') {
      const rad = grid * 0.075;
      const dark = o.palette === 'cave';
      ground =
        `<rect x="0" y="0" width="${fmt(grid)}" height="${fmt(height)}" rx="${fmt(rad)}" fill="${pal.ground}"/>` +
        // The edge bloom is the material's tell, but it is white — over the
        // cave ground it lifts exactly the band the quiet zone occupies and
        // costs contrast where the decoder needs it most. Dark grounds get
        // the rim light alone.
        (dark ? '' : `<rect x="0" y="0" width="${fmt(grid)}" height="${fmt(height)}" rx="${fmt(rad)}" fill="url(#${bloomId})"/>`) +
        `<rect x="0.25" y="0.25" width="${fmt(grid - 0.5)}" height="${fmt(height - 0.5)}" rx="${fmt(rad - 0.2)}" ` +
        `fill="none" stroke="${dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)'}" stroke-width="0.5"/>`;
    } else if (o.frame === 'plain') {
      ground = `<rect x="0" y="0" width="${fmt(grid)}" height="${fmt(height)}" fill="${pal.ground}"/>`;
    }

    // Centre badge: a resin pebble with the wordmark in it. Without the
    // wordmark loaded it falls back to the violet dot alone, which is
    // still unmistakably Min and never a broken-image box.
    let logo = '';
    if (o.logo) {
      const bx = box.x + quiet;
      const by = box.y + quiet;
      const rad = box.h * 0.34;
      const pebble = pal.ground === '#2A2320' ? '#3A312C' : pal.ground;
      logo = `<g><rect x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(box.w)}" height="${fmt(box.h)}" ` +
        `rx="${fmt(rad)}" fill="${pebble}"/>`;
      if (hasWordmark()) {
        const [, , vw, vh] = wordmark.viewBox.split(/\s+/).map(Number);
        const inset = box.h * 0.24;
        const scale = Math.min((box.w - inset * 2) / vw, (box.h - inset * 2) / vh);
        const tx = bx + (box.w - vw * scale) / 2;
        const ty = by + (box.h - vh * scale) / 2;
        const ink = o.palette === 'cave' ? '#FAF7F2' : '#23211E';
        logo += `<g transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${fmt(scale)})">` +
          wordmark.paths.replace(/#23211E/gi, ink) + `</g>`;
      } else {
        logo += `<circle cx="${fmt(bx + box.w / 2)}" cy="${fmt(by + box.h / 2)}" r="${fmt(box.h * 0.28)}" fill="#B287CC"/>`;
      }
      logo += '</g>';
    }

    const defs =
      '<defs>' +
      (pal.gradient
        ? `<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0" stop-color="${pal.gradient.from}"/><stop offset="1" stop-color="${pal.gradient.to}"/></linearGradient>`
        : '') +
      `<radialGradient id="${bloomId}" cx="0.5" cy="0.5" r="0.75">` +
      '<stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0.45"/></radialGradient>' +
      '</defs>';

    const px = Math.max(64, Math.round(o.pixels));
    const pxH = Math.round((px * height) / grid);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${pxH}" ` +
      `viewBox="0 0 ${fmt(grid)} ${fmt(height)}" role="img" ` +
      `aria-label="${esc(o.label ? `QR code for ${o.label}` : 'Min QR code')}">` +
      defs + ground + modules + eyes + logo + '</svg>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render, audit, logoCoverage, setWordmark, hasWordmark, PALETTES, DEFAULTS };
});
