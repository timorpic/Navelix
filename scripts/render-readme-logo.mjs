/**
 * Animate the existing SVG logos without changing their source files.
 * Optional asset tools are installed separately; see docs/DEVELOPMENT.md.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = process.env.NAVELIX_LOGO_TOOLS;
if (!toolsDir) {
  throw new Error("Set NAVELIX_LOGO_TOOLS to the isolated logo tool directory; see docs/DEVELOPMENT.md");
}
const requireTool = createRequire(path.resolve(toolsDir, "package.json"));
const sharp = requireTool("sharp");
const opentype = requireTool("opentype.js");
const { GIFEncoder, quantize, applyPalette } = requireTool("gifenc");
const fontPath = (weight) => requireTool.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`);
function loadFont(weight) {
  const bytes = fs.readFileSync(fontPath(weight));
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const titleFont = loadFont(800);
const subtitleFont = loadFont(600);
const frameCount = 40;
const delay = 100;
const width = 1040;

// Outlining the SVG text makes rendering independent of host-installed fonts.
function outlinedText(text, font, x, y, size, tracking, fill, maxWidth = Infinity) {
  const startX = x;
  const scale = size / font.unitsPerEm;
  const glyphs = [...text].map((character) => font.charToGlyph(character));
  const paths = glyphs.map((glyph, index) => {
    const outline = glyph.getPath(x, y, size);
    x += (glyph.advanceWidth + (index + 1 < glyphs.length ? font.getKerningValue(glyph, glyphs[index + 1]) : 0)) * scale + tracking;
    return `<path d="${outline.toPathData(3)}" fill="${fill}"/>`;
  }).join("");
  const fit = Math.min(1, maxWidth / (x - startX - tracking));
  return `<g transform="translate(${startX} ${y}) scale(${fit} 1) translate(${-startX} ${-y})">${paths}</g>`;
}

function outlineLabels(svg) {
  const [viewX, , viewWidth] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (_, attrs, body) => {
    const attr = (name) => attrs.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
    const y = Number(attr("y"));
    const size = Number(attr("font-size"));
    const tracking = Number(attr("letter-spacing") || 0);
    if (body.includes("<tspan")) {
      const wordmark = [...body.matchAll(/<tspan\b[^>]*x="([^"]+)"[^>]*fill="([^"]+)"[^>]*>([^<]+)<\/tspan>/g)]
        .map(([, x, fill, text]) => outlinedText(text, titleFont, Number(x), y, size, tracking, fill))
        .join("");
      return `<g id="readme-wordmark">${wordmark}</g>`;
    }
    const x = Number(attr("x"));
    return outlinedText(body.trim(), subtitleFont, x, y, size, tracking, attr("fill"), viewX + viewWidth - 16 - x);
  });
}

function animate(svg, dark, phase, frame) {
  svg = svg.replace(/<circle\b[^>]*id="svg_6"[^>]*\/>/,
    (tag) => tag.replace(/fill="[^"]+"/, 'fill="#B8860B"'));
  // Hold the readable front, turn around the vertical axis, then hold again.
  const turn = Math.max(0, Math.min(1, (frame - 8) / 24));
  const flip = Math.cos(turn * Math.PI * 2);
  const wordmarkTransform = `translate(427 0) scale(${flip} 1) translate(-427 0)`;
  svg = svg.replace('id="readme-wordmark"', `id="readme-wordmark" transform="${wordmarkTransform}"`);
  const accentId = dark ? "svg_13" : "svg_11";
  svg = svg.replace(new RegExp(`<path\\b[^>]*id="${accentId}"[^>]*/>`),
    (tag) => tag.replace("/>", ` transform="${wordmarkTransform}"/>`));
  const cx = dark ? 128 : 111.98305;
  const cy = dark ? 128 : 79.8918;
  const pulse = 1 + 0.012 * Math.sin(phase);
  svg = svg.replace(/<path\b[^>]*id="svg_2"[^>]*\/>/, (tag) => tag.replace("/>",
    ` transform="translate(${cx} ${cy}) scale(${pulse}) translate(${-cx} ${-cy})"/>`));
  const rotation = -24 * Math.PI / 180;
  for (const [id, offset, radius] of [["svg_4", 0, 5], ["svg_5", Math.PI, 4]]) {
    const theta = phase + offset;
    const x = 105 * Math.cos(theta);
    const y = 45 * Math.sin(theta);
    const px = cx + x * Math.cos(rotation) - y * Math.sin(rotation);
    const py = cy + x * Math.sin(rotation) + y * Math.cos(rotation);
    const dot = `<circle cx="${px}" cy="${py}" r="${radius * 2}" fill="#FFFFFF" opacity="0.5" filter="url(#${dark ? "glow-dark" : "glow"})"/>`
      + `<circle cx="${px}" cy="${py}" r="${radius}" fill="#FFFFFF"/>`;
    svg = svg.replace(new RegExp(`<circle\\b[^>]*id="${id}"[^>]*/>`), dot);
  }
  return svg;
}

for (const dark of [false, true]) {
  const stem = dark ? "navelix-logo-dark" : "navelix-logo";
  const source = outlineLabels(fs.readFileSync(path.join(root, "public", `${stem}.svg`), "utf8"));
  const frames = [];
  // GIF has one-bit transparency: matte only the antialiased edge pixels to
  // GitHub's corresponding theme background, keeping the canvas transparent.
  const matte = dark ? [13, 17, 23] : [255, 255, 255];
  let height;
  for (let frame = 0; frame < frameCount; frame++) {
    const svg = animate(source, dark, frame / frameCount * Math.PI * 2, frame);
    const { data, info } = await sharp(Buffer.from(svg)).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    height = info.height;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * alpha + matte[c] * (1 - alpha));
    }
    frames.push(data);
  }
  const palette = [[0, 0, 0], ...quantize(Buffer.concat([frames[0], frames[10], frames[20], frames[30]]), 255)];
  const gif = GIFEncoder();
  let firstIndexed;
  frames.forEach((rgba, frame) => {
    const indexed = applyPalette(rgba, palette);
    for (let i = 0; i < indexed.length; i++) {
      if (rgba[i * 4 + 3] < 128) indexed[i] = 0;
    }
    // Freeze only the static tagline; the wordmark above it turns freely.
    if (frame === 0) {
      firstIndexed = indexed.slice();
    } else {
      const taglineTop = Math.round(height * (dark ? 126 / 176 : 110 / 170));
      for (let row = taglineTop; row < height; row++) {
        const start = row * width + 390;
        indexed.set(firstIndexed.subarray(start, (row + 1) * width), start);
      }
    }
    gif.writeFrame(indexed, width, height, {
      palette: frame === 0 ? palette : undefined,
      delay,
      repeat: 0,
      transparent: true,
      transparentIndex: 0,
      dispose: 2,
    });
  });
  gif.finish();
  const output = path.join(root, "public", `${stem}.gif`);
  fs.writeFileSync(output, gif.bytes());
  console.log(`${path.relative(root, output)}: ${width}×${height}, ${frameCount} frames, ${frameCount * delay}ms, ${(fs.statSync(output).size / 1024).toFixed(0)} KiB`);
}
