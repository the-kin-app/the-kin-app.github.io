/* ============================================================
   Min — QR encoder
   ------------------------------------------------------------
   A QR Model 2 encoder, byte mode, versions 1–10. No dependencies,
   no CDN: the rest of the site ships its own assets, and a QR that
   goes onto printed posters should not depend on a script somebody
   else can change.

   Versions stop at 10 on purpose. The longest thing this site ever
   encodes is a poster URL — `api.kinapp.social/myllypuro/unclesam`,
   forty-four characters — and version 10 at the highest error
   correction still holds 122 bytes. Everything past that is table nobody would read
   and nobody could check.

   Output is `{ size, modules }` where `modules` is a size×size array
   of booleans, dark = true. Drawing it is somebody else's job (see
   qr-style.js) — this file only decides which squares are black.

   Usage:  KinQR.encode('https://api.kinapp.social/pasila/happy', 'H')
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KinQR = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Galois field GF(256), the arithmetic Reed–Solomon runs in ----
  // Generated once at load: 512 entries so exp[a + b] never needs a wrap.
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function buildTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // the QR primitive polynomial
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  // The generator polynomial for `degree` error-correction codewords:
  // (x - a^0)(x - a^1)...(x - a^(degree-1)), built up one root at a time.
  function generatorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  // Polynomial long division: the remainder IS the error-correction block.
  function ecBlock(data, ecLen) {
    const gen = generatorPoly(ecLen);
    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      rem.copyWithin(0, 1);
      rem[ecLen - 1] = 0;
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) rem[j] ^= mul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  // ---- Block structure, from the spec's Table 9 -------------------
  // Per version, per level: [ecCodewordsPerBlock, blocks..., ] where each
  // block group is [count, dataCodewordsPerBlock]. Two groups at most, and
  // the second group's blocks are always exactly one codeword longer.
  //
  // Read a row as: ec-per-block, then the groups. Version 5 Q, for example,
  // is 18 ec codewords on each of two 15-byte blocks and two 16-byte ones.
  const BLOCKS = {
    1:  { L: [7,  [[1, 19]]],            M: [10, [[1, 16]]],            Q: [13, [[1, 13]]],            H: [17, [[1, 9]]] },
    2:  { L: [10, [[1, 34]]],            M: [16, [[1, 28]]],            Q: [22, [[1, 22]]],            H: [28, [[1, 16]]] },
    3:  { L: [15, [[1, 55]]],            M: [26, [[1, 44]]],            Q: [18, [[2, 17]]],            H: [22, [[2, 13]]] },
    4:  { L: [20, [[1, 80]]],            M: [18, [[2, 32]]],            Q: [26, [[2, 24]]],            H: [16, [[4, 9]]] },
    5:  { L: [26, [[1, 108]]],           M: [24, [[2, 43]]],            Q: [18, [[2, 15], [2, 16]]],   H: [22, [[2, 11], [2, 12]]] },
    6:  { L: [18, [[2, 68]]],            M: [16, [[4, 27]]],            Q: [24, [[4, 19]]],            H: [28, [[4, 15]]] },
    7:  { L: [20, [[2, 78]]],            M: [18, [[4, 31]]],            Q: [18, [[2, 14], [4, 15]]],   H: [26, [[4, 13], [1, 14]]] },
    8:  { L: [24, [[2, 97]]],            M: [22, [[2, 38], [2, 39]]],   Q: [22, [[4, 18], [2, 19]]],   H: [26, [[4, 14], [2, 15]]] },
    9:  { L: [30, [[2, 116]]],           M: [22, [[3, 36], [2, 37]]],   Q: [20, [[4, 16], [4, 17]]],   H: [24, [[4, 12], [4, 13]]] },
    10: { L: [18, [[2, 68], [2, 69]]],   M: [26, [[4, 43], [1, 44]]],   Q: [24, [[6, 19], [2, 20]]],   H: [28, [[6, 15], [2, 16]]] },
  };

  // Centre coordinates of the alignment patterns. Version 1 has none.
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };

  const MAX_VERSION = 10;
  const LEVELS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }; // format-info bits

  function dataCapacity(version, level) {
    const [ecLen, groups] = BLOCKS[version][level];
    return groups.reduce((sum, [count, size]) => sum + count * size, 0);
  }

  // ---- Bit buffer ----
  function BitBuffer() {
    this.bits = [];
  }
  BitBuffer.prototype.put = function (value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  };

  // ---- BCH codes for the format and version information areas ----
  function bch(value, poly, polyLen) {
    let rest = value;
    while (bitLength(rest) >= polyLen) rest ^= poly << (bitLength(rest) - polyLen);
    return rest;
  }
  function bitLength(n) {
    let len = 0;
    while (n !== 0) { len++; n >>>= 1; }
    return len;
  }
  const formatBits = (level, mask) => {
    const data = (LEVELS[level] << 3) | mask;
    return ((data << 10) | bch(data << 10, 0b10100110111, 11)) ^ 0b101010000010010;
  };
  const versionBits = (version) => (version << 12) | bch(version << 12, 0b1111100100101, 13);

  // ---- Mask patterns, in spec order ----
  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  // ---- Matrix scaffolding -------------------------------------------
  // `reserved` marks every module the data stream must skip: the three
  // finders and their separators, both timing lines, the alignment
  // patterns, the format areas, the dark module, and (v7+) the version
  // blocks. Data then snakes through whatever is left.
  function blankMatrix(version) {
    const size = version * 4 + 17;
    const modules = [];
    const reserved = [];
    for (let r = 0; r < size; r++) {
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }

    const set = (r, c, dark) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      modules[r][c] = dark;
      reserved[r][c] = true;
    };

    // Finder patterns + their one-module separators.
    const finder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          set(row + r, col + c, ring !== 2 && ring <= 3);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // Alignment patterns — every centre pair except the three that would
    // land on a finder.
    const centres = ALIGN[version];
    for (const r of centres) {
      for (const c of centres) {
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    // Timing patterns.
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }

    // Format areas — contents come later, but they are off-limits now.
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) set(8, i, false);
      if (!reserved[i][8]) set(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      set(8, size - 1 - i, false);
      set(size - 1 - i, 8, false);
    }
    set(size - 8, 8, true); // the dark module

    // Version information, versions 7 and up.
    if (version >= 7) {
      const bits = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >> i) & 1) === 1;
        set(Math.floor(i / 3), size - 11 + (i % 3), bit);
        set(size - 11 + (i % 3), Math.floor(i / 3), bit);
      }
    }

    return { size, modules, reserved };
  }

  // Data snakes up and down in two-column strips, right to left, skipping
  // column 6 (the vertical timing line).
  function placeData(matrix, codewords) {
    const { size, modules, reserved } = matrix;
    let bit = 0;
    const total = codewords.length * 8;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5;
      for (let step = 0; step < size; step++) {
        for (let col of [right, right - 1]) {
          const upward = ((right + 1) & 2) === 0;
          const row = upward ? size - 1 - step : step;
          if (reserved[row][col]) continue;
          let dark = false;
          if (bit < total) dark = ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
          modules[row][col] = dark;
          bit++;
        }
      }
    }
  }

  function applyMask(matrix, maskIndex) {
    const { size, modules, reserved } = matrix;
    const mask = MASKS[maskIndex];
    const out = modules.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && mask(r, c)) out[r][c] = !out[r][c];
      }
    }
    return out;
  }

  function writeFormat(modules, size, level, maskIndex) {
    const bits = formatBits(level, maskIndex);
    // The 15 format bits are placed most-significant first: position 0 in the
    // sequence below carries bit 14. Getting this backwards produces a
    // perfectly plausible-looking code that no scanner can read.
    const get = (i) => ((bits >> (14 - i)) & 1) === 1;
    // Copy one: around the top-left finder, skipping the timing row/column.
    for (let i = 0; i <= 5; i++) modules[8][i] = get(i);
    modules[8][7] = get(6);
    modules[8][8] = get(7);
    modules[7][8] = get(8);
    for (let i = 9; i <= 14; i++) modules[14 - i][8] = get(i);
    // Copy two: split between the other two finders.
    for (let i = 0; i <= 7; i++) modules[size - 1 - i][8] = get(i);
    for (let i = 8; i <= 14; i++) modules[8][size - 15 + i] = get(i);
    modules[size - 8][8] = true; // dark module, restated after masking
  }

  // ---- Mask scoring, the spec's four penalty rules ----
  function penalty(modules, size) {
    let score = 0;

    // Rule 1 — runs of five or more same-colour modules in a line.
    const runs = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b < size; b++) {
          if (get(a, b) === get(a, b - 1)) {
            run++;
          } else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
        if (run >= 5) score += run - 2;
      }
    };
    runs((a, b) => modules[a][b]);
    runs((a, b) => modules[b][a]);

    // Rule 2 — every 2×2 block of one colour.
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
      }
    }

    // Rule 3 — the finder-lookalike 1:1:3:1:1 pattern with four light
    // modules on either side.
    const pattern = [true, false, true, true, true, false, true];
    const matchesAt = (get, a, b) => {
      for (let i = 0; i < 7; i++) if (get(a, b + i) !== pattern[i]) return false;
      const clearBefore = () => {
        for (let i = 1; i <= 4; i++) { if (b - i < 0) return true; if (get(a, b - i)) return false; }
        return true;
      };
      const clearAfter = () => {
        for (let i = 0; i < 4; i++) { if (b + 7 + i >= size) return true; if (get(a, b + 7 + i)) return false; }
        return true;
      };
      return clearBefore() || clearAfter();
    };
    for (let a = 0; a < size; a++) {
      for (let b = 0; b + 7 <= size; b++) {
        if (matchesAt((x, y) => modules[x][y], a, b)) score += 40;
        if (matchesAt((x, y) => modules[y][x], a, b)) score += 40;
      }
    }

    // Rule 4 — how far the dark/light balance strays from 50%.
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r][c]) dark++;
    const ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return score;
  }

  // ---- The one exported function ----
  function encode(text, level) {
    level = level || 'M';
    if (!LEVELS.hasOwnProperty(level)) throw new Error(`Unknown error-correction level: ${level}`);

    const bytes = new TextEncoder().encode(String(text));

    // Smallest version the payload fits in, counting the mode indicator
    // and the character count field.
    let version = 0;
    for (let v = 1; v <= MAX_VERSION; v++) {
      const countBits = v <= 9 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= dataCapacity(v, level) * 8) { version = v; break; }
    }
    if (!version) {
      throw new Error(`${bytes.length} bytes is too long for level ${level} at version ${MAX_VERSION} ` +
        `(max ${dataCapacity(MAX_VERSION, level)}). Shorten the URL or drop to a lower level.`);
    }

    const [ecLen, groups] = BLOCKS[version][level];
    const capacity = dataCapacity(version, level);

    // Bit stream: mode, length, payload, terminator, then pad bytes.
    const buffer = new BitBuffer();
    buffer.put(0b0100, 4);
    buffer.put(bytes.length, version <= 9 ? 8 : 16);
    for (const b of bytes) buffer.put(b, 8);
    const terminator = Math.min(4, capacity * 8 - buffer.bits.length);
    buffer.put(0, terminator);
    while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);

    const data = new Uint8Array(capacity);
    for (let i = 0; i < buffer.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j];
      data[i / 8] = byte;
    }
    for (let i = buffer.bits.length / 8, pad = 0; i < capacity; i++, pad++) {
      data[i] = pad % 2 === 0 ? 0xec : 0x11;
    }

    // Split into blocks, error-correct each, then interleave — data
    // codewords column by column, then all the EC codewords the same way.
    const blocks = [];
    let offset = 0;
    for (const [count, size] of groups) {
      for (let i = 0; i < count; i++) {
        const chunk = data.subarray(offset, offset + size);
        offset += size;
        blocks.push({ data: chunk, ec: ecBlock(chunk, ecLen) });
      }
    }

    const interleaved = [];
    const longest = Math.max(...blocks.map((b) => b.data.length));
    for (let i = 0; i < longest; i++) {
      for (const block of blocks) if (i < block.data.length) interleaved.push(block.data[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const block of blocks) interleaved.push(block.ec[i]);
    }

    // Lay it out, then pick the mask that scores lowest.
    const matrix = blankMatrix(version);
    placeData(matrix, interleaved);

    let best = null;
    for (let m = 0; m < 8; m++) {
      const candidate = applyMask(matrix, m);
      writeFormat(candidate, matrix.size, level, m);
      const score = penalty(candidate, matrix.size);
      if (!best || score < best.score) best = { score, mask: m, modules: candidate };
    }

    return { size: matrix.size, modules: best.modules, version, level, mask: best.mask };
  }

  return { encode, MAX_VERSION, capacity: dataCapacity };
});
