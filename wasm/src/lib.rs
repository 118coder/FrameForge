//! FrameForge 像素工具箱 —— WASM 核心
//!
//! 原生 extern "C" 导出（无 wasm-bindgen），内存协议：
//!   1. JS 调 ff_alloc(len) 取输入缓冲区指针，写入数据；
//!   2. 调用处理函数（多为就地处理，返回 0=成功 / 负数=错误码）；
//!   3. 需要返回数据的函数把结果写入"结果缓冲区"，
//!      JS 通过 ff_result_ptr / ff_result_len 读取后调 ff_result_clear 释放。
//! 所有函数均假定在单 Worker 线程内串行调用。

use gif::{Encoder, Frame, Repeat};
use std::vec::Vec;

// ---------------------------------------------------------------------------
// 内存管理
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_alloc(len: u32) -> *mut u8 {
    let layout = match std::alloc::Layout::from_size_align(len as usize, 16) {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };
    unsafe {
        if layout.size() == 0 {
            return layout.align() as *mut u8;
        }
        std::alloc::alloc(layout)
    }
}

/// # Safety
/// ptr 必须来自 ff_alloc 且 len 一致，且只能释放一次。
#[no_mangle]
pub unsafe extern "C" fn ff_free(ptr: *mut u8, len: u32) {
    if ptr.is_null() || len == 0 {
        return;
    }
    let layout = std::alloc::Layout::from_size_align(len as usize, 16).unwrap();
    std::alloc::dealloc(ptr, layout);
}

static mut RESULT: Vec<u8> = Vec::new();

fn result_store(v: Vec<u8>) {
    unsafe {
        let old = std::mem::replace(&mut *std::ptr::addr_of_mut!(RESULT), v);
        drop(old);
    }
}

