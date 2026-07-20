/**
 * generate-assets.js — «Unblock» (Freecash B4C4) placeholder PNG generator.
 *
 * Procedurally draws all board-kit / UI-kit placeholder sprites listed in
 * .playbox/game-design/ASSET_SPEC.md, rasterizing hand-built SVG shapes via `sharp`.
 * No external image generator is used — every asset is drawn programmatically
 * (paths/rects/gradients), including the "FC" coin glyph, which is built out of
 * primitive shapes rather than a system font (Freecash compliance: no $/currency/
 * banknote/card imagery anywhere).
 *
 * `sharp` is NOT a project dependency (see CLAUDE.md / cocos-asset-maker.md —
 * do not touch package.json). It is resolved from an existing global npm install
 * by absolute path. If that's ever unavailable, fall back to installing into a
 * throwaway folder OUTSIDE the project (./.playbox/.assettmp) and clean it up.
 *
 * Run: node tools/generate-assets.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPRITES_DIR = path.join(PROJECT_ROOT, 'assets/art/sprites');
const UI_DIR = path.join(PROJECT_ROOT, 'assets/art/ui');

// ---------------------------------------------------------------------------
// Resolve `sharp` without adding it to this project's package.json.
// ---------------------------------------------------------------------------
function resolveSharp() {
  // 1) Already available to this project (node_modules)?
  try {
    return require('sharp');
  } catch (_) {
    /* fall through */
  }

  // 2) Available globally? Load by absolute path so we never touch package.json.
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const candidates = fs
      .readdirSync(globalRoot)
      .flatMap((entry) => {
        // handle scoped packages (@scope/pkg) that bundle their own sharp
        const full = path.join(globalRoot, entry);
        if (entry.startsWith('@')) {
          try {
            return fs.readdirSync(full).map((sub) => path.join(full, sub, 'node_modules', 'sharp'));
          } catch (_) {
            return [];
          }
        }
        return [path.join(full, 'node_modules', 'sharp'), path.join(globalRoot, 'sharp')];
      });
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return require(candidate);
      }
    }
  } catch (_) {
    /* fall through */
  }

  // 3) Nowhere to be found — install into a temp folder OUTSIDE node_modules of
  //    the project, require by absolute path, and let caller clean it up.
  const tmpDir = path.join(PROJECT_ROOT, '.playbox', '.assettmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  execSync('npm install --prefix . sharp', { cwd: tmpDir, stdio: 'inherit' });
  return require(path.join(tmpDir, 'node_modules', 'sharp'));
}

const sharp = resolveSharp();

// ---------------------------------------------------------------------------
// Shared drawing helpers
// ---------------------------------------------------------------------------

/** Rounded-rect path string for an SVG <path>. */
function roundRectPath(x, y, w, h, r) {
  return `M ${x + r},${y}
    H ${x + w - r}
    A ${r},${r} 0 0 1 ${x + w},${y + r}
    V ${y + h - r}
    A ${r},${r} 0 0 1 ${x + w - r},${y + h}
    H ${x + r}
    A ${r},${r} 0 0 1 ${x},${y + h - r}
    V ${y + r}
    A ${r},${r} 0 0 1 ${x + r},${y}
    Z`;
}

const OUTLINE = 'rgba(59,36,18,0.6)'; // dark brown, ~60% alpha, per style rules
const HIGHLIGHT_TOP_OPACITY = 0.25;

async function renderSvg(svg, width, height, { opaque = false, bg = '#000000' } = {}) {
  let img = sharp(Buffer.from(svg)).resize(width, height);
  if (opaque) {
    img = img.flatten({ background: bg }).removeAlpha();
  }
  return img.png({ compressionLevel: 9 }).toBuffer();
}

async function writePng(buf, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  const meta = await sharp(buf).metadata();
  return { path: outPath, width: meta.width, height: meta.height, bytes: buf.length, hasAlpha: meta.hasAlpha };
}

