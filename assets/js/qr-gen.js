/* ============================================================================
   QR GENERATOR  (assets/js/qr-gen.js)
   ----------------------------------------------------------------------------
   Chhota, dependency-free QR encoder (byte mode, ECC level M).
   window.RSQR.render(text, size, opts) -> PNG data URL string

   Sirf wahi features hain jo invite link ke liye chahiye:
     * byte mode (UTF-8)
     * auto version (1..10)
     * ECC level M
     * mask 0..7 me se best (penalty se)
   ========================================================================== */
(function () {
  'use strict';
  if (window.RSQR) return;

  /* ---------------- Galois field (GF(256), poly 0x11d) ---------------- */
  var EXP = new Array(256), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  /* ---------------- versions / ECC tables (level M) ---------------- */
  /* [totalCodewords, ecCodewordsPerBlock, [ [numBlocks, dataPerBlock], ... ] ] */
  var RS_M = {
    1:  [26, 10, [[1, 16]]],
    2:  [44, 16, [[1, 28]]],
    3:  [70, 26, [[1, 44]]],
    4:  [100, 18, [[2, 32]]],
    5:  [134, 24, [[2, 43]]],
    6:  [172, 16, [[4, 27]]],
    7:  [196, 18, [[4, 31]]],
    8:  [242, 22, [[2, 38], [2, 39]]],
    9:  [292, 22, [[3, 36], [2, 37]]],
    10: [346, 26, [[4, 43], [1, 44]]]
  };

  function dataCodewords(v) {
    var t = RS_M[v];
    if (!t) return 0;
    var sum = 0;
    for (var i = 0; i < t[2].length; i++) sum += t[2][i][0] * t[2][i][1];
    return sum;
  }
  function byteLenBits(v) { return v <= 9 ? 8 : 16; }
  function capacityBytes(v) {
    var dc = dataCodewords(v);
    var bits = dc * 8 - 4 - byteLenBits(v);
    return Math.floor(bits / 8);
  }

  /* ---------------- bit buffer ---------------- */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (val, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  };

  /* ---------------- UTF-8 encode ---------------- */
  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0xd800 || c >= 0xe000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else {
        i++; var c2 = str.charCodeAt(i);
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  }

  /* ---------------- Reed-Solomon ---------------- */
  function rsGenPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= gmul(g[j], 1);
        ng[j + 1] ^= gmul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGenPoly(ecLen);
    var res = data.slice();
    for (var i = 0; i < ecLen; i++) res.push(0);
    for (var k = 0; k < data.length; k++) {
      var factor = res[k];
      if (factor !== 0) {
        for (var j = 0; j < gen.length; j++) res[k + j] ^= gmul(gen[j], factor);
      }
    }
    return res.slice(data.length);
  }

  /* ---------------- build codewords ---------------- */
  function buildCodewords(bytes, version) {
    var t = RS_M[version];
    var ecPerBlock = t[1], groups = t[2];
    var buf = new BitBuf();
    buf.put(4, 4);
    buf.put(bytes.length, byteLenBits(version));
    for (var i = 0; i < bytes.length; i++) buf.put(bytes[i], 8);
    var dataCw = dataCodewords(version);
    var capBits = dataCw * 8;
    var term = Math.min(4, capBits - buf.bits.length);
    buf.put(0, term);
    while (buf.bits.length % 8 !== 0) buf.bits.push(0);
    var dataBytes = [];
    for (var b = 0; b < buf.bits.length; b += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | buf.bits[b + k];
      dataBytes.push(v);
    }
    var pad = [0xec, 0x11], pi = 0;
    while (dataBytes.length < dataCw) { dataBytes.push(pad[pi & 1]); pi++; }

    var blocks = [], ecBlocks = [], offset = 0;
    for (var g = 0; g < groups.length; g++) {
      for (var n = 0; n < groups[g][0]; n++) {
        var d = dataBytes.slice(offset, offset + groups[g][1]); offset += groups[g][1];
        blocks.push(d);
        ecBlocks.push(rsEncode(d, ecPerBlock));
      }
    }
    var maxData = 0;
    for (var i2 = 0; i2 < blocks.length; i2++) maxData = Math.max(maxData, blocks[i2].length);
    var out = [];
    for (var c = 0; c < maxData; c++) {
      for (var bi = 0; bi < blocks.length; bi++) if (c < blocks[bi].length) out.push(blocks[bi][c]);
    }
    for (var c2 = 0; c2 < ecPerBlock; c2++) {
      for (var bj = 0; bj < ecBlocks.length; bj++) out.push(ecBlocks[bj][c2]);
    }
    return out;
  }

  /* ---------------- matrix build ---------------- */
  function newMatrix(n) {
    var m = [];
    for (var y = 0; y < n; y++) { m.push(new Array(n).fill(null)); }
    return m;
  }

  function placeFinder(m, r, c) {
    for (var dy = -1; dy <= 7; dy++) {
      for (var dx = -1; dx <= 7; dx++) {
        var y = r + dy, x = c + dx;
        if (y < 0 || y >= m.length || x < 0 || x >= m.length) continue;
        var on = (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
                 (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
                 (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4);
        m[y][x] = on ? 1 : 0;
      }
    }
  }

  function alignPositions(v) {
    if (v === 1) return [];
    var table = {
      2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
      7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
    };
    return table[v] || [];
  }

  function placeAlignment(m, v) {
    var pos = alignPositions(v);
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var r = pos[i], c = pos[j];
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= m.length - 9) || (r >= m.length - 9 && c <= 8)) continue;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            var on = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
            m[r + dy][c + dx] = on ? 1 : 0;
          }
        }
      }
    }
  }

  function placeTiming(m) {
    for (var i = 8; i < m.length - 8; i++) {
      if (m[6][i] === null) m[6][i] = (i % 2 === 0) ? 1 : 0;
      if (m[i][6] === null) m[i][6] = (i % 2 === 0) ? 1 : 0;
    }
  }

  function formatBits(mask) {
    var data = (0 << 3) | mask;  /* ECC level M = 00 */
    var poly = 0x537;
    var val = data << 10;
    for (var i = 14; i >= 10; i--) {
      if ((val >>> i) & 1) val ^= poly << (i - 10);
    }
    return ((data << 10) | (val & 0x3ff)) ^ 0x5412;
  }

  function placeFormat(m, mask) {
    var bits = formatBits(mask);
    var n = m.length;
    for (var i = 0; i <= 5; i++) m[8][i] = (bits >> i) & 1;
    m[8][7] = (bits >> 6) & 1;
    m[8][8] = (bits >> 7) & 1;
    m[7][8] = (bits >> 8) & 1;
    for (var j = 9; j <= 14; j++) m[14 - j][8] = (bits >> j) & 1;

    for (var k = 0; k <= 7; k++) m[n - 1 - k][8] = (bits >> k) & 1;
    for (var q = 8; q <= 14; q++) m[8][n - 15 + q] = (bits >> q) & 1;
    m[n - 8][8] = 1; /* dark module */
  }

  function buildBase(version) {
    var n = version * 4 + 17;
    var m = newMatrix(n);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, n - 7);
    placeFinder(m, n - 7, 0);
    placeAlignment(m, version);
    placeTiming(m);
    for (var i = 0; i <= 8; i++) {
      if (m[8][i] === null) m[8][i] = 0;
      if (m[i][8] === null) m[i][8] = 0;
      if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = 0;
      if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = 0;
    }
    return m;
  }

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
    return false;
  }

  function placeData(m, codewords, mask) {
    var n = m.length;
    var bits = [];
    for (var i = 0; i < codewords.length; i++) {
      for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
    }
    var dir = -1, row = n - 1, idx = 0;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (var c = 0; c < 2; c++) {
          var x = col - c;
          if (m[row][x] === null) {
            var bit = idx < bits.length ? bits[idx++] : 0;
            if (maskFn(mask, row, x)) bit ^= 1;
            m[row][x] = bit;
          }
        }
        row += dir;
        if (row < 0 || row >= n) { row -= dir; dir = -dir; break; }
      }
    }
  }

  function penalty(m) {
    var n = m.length, score = 0, i, j;
    for (i = 0; i < n; i++) {
      var rc = 1, cc = 1;
      for (j = 1; j < n; j++) {
        if (m[i][j] === m[i][j - 1]) { rc++; } else { if (rc >= 5) score += rc - 2; rc = 1; }
        if (m[j][i] === m[j - 1][i]) { cc++; } else { if (cc >= 5) score += cc - 2; cc = 1; }
      }
      if (rc >= 5) score += rc - 2;
      if (cc >= 5) score += cc - 2;
    }
    for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) {
      var v = m[i][j];
      if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) score += 3;
    }
    return score;
  }

  function render(text, size, opts) {
    opts = opts || {};
    var bytes = utf8(String(text == null ? '' : text));
    var version = 1;
    for (var v = 1; v <= 10; v++) { version = v; if (bytes.length <= capacityBytes(v)) break; }
    if (bytes.length > capacityBytes(version)) version = 10;

    var cw = buildCodewords(bytes, version);
    var base = buildBase(version);

    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var m = base.map(function (row) { return row.slice(); });
      placeData(m, cw, mask);
      placeFormat(m, mask);
      var s = penalty(m);
      if (s < bestScore) { bestScore = s; best = m; }
    }

    var n = best.length;
    var quiet = (opts.quiet == null ? 4 : opts.quiet);
    var total = n + quiet * 2;
    var px = Math.max(1, Math.floor(((size || 300) / total)));
    var dim = total * px;

    var canvas = document.createElement('canvas');
    canvas.width = dim; canvas.height = dim;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.bg || '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = opts.fg || '#000000';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (best[y][x]) ctx.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
      }
    }
    return canvas.toDataURL('image/png');
  }

  window.RSQR = { render: render, matrix: matrix, version: '1.0' };

  /* test/debug ke liye: boolean grid return karo (canvas ke bina) */
  function matrix(text, opts) {
    opts = opts || {};
    var bytes = utf8(String(text == null ? '' : text));
    var version = 1;
    for (var v = 1; v <= 10; v++) { version = v; if (bytes.length <= capacityBytes(v)) break; }
    if (bytes.length > capacityBytes(version)) version = 10;
    var cw = buildCodewords(bytes, version);
    var base = buildBase(version);
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var m = base.map(function (row) { return row.slice(); });
      placeData(m, cw, mask);
      placeFormat(m, mask);
      var s = penalty(m);
      if (s < bestScore) { bestScore = s; best = m; }
    }
    return { version: version, size: best.length, modules: best };
  }
})();