#[no_mangle]
pub extern "C" fn ff_result_ptr() -> *mut u8 {
    unsafe { (*std::ptr::addr_of_mut!(RESULT)).as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn ff_result_len() -> u32 {
    unsafe { (*std::ptr::addr_of_mut!(RESULT)).len() as u32 }
}

#[no_mangle]
pub extern "C" fn ff_result_clear() {
    result_store(Vec::new());
}

fn input<'a>(ptr: *const u8, len: u32) -> &'a [u8] {
    unsafe { std::slice::from_raw_parts(ptr, len as usize) }
}

fn input_mut<'a>(ptr: *mut u8, len: u32) -> &'a mut [u8] {
    unsafe { std::slice::from_raw_parts_mut(ptr, len as usize) }
}

// ---------------------------------------------------------------------------
// 像素工具函数
// ---------------------------------------------------------------------------

#[inline]
fn dist(r1: u8, g1: u8, b1: u8, r2: u8, g2: u8, b2: u8) -> f32 {
    let dr = r1 as f32 - r2 as f32;
    let dg = g1 as f32 - g2 as f32;
    let db = b1 as f32 - b2 as f32;
    (dr * dr + dg * dg + db * db).sqrt()
}

// ---------------------------------------------------------------------------
// 色键去背
// mode: 0=绿幕 1=蓝幕 2=白底(边缘泛洪) 3=自定义色1 4=双重色键(c1+c2)
// tol/feather/suppress: 0..=100
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_chroma_key(
    ptr: *mut u8, w: u32, h: u32,
    mode: u32, tol: u32, feather: u32, suppress: u32,
    r1: u8, g1: u8, b1: u8, r2: u8, g2: u8, b2: u8,
) -> i32 {
    if w == 0 || h == 0 { return -1; }
    let n = (w * h * 4) as usize;
    let buf = input_mut(ptr, n as u32);
    let t = (tol as f32 / 100.0) * 180.0 + 8.0;          // 主容差
    let f = (feather as f32 / 100.0) * 120.0 + 1.0;       // 羽化带宽
    let sup = suppress as f32 / 100.0;

    match mode {
        0 | 1 => {
            // 绿/蓝幕：全局色度距离 + 抑色（把溢出的 g/b 压回 max(r,b)）
            let (kr, kg, kb) = if mode == 0 { (0u8, 255u8, 0u8) } else { (0u8, 0u8, 255u8) };
            for px in buf.chunks_exact_mut(4) {
                let (r, g, b, _) = (px[0], px[1], px[2], px[3]);
                let d = dist(r, g, b, kr, kg, kb);
                let a = ((d - t) / f).clamp(0.0, 1.0);
                if a < 1.0 {
                    let m = r.max(b) as f32; // 非主导通道上限，用于抑色
                    if mode == 0 && g as f32 > m {
                        let spill = ((g as f32 - m) * sup) as u8;
                        px[1] = g.saturating_sub(spill);
                    } else if mode == 1 && b as f32 > r.max(g) as f32 {
                        let spill = ((b as f32 - r.max(g) as f32) * sup) as u8;
                        px[2] = b.saturating_sub(spill);
                    }
                    px[3] = (a * 255.0) as u8;
                }
            }
        }
        2 => {
            // 白底：从四边泛洪，只抠外部连通的白色区域
            let (w32, h32) = (w as usize, h as usize);
            let mut removed = vec![false; w32 * h32];
            let mut stack: Vec<usize> = Vec::with_capacity(1024);
            for x in 0..w32 {
                stack.push(x);
                stack.push((h32 - 1) * w32 + x);
            }
            for y in 0..h32 {
                stack.push(y * w32);
                stack.push(y * w32 + w32 - 1);
            }
            while let Some(i) = stack.pop() {
                if removed[i] { continue; }
                let o = i * 4;
                if dist(buf[o], buf[o + 1], buf[o + 2], 255, 255, 255) > t { continue; }
                removed[i] = true;
                let x = i % w32;
                if x > 0 { stack.push(i - 1); }
                if x + 1 < w32 { stack.push(i + 1); }
                if i >= w32 { stack.push(i - w32); }
                if i + w32 < w32 * h32 { stack.push(i + w32); }
            }
            for (i, rm) in removed.iter().enumerate() {
                let o = i * 4;
                if *rm {
                    buf[o + 3] = 0;
                } else {
                    // 边缘羽化：靠近白色按比例降 alpha
                    let d = dist(buf[o], buf[o + 1], buf[o + 2], 255, 255, 255);
                    if d < t + f {
                        let a = ((d - t) / f).clamp(0.0, 1.0);
                        buf[o + 3] = (a * 255.0) as u8;
                    }
                }
            }
            let _ = sup;
        }
        3 | 4 => {
            let keys = if mode == 3 {
                vec![(r1, g1, b1)]
            } else {
                vec![(r1, g1, b1), (r2, g2, b2)]
            };
            for px in buf.chunks_exact_mut(4) {
                let (r, g, b) = (px[0], px[1], px[2]);
                let mut d = f32::MAX;
                for k in &keys {
                    d = d.min(dist(r, g, b, k.0, k.1, k.2));
                }
                let a = ((d - t) / f).clamp(0.0, 1.0);
                if a < 1.0 { px[3] = (a * 255.0) as u8; }
            }
        }
        5 => {
            // 左上角连通域：以左上角像素为键色从该点泛洪（AI 生成图的纯色背景）
            let (w32, h32) = (w as usize, h as usize);
            let key = (buf[0], buf[1], buf[2]);
            let mut removed = vec![false; w32 * h32];
            let mut stack: Vec<usize> = vec![0];
            while let Some(i) = stack.pop() {
                if removed[i] { continue; }
                let o = i * 4;
                if dist(buf[o], buf[o + 1], buf[o + 2], key.0, key.1, key.2) > t { continue; }
                removed[i] = true;
                let x = i % w32;
                if x > 0 { stack.push(i - 1); }
                if x + 1 < w32 { stack.push(i + 1); }
                if i >= w32 { stack.push(i - w32); }
                if i + w32 < w32 * h32 { stack.push(i + w32); }
            }
            for (i, rm) in removed.iter().enumerate() {
                let o = i * 4;
                if *rm {
                    buf[o + 3] = 0;
                } else {
                    // 羽化仅作用于与被移除区域相邻的像素：内部同色区（不连通）必须保留
                    let x = i % w32;
                    let y = i / w32;
                    let near = (x > 0 && removed[i - 1])
                        || (x + 1 < w32 && removed[i + 1])
                        || (y > 0 && removed[i - w32])
                        || (y + 1 < h32 && removed[i + w32]);
                    if near {
                        let d = dist(buf[o], buf[o + 1], buf[o + 2], key.0, key.1, key.2);
                        if d < t + f {
                            let a = ((d - t) / f).clamp(0.0, 1.0);
                            buf[o + 3] = (a * 255.0) as u8;
                        }
                    }
                }
            }
            let _ = sup;
        }
        _ => return -2,
    }
    0
}

// ---------------------------------------------------------------------------
// 像素块化
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_pixelate(ptr: *mut u8, w: u32, h: u32, block: u32) -> i32 {
    if w == 0 || h == 0 || block <= 1 { return if block == 0 { -1 } else { 0 }; }
    let block = block as usize;
    let (wu, hu) = (w as usize, h as usize);
    let buf = input_mut(ptr, (w * h * 4) as u32);
    let src = buf.to_vec();
    for by in 0..(hu + block - 1) / block {
        for bx in 0..(wu + block - 1) / block {
            let x0 = bx * block;
            let y0 = by * block;
            let x1 = (x0 + block).min(wu);
            let y1 = (y0 + block).min(hu);
            let mut sum = [0u64; 4];
            let mut cnt = 0u64;
            let mut alpha_sum = 0u64;
            for y in y0..y1 {
                for x in x0..x1 {
                    let o = (y * wu + x) * 4;
                    sum[0] += src[o] as u64;
                    sum[1] += src[o + 1] as u64;
                    sum[2] += src[o + 2] as u64;
                    sum[3] += src[o + 3] as u64;
                    if src[o + 3] >= 128 { alpha_sum += 1; }
                    cnt += 1;
                }
            }
            // 半透明块：alpha 平均值低于 0.5*count 时整块视为透明边缘
            let avg = |c: usize| (sum[c] / cnt) as u8;
            let opaque_ratio = alpha_sum as f32 / cnt as f32;
            let block_alpha = if opaque_ratio < 0.35 { (opaque_ratio * 255.0) as u8 } else { avg(3) };
            for y in y0..y1 {
                for x in x0..x1 {
                    let o = (y * wu + x) * 4;
                    buf[o] = avg(0);
                    buf[o + 1] = avg(1);
                    buf[o + 2] = avg(2);
                    buf[o + 3] = block_alpha;
                }
            }
        }
    }
    0
}

// ---------------------------------------------------------------------------
// 调色板量化
// palette: 1=PICO-8 2=NES 3=GameBoy 4=CGA 5=灰阶 6..8=自适应 16/32/64 色
// strength 0..=100（向调色板靠拢程度），dither: 0/1 Floyd-Steinberg
// ---------------------------------------------------------------------------

const PICO8: [[u8; 3]; 16] = [
    [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81], [171, 82, 54], [95, 87, 79],
    [194, 195, 199], [255, 241, 232], [255, 0, 77], [255, 163, 0], [255, 236, 39],
    [0, 228, 54], [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170],
];
const NES: [[u8; 3]; 54] = [
    [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136], [68, 0, 100], [92, 0, 48],
    [84, 4, 0], [60, 24, 0], [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0],
    [0, 50, 60], [0, 0, 0], [152, 150, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228],
    [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0], [84, 90, 0],
    [40, 114, 0], [8, 124, 0], [0, 118, 40], [0, 102, 120], [0, 0, 0],
    [236, 238, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236], [228, 84, 236],
    [236, 88, 180], [236, 106, 100], [212, 136, 32], [160, 170, 0], [116, 196, 0],
    [76, 208, 32], [56, 204, 108], [56, 180, 204], [60, 60, 60], [236, 238, 236],
    [168, 204, 236], [188, 188, 236], [212, 178, 236], [236, 174, 236], [236, 174, 212],
    [236, 180, 176], [228, 196, 144], [204, 210, 120], [180, 222, 120], [168, 226, 168],
    [152, 226, 196],
];
const GAMEBOY: [[u8; 3]; 4] = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
const CGA: [[u8; 3]; 16] = [
    [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170],
    [170, 85, 0], [170, 170, 170], [85, 85, 85], [85, 85, 255], [85, 255, 85],
    [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];
const GRAY8: [[u8; 3]; 8] = [
    [0, 0, 0], [36, 36, 36], [72, 72, 72], [109, 109, 109],
    [145, 145, 145], [182, 182, 182], [218, 218, 218], [255, 255, 255],
];

#[no_mangle]
pub extern "C" fn ff_quantize(
    ptr: *mut u8, w: u32, h: u32,
    palette: u32, strength: u32, dither: u32,
    color_space: u32, adaptive_k: u32,
) -> i32 {
    if w == 0 || h == 0 { return -1; }
    let n = (w * h * 4) as usize;
    let buf = input_mut(ptr, n as u32);
    let mix = strength as f32 / 100.0;

    // 目标调色板
    let pal: Vec<[u8; 3]> = match palette {
        1 => PICO8.to_vec(),
        2 => NES.to_vec(),
        3 => GAMEBOY.to_vec(),
        4 => CGA.to_vec(),
        5 => GRAY8.to_vec(),
        6 | 7 | 8 => {
            let k = match palette { 6 => 16, 7 => 32, _ => 64 };
            let mut rgba = buf.to_vec();
            let nq = color_quant::NeuQuant::new(10, k, &mut rgba);
            let map: Vec<u8> = nq.color_map_rgba();
            (0..k).map(|i| [map[i * 4], map[i * 4 + 1], map[i * 4 + 2]]).collect()
        }
        9 => {
            // 任意色数自适应（adaptive_k 2..=64）
            let k = adaptive_k.clamp(2, 64) as usize;
            let mut rgba = buf.to_vec();
            let nq = color_quant::NeuQuant::new(10, k, &mut rgba);
            let map: Vec<u8> = nq.color_map_rgba();
            (0..k).map(|i| [map[i * 4], map[i * 4 + 1], map[i * 4 + 2]]).collect()
        }
        _ => return -2,
    };
    let use_lab = color_space == 1;
    // LAB 距离：预计算调色板的 LAB 值
    let pal_lab: Vec<[f32; 3]> = if use_lab {
        pal.iter().map(|c| rgb_to_lab(c[0], c[1], c[2])).collect()
    } else {
        Vec::new()
    };
    let pick = |r: u8, g: u8, b: u8| -> [u8; 3] {
        if use_lab { nearest_lab(&pal, &pal_lab, r, g, b) } else { nearest(&pal, r, g, b) }
    };

    if dither == 0 {
        for px in buf.chunks_exact_mut(4) {
            let c = pick(px[0], px[1], px[2]);
            px[0] = lerp(px[0], c[0], mix);
            px[1] = lerp(px[1], c[1], mix);
            px[2] = lerp(px[2], c[2], mix);
        }
    } else {
        // Floyd-Steinberg：误差向右/下扩散，strength 作为目标混合系数
        let (wu, hu) = (w as usize, h as usize);
        let mut fbuf: Vec<f32> = buf.chunks_exact(4).flat_map(|p| [p[0] as f32, p[1] as f32, p[2] as f32]).collect();
            for y in 0..hu {
                for x in 0..wu {
                    let i = y * wu + x;
                    let (or, og, ob) = (fbuf[i * 3], fbuf[i * 3 + 1], fbuf[i * 3 + 2]);
                    let c = pick(or.clamp(0.0, 255.0) as u8, og.clamp(0.0, 255.0) as u8, ob.clamp(0.0, 255.0) as u8);
                let (nr, ng, nb) = (
                    or + (c[0] as f32 - or) * mix,
                    og + (c[1] as f32 - og) * mix,
                    ob + (c[2] as f32 - ob) * mix,
                );
                let (er, eg, eb) = (or - nr, og - ng, ob - nb);
                fbuf[i * 3] = nr;
                fbuf[i * 3 + 1] = ng;
                fbuf[i * 3 + 2] = nb;
                let mut push = |xx: usize, yy: usize, f: f32| {
                    if xx < wu && yy < hu {
                        let j = (yy * wu + xx) * 3;
                        fbuf[j] += er * f;
                        fbuf[j + 1] += eg * f;
                        fbuf[j + 2] += eb * f;
                    }
                };
                push(x + 1, y, 7.0 / 16.0);
                if x > 0 { push(x - 1, y + 1, 3.0 / 16.0); }
                push(x, y + 1, 5.0 / 16.0);
                push(x + 1, y + 1, 1.0 / 16.0);
            }
        }
        for (px, c3) in buf.chunks_exact_mut(4).zip(fbuf.chunks_exact(3)) {
            px[0] = c3[0].clamp(0.0, 255.0) as u8;
            px[1] = c3[1].clamp(0.0, 255.0) as u8;
            px[2] = c3[2].clamp(0.0, 255.0) as u8;
        }
    }
    0
}

#[inline]
fn nearest(pal: &[[u8; 3]], r: u8, g: u8, b: u8) -> [u8; 3] {
    let mut best = pal[0];
    let mut bd = f32::MAX;
    for c in pal {
        let d = (r as f32 - c[0] as f32).powi(2)
            + (g as f32 - c[1] as f32).powi(2)
            + (b as f32 - c[2] as f32).powi(2);
        if d < bd {
            bd = d;
            best = *c;
        }
    }
    best
}

// sRGB → CIELAB（D65），用于感知距离匹配
fn rgb_to_lab(r: u8, g: u8, b: u8) -> [f32; 3] {
    #[inline]
    fn lin(c: f32) -> f32 {
        let c = c / 255.0;
        if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
    }
    #[inline]
    fn f(t: f32) -> f32 {
        if t > 0.008856 { t.cbrt() } else { 7.787 * t + 16.0 / 116.0 }
    }
    let (r, g, b) = (lin(r as f32), lin(g as f32), lin(b as f32));
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    let (fx, fy, fz) = (f(x), f(y), f(z));
    [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]
}

#[inline]
fn nearest_lab(pal: &[[u8; 3]], pal_lab: &[[f32; 3]], r: u8, g: u8, b: u8) -> [u8; 3] {
    let l = rgb_to_lab(r, g, b);
    let mut best = 0usize;
    let mut bd = f32::MAX;
    for (i, c) in pal_lab.iter().enumerate() {
        let d = (l[0] - c[0]).powi(2) + (l[1] - c[1]).powi(2) + (l[2] - c[2]).powi(2);
        if d < bd {
            bd = d;
            best = i;
        }
    }
    pal[best]
}

#[inline]
fn lerp(a: u8, b: u8, t: f32) -> u8 {
    (a as f32 + (b as f32 - a as f32) * t) as u8
}

// ---------------------------------------------------------------------------
// 色彩调整 saturation 0..=200, contrast 0..=200, brightness -100..=100
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_adjust(ptr: *mut u8, w: u32, h: u32, sat: i32, con: i32, bri: i32) -> i32 {
    if w == 0 || h == 0 { return -1; }
    let buf = input_mut(ptr, (w * h * 4) as u32);
    let s = sat as f32 / 100.0;
    let c = con as f32 / 100.0;
    let br = bri as f32 * 2.55;
    for px in buf.chunks_exact_mut(4) {
        let (r, g, b) = (px[0] as f32, px[1] as f32, px[2] as f32);
        // 亮度
        let (mut r, mut g, mut b) = (r + br, g + br, b + br);
        // 对比度（围绕中灰）
        r = (r - 128.0) * c + 128.0;
        g = (g - 128.0) * c + 128.0;
        b = (b - 128.0) * c + 128.0;
        // 饱和度（向灰度插值）
        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
        r = luma + (r - luma) * s;
        g = luma + (g - luma) * s;
        b = luma + (b - luma) * s;
        px[0] = r.clamp(0.0, 255.0) as u8;
        px[1] = g.clamp(0.0, 255.0) as u8;
        px[2] = b.clamp(0.0, 255.0) as u8;
    }
    0
}

// ---------------------------------------------------------------------------
// 内描边：不透明像素中与透明相邻（切比雪夫半径 radius）的着色
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_outline(
    ptr: *mut u8, w: u32, h: u32, r: u8, g: u8, b: u8, radius: u32,
) -> i32 {
    if w == 0 || h == 0 || radius == 0 { return -1; }
    let (wu, hu) = (w as usize, h as usize);
    let buf = input_mut(ptr, (w * h * 4) as u32);
    let alpha = buf.chunks_exact(4).map(|p| p[3] >= 128).collect::<Vec<bool>>();
    let rad = radius as isize;
    let mut marks: Vec<usize> = Vec::new();
    for y in 0..hu {
        for x in 0..wu {
            let i = y * wu + x;
            if !alpha[i] { continue; }
            let mut edge = false;
            'outer: for dy in -rad..=rad {
                for dx in -rad..=rad {
                    if dx == 0 && dy == 0 { continue; }
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    if nx < 0 || ny < 0 || nx >= wu as isize || ny >= hu as isize {
                        continue;
                    }
                    if !alpha[ny as usize * wu + nx as usize] {
                        edge = true;
                        break 'outer;
                    }
                }
            }
            if edge { marks.push(i * 4); }
        }
    }
    for o in marks {
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
        buf[o + 3] = 255;
    }
    0
}

// ---------------------------------------------------------------------------
// 多帧序列化：[magic u32][count u32] 每帧 [w u32][h u32][delay_ms u32][len u32][data..]
// ---------------------------------------------------------------------------

const SEQ_MAGIC: u32 = 0x1FFC0001;

fn seq_pack(frames: &[(u32, u32, u32, Vec<u8>)]) -> Vec<u8> {
    let mut out = Vec::with_capacity(64 * 1024);
    out.extend_from_slice(&SEQ_MAGIC.to_le_bytes());
    out.extend_from_slice(&(frames.len() as u32).to_le_bytes());
    for (w, h, delay, data) in frames {
        out.extend_from_slice(&w.to_le_bytes());
        out.extend_from_slice(&h.to_le_bytes());
        out.extend_from_slice(&delay.to_le_bytes());
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(data);
    }
    out
}

// ---------------------------------------------------------------------------
// Sprite Sheet 合成：输入 [count u32][fw u32][fh u32][cols u32][rgba 帧...]
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_sheet_assemble(ptr: *const u8, len: u32) -> i32 {
    let data = input(ptr, len);
    if data.len() < 16 { return -1; }
    let count = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let fw = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    let fh = u32::from_le_bytes([data[8], data[9], data[10], data[11]]);
    let cols = u32::from_le_bytes([data[12], data[13], data[14], data[15]]).max(1) as usize;
    if fw == 0 || fh == 0 || count == 0 { return -1; }
    let fsize = (fw * fh * 4) as usize;
    if data.len() < 16 + fsize * count { return -1; }
    let rows = (count + cols - 1) / cols;
    let (wu, hu) = (fw as usize * cols, fh as usize * rows);
    let mut sheet = vec![0u8; wu * hu * 4];
    for (i, fr) in data[16..16 + fsize * count].chunks_exact(fsize).enumerate() {
        let cx = (i % cols) * fw as usize;
        let cy = (i / cols) * fh as usize;
        for y in 0..fh as usize {
            let so = y * fw as usize * 4;
            let doff = ((cy + y) * wu + cx) * 4;
            sheet[doff..doff + fw as usize * 4].copy_from_slice(&fr[so..so + fw as usize * 4]);
        }
    }
    result_store(sheet);
    0
}

// ---------------------------------------------------------------------------
// Sprite Sheet 拆分：输入 [w u32][h u32][cw u32][ch u32][skip_empty u32][rgba sheet]
// 输出序列化帧（delay=0）
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_sheet_split(ptr: *const u8, len: u32) -> i32 {
    let data = input(ptr, len);
    if data.len() < 20 { return -1; }
    let w = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let h = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
    let cw = u32::from_le_bytes([data[8], data[9], data[10], data[11]]) as usize;
    let ch = u32::from_le_bytes([data[12], data[13], data[14], data[15]]) as usize;
    let skip = u32::from_le_bytes([data[16], data[17], data[18], data[19]]) != 0;
    if w == 0 || h == 0 || cw == 0 || ch == 0 { return -1; }
    if data.len() < 20 + w * h * 4 { return -1; }
    let cols = w / cw;
    let rows = h / ch;
    if cols == 0 || rows == 0 { return -1; }
    let mut frames: Vec<(u32, u32, u32, Vec<u8>)> = Vec::new();
    for ry in 0..rows {
        for rx in 0..cols {
            let mut cell = vec![0u8; cw * ch * 4];
            for y in 0..ch {
                let so = ((ry * ch + y) * w + rx * cw) * 4;
                let doff = y * cw * 4;
                cell[doff..doff + cw * 4]
                    .copy_from_slice(&data[20 + so..20 + so + cw * 4]);
            }
            let empty = skip
                && cell.chunks_exact(4).all(|p| p[3] == 0);
            if !empty {
                frames.push((cw as u32, ch as u32, 0, cell));
            }
        }
    }
    result_store(seq_pack(&frames));
    0
}

// ---------------------------------------------------------------------------
// GIF 解码（含 dispose 合成，输出整幅画布帧）
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_gif_decode(ptr: *const u8, len: u32) -> i32 {
    let data = input(ptr, len);
    let mut opts = gif::DecodeOptions::new();
    opts.set_color_output(gif::ColorOutput::RGBA);
    let mut dec = match opts.read_info(std::io::Cursor::new(data)) {
        Ok(d) => d,
        Err(_) => return -3,
    };
    let (gw, gh) = (dec.width() as usize, dec.height() as usize);
    if gw == 0 || gh == 0 { return -1; }
    let mut canvas = vec![0u8; gw * gh * 4];
    let mut frames: Vec<(u32, u32, u32, Vec<u8>)> = Vec::new();
    loop {
        let frame = match dec.read_next_frame() {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(_) => break,
        };
        // 先快照（dispose Previous 用）
        let snapshot = canvas.clone();
        let (fx, fy) = (frame.left as usize, frame.top as usize);
        let (fw, fh) = (frame.width as usize, frame.height as usize);
        for y in 0..fh {
            if fy + y >= gh { break; }
            for x in 0..fw {
                if fx + x >= gw { break; }
                let so = (y * fw + x) * 4;
                let doff = ((fy + y) * gw + fx + x) * 4;
                canvas[doff..doff + 4].copy_from_slice(&frame.buffer[so..so + 4]);
            }
        }
        let delay = frame.delay as u32 * 10; // 0.01s 单位 → ms
        frames.push((gw as u32, gh as u32, delay.max(20), canvas.clone()));
        // dispose 处理
        let dispose = frame.dispose;
        match dispose {
            gif::DisposalMethod::Background => {
                for y in 0..fh {
                    for x in 0..fw {
                        let doff = ((fy + y) * gw + fx + x) * 4;
                        canvas[doff + 3] = 0;
                    }
                }
            }
            gif::DisposalMethod::Previous => {
                canvas = snapshot;
            }
            _ => {}
        }
    }
    if frames.is_empty() { return -3; }
    result_store(seq_pack(&frames));
    0
}

// ---------------------------------------------------------------------------
// GIF 编码
// 输入：[count u32][w u32][h u32][bg_r u8][bg_g u8][bg_b u8][speed u8][repeat u32]
//       [default_delay u32][每帧延时 u32 × count][帧 rgba...]
// 每帧透明部分平铺到 bg 色上（GIF 导出不含 alpha）
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_gif_encode(ptr: *const u8, len: u32) -> i32 {
    let data = input(ptr, len);
    if data.len() < 24 { return -1; }
    let count = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let w = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as u16;
    let h = u32::from_le_bytes([data[8], data[9], data[10], data[11]]) as u16;
    let (bg_r, bg_g, bg_b) = (data[12], data[13], data[14]);
    let speed = (data[15] as i32).clamp(1, 30);
    let repeat = u32::from_le_bytes([data[16], data[17], data[18], data[19]]);
    let default_delay = u32::from_le_bytes([data[20], data[21], data[22], data[23]]);
    if count == 0 || w == 0 || h == 0 { return -1; }
    let table_off = 24;
    let frames_off = table_off + count * 4;
    let fsize = w as usize * h as usize * 4;
    if data.len() < frames_off + fsize * count { return -1; }

    let mut out: Vec<u8> = Vec::new();
    {
        let mut enc = match Encoder::new(&mut out, w, h, &[]) {
            Ok(e) => e,
            Err(_) => return -4,
        };
        if repeat > 0 {
            let _ = enc.set_repeat(if repeat == 1 { Repeat::Infinite } else { Repeat::Finite((repeat - 1) as u16) });
        }
        for (i, fr) in data[frames_off..frames_off + fsize * count].chunks_exact(fsize).enumerate() {
            // 平铺背景色
            let mut rgba = fr.to_vec();
            for px in rgba.chunks_exact_mut(4) {
                let a = px[3] as u32;
                if a < 255 {
                    px[0] = ((px[0] as u32 * a + bg_r as u32 * (255 - a)) / 255) as u8;
                    px[1] = ((px[1] as u32 * a + bg_g as u32 * (255 - a)) / 255) as u8;
                    px[2] = ((px[2] as u32 * a + bg_b as u32 * (255 - a)) / 255) as u8;
                    px[3] = 255;
                }
            }
            let to = table_off + i * 4;
            let d = u32::from_le_bytes([data[to], data[to + 1], data[to + 2], data[to + 3]]);
            let delay = if d > 0 { d } else { default_delay.max(20) };
            let mut frame = Frame::from_rgba_speed(w, h, &mut rgba, speed);
            frame.delay = (delay / 10).max(2) as u16;
            if enc.write_frame(&frame).is_err() { return -4; }
        }
    }
    result_store(out);
    0
}

// ---------------------------------------------------------------------------
// 双背景差分抠图（V5）：同一主体的黑底图 + 白底图 → 逐像素求解 alpha
// diff = ((rw-rb)+(gw-gb)+(bw-bb))/3；alpha = clamp(255 - diff*tolScale)
// 之后 gamma 曲线调边缘、阈值清底、去小连通域、可选逐层削边
// tolerance/edge_contrast/erode 均为 0..=100；结果写入 black 缓冲区
// ---------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn ff_double_bg(
    ptr_black: *mut u8, ptr_white: *const u8, w: u32, h: u32,
    tolerance: u32, edge_contrast: u32, erode: u32,
) -> i32 {
    if w == 0 || h == 0 { return -1; }
    let n = (w * h * 4) as usize;
    let blk = input_mut(ptr_black, n as u32);
    let wht = input(ptr_white, n as u32);
    let tol_scale = 0.5 + tolerance as f32 / 100.0;
    let gamma = 0.5 + edge_contrast as f32 / 100.0;

    // 1) 逐像素求 alpha 并 un-premultiply 恢复前景色
    for i in 0..(w * h) as usize {
        let o = i * 4;
        let (rb, gb, bb) = (blk[o] as f32, blk[o + 1] as f32, blk[o + 2] as f32);
        let (rw, gw, bw) = (wht[o] as f32, wht[o + 1] as f32, wht[o + 2] as f32);
        let diff = ((rw - rb) + (gw - gb) + (bw - bb)) / 3.0;
        let mut alpha = (255.0 - diff * tol_scale).clamp(0.0, 255.0);
        alpha = 255.0 * (alpha / 255.0).powf(gamma);
        let a = alpha.round() as u32;
        if a > 0 {
            blk[o] = ((rb * 255.0) / a as f32).round().clamp(0.0, 255.0) as u8;
            blk[o + 1] = ((gb * 255.0) / a as f32).round().clamp(0.0, 255.0) as u8;
            blk[o + 2] = ((bb * 255.0) / a as f32).round().clamp(0.0, 255.0) as u8;
            blk[o + 3] = a as u8;
        } else {
            blk[o] = 0; blk[o + 1] = 0; blk[o + 2] = 0; blk[o + 3] = 0;
        }
    }

    // 2) 低 alpha 置零
    for px in blk.chunks_exact_mut(4) {
        if px[3] < 51 { px[3] = 0; }
    }

    // 3) 去小连通域（8 连通，min area 16）
    let (wu, hu) = (w as usize, h as usize);
    let total = wu * hu;
    let mut label = vec![0u32; total];
    let mut areas: Vec<u32> = vec![0];
    for i in 0..total {
        if blk[i * 4 + 3] == 0 || label[i] != 0 { continue; }
        let id = areas.len() as u32;
        let mut stack = vec![i];
        label[i] = id;
        let mut area = 0u32;
        while let Some(j) = stack.pop() {
            area += 1;
            let x = j % wu;
            let y = j / wu;
            for dy in -1isize..=1 {
                for dx in -1isize..=1 {
                    if dx == 0 && dy == 0 { continue; }
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    if nx < 0 || ny < 0 || nx >= wu as isize || ny >= hu as isize { continue; }
                    let k = ny as usize * wu + nx as usize;
                    if blk[k * 4 + 3] != 0 && label[k] == 0 {
                        label[k] = id;
                        stack.push(k);
                    }
                }
            }
        }
        areas.push(area);
    }
    for i in 0..total {
        if label[i] != 0 && areas[label[i] as usize] < 16 {
            blk[i * 4 + 3] = 0;
        }
    }

    // 4) 边缘逐层削边（frontier shave 22/层）
    let passes = (erode as usize * 56) / 100;
    for _ in 0..passes {
        let alpha_snap: Vec<u8> = (0..total).map(|i| blk[i * 4 + 3]).collect();
        let mut changed = false;
        for y in 0..hu {
            for x in 0..wu {
                let i = y * wu + x;
                let a = alpha_snap[i];
                if a == 0 { continue; }
                let mut frontier = x == 0 || y == 0 || x + 1 == wu || y + 1 == hu;
                if !frontier {
                    if (x > 0 && alpha_snap[i - 1] <= 10)
                        || (x + 1 < wu && alpha_snap[i + 1] <= 10)
                        || (y > 0 && alpha_snap[i - wu] <= 10)
                        || (y + 1 < hu && alpha_snap[i + wu] <= 10)
                    {
                        frontier = true;
                    }
                }
                if frontier {
                    let na = a.saturating_sub(22);
                    blk[i * 4 + 3] = na;
                    // RGB 同比例收缩避免光晕
                    if na == 0 {
                        blk[i * 4] = 0; blk[i * 4 + 1] = 0; blk[i * 4 + 2] = 0;
                    }
                    changed = true;
                }
            }
        }
        if !changed { break; }
    }
    0
}