/** Horizontal wood-plank grain lines used by block_tile/block_main. */
function woodGrainLines(w, h, count, lightColor, darkColor) {
  const lines = [];
  for (let i = 1; i < count; i++) {
    const yy = (h / count) * i;
    const opacity = i % 2 === 0 ? 0.10 : 0.06;
    const color = i % 2 === 0 ? darkColor : lightColor;
    lines.push(`<line x1="0" y1="${yy.toFixed(1)}" x2="${w}" y2="${yy.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="${opacity}" />`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Board kit
// ---------------------------------------------------------------------------

/** block_tile.png / block_main.png share the same construction, only fill differs. */
function blockSvg(size, fill) {
  const r = Math.round(size * 0.16); // 10-20% of smaller side
  const clipId = 'clip';
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="${clipId}">
      <path d="${roundRectPath(1.5, 1.5, size - 3, size - 3, r)}" />
    </clipPath>
    <linearGradient id="topHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${HIGHLIGHT_TOP_OPACITY}" />
      <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
  </defs>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="${size}" height="${size}" fill="${fill}" />
    ${woodGrainLines(size, size, 6, 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.5)')}
    <rect x="0" y="0" width="${size}" height="${size}" fill="url(#topHi)" />
  </g>
  <path d="${roundRectPath(1.5, 1.5, size - 3, size - 3, r)}" fill="none" stroke="${OUTLINE}" stroke-width="3" />
</svg>`;
}

async function drawBlockTile() {
  const svg = blockSvg(96, '#E0982E');
  const buf = await renderSvg(svg, 96, 96, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'block_tile.png'));
}

async function drawBlockMain() {
  const svg = blockSvg(96, '#E24A3B');
  const buf = await renderSvg(svg, 96, 96, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'block_main.png'));
}

async function drawCell() {
  const size = 96;
  const r = Math.round(size * 0.16);
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip"><path d="${roundRectPath(1.5, 1.5, size - 3, size - 3, r)}" /></clipPath>
    <radialGradient id="recess" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#5A4128" />
      <stop offset="70%" stop-color="#6E5138" />
      <stop offset="100%" stop-color="#7A5D42" />
    </radialGradient>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="${size}" height="${size}" fill="url(#recess)" />
  </g>
  <path d="${roundRectPath(1.5, 1.5, size - 3, size - 3, r)}" fill="none" stroke="${OUTLINE}" stroke-width="2.5" />
  <path d="${roundRectPath(10, 10, size - 20, size - 20, r * 0.6)}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2" />
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'cell.png'));
}

async function drawBoardFrame() {
  const size = 512;
  const border = 48;
  const rOuter = Math.round(size * 0.09);
  const rInner = Math.round(rOuter * 0.6);
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28" />
      <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
    <mask id="ringMask">
      <path d="${roundRectPath(2, 2, size - 4, size - 4, rOuter)} ${roundRectPath(border, border, size - border * 2, size - border * 2, rInner)}" fill="white" fill-rule="evenodd" />
    </mask>
  </defs>
  <g mask="url(#ringMask)">
    <rect x="0" y="0" width="${size}" height="${size}" fill="#C9A063" />
    ${woodGrainLines(size, size, 10, 'rgba(255,255,255,0.4)', 'rgba(0,0,0,0.35)')}
    <rect x="0" y="0" width="${size}" height="${size}" fill="url(#topHi)" />
  </g>
  <path d="${roundRectPath(2, 2, size - 4, size - 4, rOuter)}" fill="none" stroke="${OUTLINE}" stroke-width="4" />
  <path d="${roundRectPath(border, border, size - border * 2, size - border * 2, rInner)}" fill="none" stroke="rgba(59,36,18,0.75)" stroke-width="5" />
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'board_frame.png'));
}

async function drawBackground() {
  const w = 720;
  const h = 1280;
  // Sparse leaf/flower accents confined to outer corners, low opacity, simple shapes.
  const leaf = (cx, cy, rot, scale, opacity) => `
    <g transform="translate(${cx},${cy}) rotate(${rot}) scale(${scale})" opacity="${opacity}">
      <ellipse cx="0" cy="0" rx="26" ry="12" fill="#BFA45C" />
      <ellipse cx="34" cy="-6" rx="20" ry="9" fill="#C7AE68" />
    </g>`;
  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="centerLight" cx="50%" cy="42%" r="45%">
      <stop offset="0%" stop-color="#F5E7C4" />
      <stop offset="60%" stop-color="#E8D5A8" />
      <stop offset="100%" stop-color="#D9BE86" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#centerLight)" />
  ${leaf(70, 90, -20, 1.0, 0.35)}
  ${leaf(650, 70, 35, 0.9, 0.3)}
  ${leaf(60, 1190, 15, 1.0, 0.3)}
  ${leaf(660, 1210, -30, 0.9, 0.32)}
  ${leaf(40, 640, 90, 0.7, 0.2)}
  ${leaf(680, 640, -90, 0.7, 0.2)}
</svg>`;
  const buf = await renderSvg(svg, w, h, { opaque: true, bg: '#E8D5A8' });
  return writePng(buf, path.join(SPRITES_DIR, 'background.png'));
}

async function drawExitArrow() {
  const size = 96;
  const fill = '#AEDC4B';
  const chevron = (offsetX) => `
    <path d="M ${offsetX},18 L ${offsetX + 26},48 L ${offsetX},78" fill="none" stroke="${fill}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M ${offsetX},18 L ${offsetX + 26},48 L ${offsetX},78" fill="none" stroke="${OUTLINE}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" style="mix-blend-mode:multiply" />`;
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <g>
    <path d="M 16,18 L 42,48 L 16,78" fill="none" stroke="${OUTLINE}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 40,18 L 66,48 L 40,78" fill="none" stroke="${OUTLINE}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 16,18 L 42,48 L 16,78" fill="none" stroke="${fill}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 40,18 L 66,48 L 40,78" fill="none" stroke="${fill}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 16,18 L 42,48 L 16,78" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.35" transform="translate(0,-4)" />
    <path d="M 40,18 L 66,48 L 40,78" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.35" transform="translate(0,-4)" />
  </g>
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'exit_arrow.png'));
}

async function drawSpark() {
  const size = 128;
  const c = size / 2;
  const points = 8;
  const outerR = size * 0.48;
  const innerR = outerR * 0.38;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const ang = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = c + Math.cos(ang) * r;
    const y = c + Math.sin(ang) * r;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)} `;
  }
  d += 'Z';
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="burst" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1" />
      <stop offset="35%" stop-color="#FFD54A" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#FFD54A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <path d="${d}" fill="url(#burst)" />
  <circle cx="${c}" cy="${c}" r="${outerR * 0.22}" fill="#FFFFFF" opacity="0.9" />
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(SPRITES_DIR, 'spark.png'));
}

// ---------------------------------------------------------------------------
// UI kit
// ---------------------------------------------------------------------------

/** "FC" glyph built from primitive shapes (not a system font) for coin_fc.png. */
function fcGlyph(cx, cy, scale, color) {
  // Local coordinate system centered at (0,0), scaled, then translated to (cx,cy).
  // F: vertical bar + top bar + middle bar (block-letter, blocky/hand-drawn feel).
  // C: ring with a gap, drawn as a path arc with rounded caps.
  return `
  <g transform="translate(${cx},${cy}) scale(${scale})">
    <!-- F -->
    <g fill="${color}">
      <rect x="-14" y="-11" width="5" height="22" rx="1.6" />
      <rect x="-14" y="-11" width="12" height="5" rx="1.6" />
      <rect x="-14" y="-2" width="10" height="5" rx="1.6" />
    </g>
    <!-- C -->
    <path d="M 13.5,-8.5
             A 9,9 0 1 0 13.5,8.5"
          fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" />
  </g>`;
}

async function drawCoinFc() {
  const size = 80;
  const c = size / 2;
  const r = size * 0.46;
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gold" cx="42%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#FFE58A" />
      <stop offset="45%" stop-color="#FFD54A" />
      <stop offset="100%" stop-color="#C8901E" />
    </radialGradient>
  </defs>
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#gold)" stroke="${OUTLINE}" stroke-width="3" />
  <circle cx="${c}" cy="${c}" r="${r - 6}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
  <ellipse cx="${c - r * 0.32}" cy="${c - r * 0.4}" rx="${r * 0.4}" ry="${r * 0.22}" fill="#FFFFFF" opacity="0.25" />
  ${fcGlyph(c, c + 1, 1.05, '#5C3A21')}
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(UI_DIR, 'coin_fc.png'));
}

async function drawPanel() {
  const w = 320;
  const h = 200;
  const r = Math.round(Math.min(w, h) * 0.14);
  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.3" />
      <stop offset="35%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
    <clipPath id="clip"><path d="${roundRectPath(2, 2, w - 4, h - 4, r)}" /></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#F3E4C6" />
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#topHi)" />
  </g>
  <path d="${roundRectPath(2, 2, w - 4, h - 4, r)}" fill="none" stroke="${OUTLINE}" stroke-width="4" />
</svg>`;
  const buf = await renderSvg(svg, w, h, { opaque: false });
  return writePng(buf, path.join(UI_DIR, 'panel.png'));
}

