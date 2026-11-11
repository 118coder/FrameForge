/* FrameForge · 完美像素算法（V5）
 * 移植自 theamusing/perfectPixel（FrameRonin TypeScript 重写）：
 * FFT 倍周期检测 + Sobel 梯度细化 + 格内采样（中心/中位数/双聚类主色）
 * 将 AI 生成等"歪网格"放大像素图重新对齐到规整格点，恢复原始小图。
 */
(function () {
  "use strict";

  var MAX_SIDE = 2048;
  var TRANSPARENT_ALPHA = 8;

  /* ---------------- 基础工具 ---------------- */

  function rgbToGray(rgba, n) {
    var gray = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var o = i * 4;
      gray[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    }
    return gray;
  }

  function nextPow2(v) {
    var p = 1;
    while (p < v) p <<= 1;
    return p;
  }

  /* ---------------- FFT（迭代 radix-2） ---------------- */

  function fft1d(re, im, n, inverse) {
    // bit reversal
    for (var i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        var tr = re[i]; re[i] = re[j]; re[j] = tr;
        var ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = (inverse ? 2 : -2) * Math.PI / len;
      var wr = Math.cos(ang), wi = Math.sin(ang);
      for (var k2 = 0; k2 < n; k2 += len) {
        var cr = 1, ci = 0;
        for (var k = 0; k < len / 2; k++) {
          var ur = re[k2 + k], ui = im[k2 + k];
          var vr = re[k2 + k + len / 2] * cr - im[k2 + k + len / 2] * ci;
          var vi = re[k2 + k + len / 2] * ci + im[k2 + k + len / 2] * cr;
          re[k2 + k] = ur + vr; im[k2 + k] = ui + vi;
          re[k2 + k + len / 2] = ur - vr; im[k2 + k + len / 2] = ui - vi;
          var ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
    if (inverse) {
      for (var q = 0; q < n; q++) { re[q] /= n; im[q] /= n; }
    }
  }

  function fft2d(re, im, w, h, inverse) {
    var rowR = new Float64Array(w), rowI = new Float64Array(w);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) { rowR[x] = re[y * w + x]; rowI[x] = im[y * w + x]; }
      fft1d(rowR, rowI, w, inverse);
      for (var x2 = 0; x2 < w; x2++) { re[y * w + x2] = rowR[x2]; im[y * w + x2] = rowI[x2]; }
    }
    var colR = new Float64Array(h), colI = new Float64Array(h);
    for (var x3 = 0; x3 < w; x3++) {
      for (var y2 = 0; y2 < h; y2++) { colR[y2] = re[y2 * w + x3]; colI[y2] = im[y2 * w + x3]; }
      fft1d(colR, colI, h, inverse);
      for (var y3 = 0; y3 < h; y3++) { re[y3 * w + x3] = colR[y3]; im[y3 * w + x3] = colI[y3]; }
    }
  }

  /* ---------------- FFT 周期粗估 ---------------- */

  function smooth1d(arr, win) {
    var half = Math.floor(win / 2);
    var out = new Float64Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      var s = 0, c = 0;
      for (var k = -half; k <= half; k++) {
        var j = i + k;
        if (j >= 0 && j < arr.length) { s += arr[j]; c++; }
      }
      out[i] = s / c;
    }
    return out;
  }

  function detectPeak(sum, minDist, relThr) {
    var max = 0;
    for (var i = 0; i < sum.length; i++) if (sum[i] > max) max = sum[i];
    var thr = max * relThr;
    var n = sum.length;
    var mid = Math.floor(n / 2);

    function isPeak(i) {
      for (var k = Math.max(0, i - minDist); k <= Math.min(n - 1, i + minDist); k++) {
        if (sum[k] > sum[i]) return false;
      }
      return true;
    }

    // 从中心向外找第一个合格峰：基频优先（谐波能量可能更高但频率更远）
    function scanOutward() {
      for (var d = minDist; d < mid; d++) {
        var li = mid - d, ri = mid + d;
        if (li >= 0 && sum[li] >= thr && isPeak(li)) return li;
        if (ri < n && sum[ri] >= thr && isPeak(ri)) return ri;
      }
      return -1;
    }

    var p1 = scanOutward();
    if (p1 < 0) return 0;
    // 镜像侧找对应峰（允许 ±2 bin 容差）
    var p2 = mid + (mid - p1);
    var best = p2, bestDiff = Infinity;
    for (var k = Math.max(0, p2 - 2); k <= Math.min(n - 1, p2 + 2); k++) {
      if (sum[k] >= thr && Math.abs(k - p2) < bestDiff) { bestDiff = Math.abs(k - p2); best = k; }
    }
    if (best === p2 && !(sum[p2] >= thr)) return 0;
    return Math.abs(best - p1) / 2;
  }

  function estimateGridFft(gray, W, H, peakWidth) {
    var pw = nextPow2(W), ph = nextPow2(H);
    if (pw > 4096 || ph > 4096) return { gridW: 0, gridH: 0 };
    var re = new Float64Array(pw * ph);
    var im = new Float64Array(pw * ph);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) re[y * pw + x] = gray[y * W + x];
    fft2d(re, im, pw, ph, false);
    // 幅度谱 + fftShift + 对数压缩
    var mag = new Float64Array(pw * ph);
    for (var i = 0; i < pw * ph; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    var hw = Math.floor(pw / 2), hh = Math.floor(ph / 2);
    // 只统计 DC 对称的有效频率窗口（排除零填充区的平坦谱污染）
    var x0 = hw - Math.floor(W / 2), x1 = hw + Math.ceil(W / 2);
    var y0 = hh - Math.floor(H / 2), y1 = hh + Math.ceil(H / 2);
    var logged = new Float64Array(pw * ph);
    var mn = Infinity, mx = -Infinity;
    for (var yy = y0; yy < y1; yy++) {
      for (var xx = x0; xx < x1; xx++) {
        var sy2 = (yy + hh) % ph, sx2 = (xx + hw) % pw;
        var lg = 1 - Math.log1p(mag[sy2 * pw + sx2]);
        logged[yy * pw + xx] = lg;
        if (lg < mn) mn = lg;
        if (lg > mx) mx = lg;
      }
    }
    var colSum = new Float64Array(W), rowSum = new Float64Array(H);
    for (var y3 = y0; y3 < y1; y3++) {
      for (var x3 = x0; x3 < x1; x3++) {
        var v = (logged[y3 * pw + x3] - mn) / (mx - mn || 1);
        colSum[x3 - x0] += v;
        rowSum[y3 - y0] += v;
      }
    }
    var colS = smooth1d(Array.from(colSum), 17);
    var rowS = smooth1d(Array.from(rowSum), 17);
    var scaleCol = detectPeak(colS, 6, 0.35);
    var scaleRow = detectPeak(rowS, 6, 0.35);
    // 频域峰对间距（bin）→ 空间周期 = 有效长度 / 间距
    var gridW = scaleCol > 0 ? Math.round(W / scaleCol) : 0;
    var gridH = scaleRow > 0 ? Math.round(H / scaleRow) : 0;
    return { gridW: gridW, gridH: gridH };
  }

  /* ---------------- Sobel 梯度回退/细化 ---------------- */

  function sobelProjections(gray, W, H) {
    var gxSum = new Float64Array(W), gySum = new Float64Array(H);
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var tl = gray[(y - 1) * W + x - 1], tc = gray[(y - 1) * W + x], tr = gray[(y - 1) * W + x + 1];
        var ml = gray[y * W + x - 1], mr = gray[y * W + x + 1];
        var bl = gray[(y + 1) * W + x - 1], bc = gray[(y + 1) * W + x], br = gray[(y + 1) * W + x + 1];
        var gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        var gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
        gxSum[x] += Math.abs(gx);
        gySum[y] += Math.abs(gy);
      }
    }
    return { gxSum: gxSum, gySum: gySum };
  }

  function findPeaks(proj, minDist, relThr) {
    var max = 0;
    for (var i = 0; i < proj.length; i++) if (proj[i] > max) max = proj[i];
    var thr = max * relThr;
    var peaks = [];
    for (var j = 1; j < proj.length - 1; j++) {
      if (proj[j] >= thr && proj[j] >= proj[j - 1] && proj[j] >= proj[j + 1]) {
        if (peaks.length && j - peaks[peaks.length - 1] < minDist) {
          if (proj[j] > proj[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = j;
        } else {
          peaks.push(j);
        }
      }
    }
    return peaks;
  }

  function estimateGridGradient(gray, W, H) {
    var proj = sobelProjections(gray, W, H);
    function medSpacing(sum) {
      var peaks = findPeaks(sum, 4, 0.2);
      if (peaks.length < 2) return 0;
      var gaps = [];
      for (var i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
      gaps.sort(function (a, b) { return a - b; });
      return gaps[Math.floor(gaps.length / 2)];
    }
    var medX = medSpacing(proj.gxSum);
    var medY = medSpacing(proj.gySum);
    if (medX < 1 || medY < 1) return { gridW: 0, gridH: 0 };
    return { gridW: Math.max(1, Math.round(W / medX)), gridH: Math.max(1, Math.round(H / medY)) };
  }

  function detectGridScale(gray, W, H, peakWidth, maxRatio, minSize) {
    var fft = estimateGridFft(gray, W, H, peakWidth);
    var ok = function (gw, gh) {
      if (!gw || !gh) return false;
      var cellW = W / gw, cellH = H / gh;
      if (cellW < minSize || cellH < minSize) return false;
      if (cellW > 20 || cellH > 20) return false;
      var ratio = cellW / cellH;
      if (ratio > maxRatio || ratio < 1 / maxRatio) return false;
      return true;
    };
    if (ok(fft.gridW, fft.gridH)) return fft;
    var grad = estimateGridGradient(gray, W, H);
    if (ok(grad.gridW, grad.gridH)) return grad;
    return { gridW: 0, gridH: 0 };
  }

  /* ---------------- 网格线细化 ---------------- */

  function findBestGrid(center, cell, search, proj, W) {
    var from = Math.max(0, Math.round(center - search));
    var to = Math.min(W - 1, Math.round(center + search));
    var best = Math.round(center), bestVal = -1;
    for (var x = from; x <= to; x++) {
      if (proj[x] > bestVal) { bestVal = proj[x]; best = x; }
    }
    return best;
  }

  function refineGrids(gray, W, H, gridW, gridH, refineIntensity) {
    var proj = sobelProjections(gray, W, H);
    var cellW = W / gridW, cellH = H / gridH;

    var midX = findBestGrid(W / 2, cellW, cellW * refineIntensity + 2, proj.gxSum, W);
    var midY = findBestGrid(H / 2, cellH, cellH * refineIntensity + 2, proj.gySum, H);
    var xs = [midX], ys = [midY];
    var searchX = Math.max(2, cellW * refineIntensity);
    var searchY = Math.max(2, cellH * refineIntensity);
    var x = midX, y = midY;
    while (x - cellW >= 0) {
      x = findBestGrid(x - cellW, cellW, searchX, proj.gxSum, W);
      xs.unshift(x);
      if (xs.length > gridW + 8) break;
    }
    x = midX;
    while (x + cellW < W) {
      x = findBestGrid(x + cellW, cellW, searchX, proj.gxSum, W);
      xs.push(x);
      if (xs.length > gridW * 2 + 8) break;
    }
    y = midY;
    while (y - cellH >= 0) {
      y = findBestGrid(y - cellH, cellH, searchY, proj.gySum, H);
      ys.unshift(y);
      if (ys.length > gridH + 8) break;
    }
    y = midY;
    while (y + cellH < H) {
      y = findBestGrid(y + cellH, cellH, searchY, proj.gySum, H);
      ys.push(y);
      if (ys.length > gridH * 2 + 8) break;
    }

    // 排序 + 去重（间距 < 2px 的合并）
    function dedupe(arr) {
      arr.sort(function (a, b) { return a - b; });
      var out = [arr[0]];
      for (var i = 1; i < arr.length; i++) {
        if (arr[i] - out[out.length - 1] >= 2) out.push(arr[i]);
      }
      return out;
    }
    xs = dedupe(xs);
    ys = dedupe(ys);

    // 边界补齐为 0 与 W/H
    if (xs[0] > 0) xs.unshift(0);
    if (xs[xs.length - 1] < W) xs.push(W);
    if (ys[0] > 0) ys.unshift(0);
    if (ys[ys.length - 1] < H) ys.push(H);

    // 裁掉首尾"半格"（补边界后间距不足 0.5 格的边缘段，循环裁到稳定）
    var cellW2 = W / gridW, cellH2 = H / gridH;
    while (xs.length > 2 && xs[1] - xs[0] < cellW2 * 0.5) xs.shift();
    while (xs.length > 2 && xs[xs.length - 1] - xs[xs.length - 2] < cellW2 * 0.5) xs.pop();
    while (ys.length > 2 && ys[1] - ys[0] < cellH2 * 0.5) ys.shift();
    while (ys.length > 2 && ys[ys.length - 1] - ys[ys.length - 2] < cellH2 * 0.5) ys.pop();
    return { xCoords: xs, yCoords: ys };
  }

  /* ---------------- 格内采样 ---------------- */

  function sampleCenter(r, g, b, a, W, H, xc, yc) {
    var nx = xc.length - 1, ny = yc.length - 1;
    var out = new Uint8ClampedArray(nx * ny * 4);
    for (var cy = 0; cy < ny; cy++) {
      for (var cx = 0; cx < nx; cx++) {
        var px = Math.round((xc[cx] + xc[cx + 1]) / 2);
        var py = Math.round((yc[cy] + yc[cy + 1]) / 2);
        px = Math.min(W - 1, Math.max(0, px));
        py = Math.min(H - 1, Math.max(0, py));
        var i = py * W + px; // 平面数组：像素索引（非字节偏移）
        var d = (cy * nx + cx) * 4;
        if (a[i] <= TRANSPARENT_ALPHA) { out[d + 3] = 0; continue; }
        out[d] = r[i]; out[d + 1] = g[i]; out[d + 2] = b[i]; out[d + 3] = a[i];
      }
    }
    return new ImageData(out, nx, ny);
  }

  function sampleMedian(r, g, b, a, W, H, xc, yc) {
    var nx = xc.length - 1, ny = yc.length - 1;
    var out = new Uint8ClampedArray(nx * ny * 4);
    for (var cy = 0; cy < ny; cy++) {
      for (var cx = 0; cx < nx; cx++) {
        var x0 = Math.max(0, Math.floor(xc[cx])), x1 = Math.min(W, Math.ceil(xc[cx + 1]));
        var y0 = Math.max(0, Math.floor(yc[cy])), y1 = Math.min(H, Math.ceil(yc[cy + 1]));
        var rs = [], gs = [], bs = [], as = [];
        for (var py = y0; py < y1; py++) {
          for (var px = x0; px < x1; px++) {
            var o = py * W + px;
            if (a[o] <= TRANSPARENT_ALPHA) continue;
            rs.push(r[o]); gs.push(g[o]); bs.push(b[o]); as.push(a[o]);
          }
        }
        var d = (cy * nx + cx) * 4;
        if (!rs.length) { out[d + 3] = 0; continue; }
        rs.sort(function (p, q) { return p - q; });
        gs.sort(function (p, q) { return p - q; });
        bs.sort(function (p, q) { return p - q; });
        as.sort(function (p, q) { return p - q; });
        var m = Math.floor(rs.length / 2);
        out[d] = rs[m]; out[d + 1] = gs[m]; out[d + 2] = bs[m]; out[d + 3] = as.length >= (x1 - x0) * (y1 - y0) / 2 ? as[m] : Math.max(1, as[m]);
      }
    }
    return new ImageData(out, nx, ny);
  }

  function kmeans2Mean(samples) {
    // samples: [[r,g,b,a],...]，双聚类分簇，返回多数簇内的「众数色」
    // （像素图格内主色通常是某个精确色，众数比均值更准）
    if (samples.length < 2) return samples[0];
    var c0 = samples[0].slice(0, 3), c1 = samples[samples.length - 1].slice(0, 3);
    var lastN0 = 0, lastN1 = 0;
    for (var iter = 0; iter < 8; iter++) {
      var s0 = [0, 0, 0], s1 = [0, 0, 0], n0 = 0, n1 = 0;
      for (var i = 0; i < samples.length; i++) {
        var p = samples[i];
        var d0 = (p[0] - c0[0]) ** 2 + (p[1] - c0[1]) ** 2 + (p[2] - c0[2]) ** 2;
        var d1 = (p[0] - c1[0]) ** 2 + (p[1] - c1[1]) ** 2 + (p[2] - c1[2]) ** 2;
        if (d0 <= d1) { s0[0] += p[0]; s0[1] += p[1]; s0[2] += p[2]; n0++; }
        else { s1[0] += p[0]; s1[1] += p[1]; s1[2] += p[2]; n1++; }
      }
      if (n0) { c0 = [s0[0] / n0, s0[1] / n0, s0[2] / n0]; }
      if (n1) { c1 = [s1[0] / n1, s1[1] / n1, s1[2] / n1]; }
      lastN0 = n0; lastN1 = n1;
    }
    // 多数簇内取众数色
    var cluster = lastN0 >= lastN1 ? c0 : c1;
    var counts = new Map();
    for (var j = 0; j < samples.length; j++) {
      var q = samples[j];
      var dd = (q[0] - cluster[0]) ** 2 + (q[1] - cluster[1]) ** 2 + (q[2] - cluster[2]) ** 2;
      // 只统计属于多数簇的样本
      var other = lastN0 >= lastN1 ? c1 : c0;
      var dd2 = (q[0] - other[0]) ** 2 + (q[1] - other[1]) ** 2 + (q[2] - other[2]) ** 2;
      if (dd > dd2) continue;
      var k2 = q[0] + "," + q[1] + "," + q[2];
      counts.set(k2, (counts.get(k2) || 0) + 1);
    }
    var bestK = null, bestC = -1;
    counts.forEach(function (c, k) {
      if (c > bestC) { bestC = c; bestK = k; }
    });
    if (bestK) {
      var parts = bestK.split(",");
      return [Number(parts[0]), Number(parts[1]), Number(parts[2]), 255];
    }
    return [Math.round(cluster[0]), Math.round(cluster[1]), Math.round(cluster[2]), 255];
  }

  function sampleMajority(r, g, b, a, W, H, xc, yc) {
    var nx = xc.length - 1, ny = yc.length - 1;
    var out = new Uint8ClampedArray(nx * ny * 4);
    for (var cy = 0; cy < ny; cy++) {
      for (var cx = 0; cx < nx; cx++) {
        var x0 = Math.max(0, Math.floor(xc[cx])), x1 = Math.min(W, Math.ceil(xc[cx + 1]));
        var y0 = Math.max(0, Math.floor(yc[cy])), y1 = Math.min(H, Math.ceil(yc[cy + 1]));
        var samples = [], opaque = 0, total = 0;
        for (var py = y0; py < y1; py++) {
          for (var px = x0; px < x1; px++) {
            var o = py * W + px;
            total++;
            if (a[o] <= TRANSPARENT_ALPHA) continue;
            opaque++;
            samples.push([r[o], g[o], b[o], a[o]]);
          }
        }
        var d = (cy * nx + cx) * 4;
        if (!opaque || opaque < total / 2) { out[d + 3] = 0; continue; }
        // 下采样控制耗时
        if (samples.length > 128) {
          var step = samples.length / 128;
          var ds = [];
          for (var s = 0; s < 128; s++) ds.push(samples[Math.floor(s * step)]);
          samples = ds;
        }
        var m = kmeans2Mean(samples);
        out[d] = m[0]; out[d + 1] = m[1]; out[d + 2] = m[2]; out[d + 3] = m[3];
      }
    }
    return new ImageData(out, nx, ny);
  }

  function fixSquareOutput(im) {
    if (im.width - im.height === 1) {
      var c = document.createElement("canvas");
      c.width = im.height; c.height = im.height;
      c.getContext("2d").putImageData(im, 0, 0);
      return c.getContext("2d").getImageData(0, 0, im.height, im.height);
    }
    if (im.height - im.width === 1) {
      var c2 = document.createElement("canvas");
      c2.width = im.width; c2.height = im.width;
      c2.getContext("2d").putImageData(im, 0, 0);
      return c2.getContext("2d").getImageData(0, 0, im.width, im.width);
    }
    return im;
  }

  /**
   * getPerfectPixel(imageData, opts) → ImageData
   * opts: { sampleMethod: 'center'|'median'|'majority', gridSize: {cols,rows}|null,
   *         minSize: 4, peakWidth: 6, refineIntensity: 0.25, fixSquare: true }
   */
  function getPerfectPixel(imageData, opts) {
    opts = opts || {};
    var W = imageData.width, H = imageData.height;
    if (Math.max(W, H) > MAX_SIDE) throw new Error("图片过大（限 " + MAX_SIDE + "px）");
    var data = imageData.data;
    var n = W * H;
    var r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), a = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      r[i] = data[i * 4]; g[i] = data[i * 4 + 1]; b[i] = data[i * 4 + 2]; a[i] = data[i * 4 + 3];
    }
    var gray = rgbToGray(data, n);

    var minSize = opts.minSize || 4;
    var peakWidth = opts.peakWidth || 6;
    var refineIntensity = opts.refineIntensity === undefined ? 0.25 : opts.refineIntensity;
    var scale;
    if (opts.gridSize && opts.gridSize.cols > 0 && opts.gridSize.rows > 0) {
      scale = { gridW: opts.gridSize.cols, gridH: opts.gridSize.rows };
    } else {
      scale = detectGridScale(gray, W, H, peakWidth, 1.5, minSize);
    }
    if (!scale.gridW || !scale.gridH) {
      throw new Error("ERR_PERFECT_PIXEL_GRID");
    }
    var grids = refineGrids(gray, W, H, scale.gridW, scale.gridH, refineIntensity);

    var method = opts.sampleMethod || "center";
    var out;
    if (method === "median") out = sampleMedian(r, g, b, a, W, H, grids.xCoords, grids.yCoords);
    else if (method === "majority") out = sampleMajority(r, g, b, a, W, H, grids.xCoords, grids.yCoords);
    else out = sampleCenter(r, g, b, a, W, H, grids.xCoords, grids.yCoords);

    if (opts.fixSquare !== false) out = fixSquareOutput(out);
    return out;
  }

  window.FF = window.FF || {};
  FF.PerfectPixel = {
    getPerfectPixel: getPerfectPixel,
    _internals: {
      estimateGridFft: estimateGridFft,
      estimateGridGradient: estimateGridGradient,
      detectGridScale: detectGridScale,
      refineGrids: refineGrids,
      sampleMajority: sampleMajority,
      sampleMedian: sampleMedian,
      sampleCenter: sampleCenter
    }
  };
})();
