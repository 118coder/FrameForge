/* FrameForge · LAB 感知色彩工具（V5）
 * - 合并临近色：LAB 空间按感知距离合并相近色（不改变分辨率）
 * - 色表对标：提取模板色表 → 将待修改图映射到同一套颜色
 */
(function () {
  "use strict";

  function rgb2lab(r, g, b) {
    function lin(c) {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var r2 = lin(r), g2 = lin(g), b2 = lin(b);
    var x = (r2 * 0.4124 + g2 * 0.3576 + b2 * 0.1805) / 0.95047;
    var y = r2 * 0.2126 + g2 * 0.7152 + b2 * 0.0722;
    var z = (r2 * 0.0193 + g2 * 0.1192 + b2 * 0.9505) / 1.08883;
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function labDist(a, b) {
    var d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
    return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
  }

  function keyOf(r, g, b) { return (r << 16) | (g << 8) | b; }

  function uniqueColors(im, alphaThr) {
    var seen = new Map();
    var d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= (alphaThr === undefined ? 8 : alphaThr)) continue;
      var k = keyOf(d[i], d[i + 1], d[i + 2]);
      var e = seen.get(k);
      if (e) e.count++;
      else seen.set(k, { r: d[i], g: d[i + 1], b: d[i + 2], count: 1 });
    }
    return Array.from(seen.values());
  }

  /**
   * 合并临近色：LAB 距离 ≤ threshold 的颜色并查集聚类，簇内取计数加权均值。
   * strength 0..100 → threshold = strength/100 * 60
   */
  function mergeSimilar(im, strength) {
    var thr = Math.max(1, strength / 100 * 60);
    var colors = uniqueColors(im);
    if (!colors.length) return im;
    var labs = colors.map(function (c) { return rgb2lab(c.r, c.g, c.b); });
    // 并查集
    var parent = colors.map(function (_, i) { return i; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    for (var i = 0; i < colors.length; i++) {
      for (var j = i + 1; j < colors.length; j++) {
        if (labDist(labs[i], labs[j]) <= thr) {
          var ri = find(i), rj = find(j);
          if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
        }
      }
    }
    // 簇均值（按出现次数加权）
    var groups = new Map();
    colors.forEach(function (c, i) {
      var root = find(i);
      var g = groups.get(root);
      if (!g) { g = { r: 0, g: 0, b: 0, w: 0 }; groups.set(root, g); }
      g.r += c.r * c.count; g.g += c.g * c.count; g.b += c.b * c.count; g.w += c.count;
    });
    var mapping = new Map();
    colors.forEach(function (c, i) {
      var g = groups.get(find(i));
      mapping.set(keyOf(c.r, c.g, c.b), [
        Math.round(g.r / g.w), Math.round(g.g / g.w), Math.round(g.b / g.w)
      ]);
    });
    var out = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
    var d = out.data;
    for (var p = 0; p < d.length; p += 4) {
      if (d[p + 3] === 0) continue;
      var m = mapping.get(keyOf(d[p], d[p + 1], d[p + 2]));
      if (m) { d[p] = m[0]; d[p + 1] = m[1]; d[p + 2] = m[2]; }
    }
    return out;
  }

  /**
   * 提取模板色表（按出现次数排序，上限 maxColors）
   */
  function extractPalette(im, maxColors) {
    var colors = uniqueColors(im, 250); // 忽略接近透明的像素
    colors.sort(function (a, b) { return b.count - a.count; });
    return colors.slice(0, maxColors || 256).map(function (c) { return [c.r, c.g, c.b]; });
  }

  /**
   * 把待修改图映射到给定色表（LAB 最近邻）
   */
  function mapToPalette(im, palette) {
    if (!palette.length) return im;
    var palLab = palette.map(function (c) { return rgb2lab(c[0], c[1], c[2]); });
    var cache = new Map();
    var out = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
    var d = out.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      var k = keyOf(d[i], d[i + 1], d[i + 2]);
      var m = cache.get(k);
      if (!m) {
        var lab = rgb2lab(d[i], d[i + 1], d[i + 2]);
        var best = 0, bd = Infinity;
        for (var j = 0; j < palLab.length; j++) {
          var dist = labDist(lab, palLab[j]);
          if (dist < bd) { bd = dist; best = j; }
        }
        m = palette[best];
        cache.set(k, m);
      }
      d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2];
    }
    return out;
  }

  window.FF = window.FF || {};
  FF.Lab = {
    rgb2lab: rgb2lab,
    labDist: labDist,
    mergeSimilar: mergeSimilar,
    extractPalette: extractPalette,
    mapToPalette: mapToPalette
  };
})();