async function drawButtonPlay() {
  const w = 320;
  const h = 96;
  const r = Math.round(Math.min(w, h) * 0.18);
  const lipH = Math.round(h * 0.22);
  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip"><path d="${roundRectPath(2, 2, w - 4, h - 4, r)}" /></clipPath>
    <linearGradient id="topHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#34C759" />
    <rect x="0" y="${h - lipH}" width="${w}" height="${lipH}" fill="#1F8F3C" />
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#topHi)" />
  </g>
  <path d="${roundRectPath(2, 2, w - 4, h - 4, r)}" fill="none" stroke="rgba(20,60,20,0.55)" stroke-width="4" />
</svg>`;
  const buf = await renderSvg(svg, w, h, { opaque: false });
  return writePng(buf, path.join(UI_DIR, 'button_play.png'));
}

async function drawFinger() {
  const w = 80;
  const h = 120;
  const skin = '#F5D0A9';
  // Simplified pointing index finger: knuckle/palm blob + finger capsule, angled.
  const svg = `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hi" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.3" />
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
  </defs>
  <g transform="rotate(8 40 60)" opacity="0.9">
    <!-- palm/knuckle -->
    <path d="M 24,58
             C 20,80 26,100 42,108
             C 58,114 68,102 66,86
             C 65,76 60,70 60,70
             L 60,50
             C 60,44 55,40 50,40
             C 45,40 42,44 42,50
             L 42,58
             Z"
          fill="${skin}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round" />
    <!-- index finger -->
    <path d="M 38,14
             C 38,8 43,4 48,4
             C 53,4 58,8 58,14
             L 58,54
             L 38,54
             Z"
          fill="${skin}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M 38,14 C 38,8 43,4 48,4 C 53,4 58,8 58,14 L 58,54 L 38,54 Z" fill="url(#hi)" />
    <!-- knuckle crease lines -->
    <line x1="40" y1="26" x2="56" y2="26" stroke="rgba(0,0,0,0.15)" stroke-width="2" />
    <line x1="40" y1="38" x2="56" y2="38" stroke="rgba(0,0,0,0.15)" stroke-width="2" />
  </g>
</svg>`;
  const buf = await renderSvg(svg, w, h, { opaque: false });
  return writePng(buf, path.join(UI_DIR, 'finger.png'));
}

/** Five-point star path, shared silhouette for star_on / star_off. */
function starPath(cx, cy, outerR, innerR) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)} `;
  }
  return d + 'Z';
}

async function drawStar(filled) {
  const size = 48;
  const c = size / 2;
  const outerR = size * 0.46;
  const innerR = outerR * 0.42;
  const fill = filled ? '#FFC107' : '#C9C2B4';
  const d = starPath(c, c, outerR, innerR);
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <path d="${d}" fill="${fill}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round" />
  ${filled ? `<ellipse cx="${c - 3}" cy="${c - 6}" rx="6" ry="3" fill="#FFFFFF" opacity="0.35" />` : ''}
</svg>`;
  const buf = await renderSvg(svg, size, size, { opaque: false });
  return writePng(buf, path.join(UI_DIR, filled ? 'star_on.png' : 'star_off.png'));
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

async function batchA() {
  return Promise.all([drawBlockTile(), drawBlockMain(), drawCell(), drawBoardFrame()]);
}

async function batchB() {
  return Promise.all([
    drawPanel(),
    drawButtonPlay(),
    drawCoinFc(),
    drawExitArrow(),
    drawFinger(),
    drawStar(true),
    drawStar(false),
    drawSpark(),
  ]);
}

async function batchC() {
  return Promise.all([drawBackground()]);
}

async function main() {
  const results = { A: await batchA(), B: await batchB(), C: await batchC() };
  const all = [...results.A, ...results.B, ...results.C];
  console.log('\nGenerated assets:');
  for (const r of all) {
    console.log(`  ${path.relative(PROJECT_ROOT, r.path)} — ${r.width}x${r.height} — ${(r.bytes / 1024).toFixed(1)} KB — alpha:${r.hasAlpha}`);
  }
  const totalKb = all.reduce((sum, r) => sum + r.bytes, 0) / 1024;
  console.log(`\nTotal: ${totalKb.toFixed(1)} KB across ${all.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
