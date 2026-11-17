#!/usr/bin/env node
// Copies the Meteocons icons this app uses into src/components/weather-icons/icons.ts.
//
//   npm pack @meteocons/svg && mkdir x && tar xzf meteocons-svg-*.tgz -C x
//   node scripts/import-meteocons.mjs x/package
//
// Not a dependency: the package is only read here, and the result is committed. Each icon
// from the package's `monochrome/` folder is turned into a still drawing that renders inline:
//   - black (fill/stroke) becomes currentColor; white becomes var(--weather-bg, #000)
//   - all animation is removed (<animate*>, <set>, <style>); moving parts are frozen
//     in a pleasant resting pose (falling drops sit in a staggered row under the cloud)
//   - the clip rectangle (a white square the size of the icon) is dropped
//   - ids (used by the masks that cut a cloud out of the sun) are prefixed with the icon name,
//     so several icons on one page can't collide; all other ids are removed
// Uses only Node built-ins.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS = [
  "clear-day", "clear-night",
  "partly-cloudy-day", "partly-cloudy-night",
  "overcast-day", "overcast-night", "cloudy",
  "fog-day", "fog-night",
  "drizzle", "rain", "sleet", "snow", "hail",
  "thunderstorms-day", "thunderstorms-night",
];

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("usage: node scripts/import-meteocons.mjs <extracted @meteocons/svg package dir>");
  process.exit(1);
}
const outFile = join(dirname(fileURLToPath(import.meta.url)), "../src/components/weather-icons/icons.ts");

// ---- a tiny XML reader (these files are plain, well-formed SVG) ----
const TAG = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;

function parse(xml) {
  const root = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  for (const m of xml.matchAll(TAG)) {
    const [whole, closing, name, rawAttrs, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      if (text.trim()) top.children.push({ name: "#text", text: text.trim() });
    } else if (name) {
      if (closing) {
        stack.pop();
      } else {
        const attrs = {};
        for (const a of rawAttrs.matchAll(ATTR)) attrs[a[1]] = a[2] ?? a[3] ?? "";
        const node = { name, attrs, children: [] };
        top.children.push(node);
        if (!selfClose) stack.push(node);
      }
    } else if (!whole.startsWith("<!--")) {
      throw new Error("unexpected markup: " + whole);
    }
  }
  return root.children.find((n) => n.name === "svg");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
function serialize(n) {
  if (n.name === "#text") return n.text;
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
  return n.children.length ? `<${n.name}${attrs}>${n.children.map(serialize).join("")}</${n.name}>` : `<${n.name}${attrs}/>`;
}

// ---- transformation ----
const REMOVE = new Set(["animate", "animateTransform", "animateMotion", "set", "style", "script"]);
const num = (s) => s.trim().split(/\s+/).map(Number);
const frac = (x) => x - Math.floor(x);

/** The resting transform for an element, from its <animateTransform> children (or null). */
function stillTransform(anims) {
  for (const a of anims) {
    if (a.name !== "animateTransform" || a.attrs.type !== "translate") continue; // rotate/scale: rest pose
    const values = (a.attrs.values ?? "").split(";").map(num);
    if (values.length === 2) {
      // A falling drop: park it in a staggered spot, clear of the cloud above it.
      const begin = parseFloat(a.attrs.begin ?? "0");
      const dur = parseFloat(a.attrs.dur ?? "1");
      const t = 0.5 + 0.4 * frac(begin / dur);
      const [dx, dy] = values[1];
      return `translate(${+(dx * t).toFixed(2)} ${+(dy * t).toFixed(2)})`;
    }
    const [dx, dy] = values[0]; // gentle bobbing: the first frame
    return dx || dy ? `translate(${dx} ${dy})` : null;
  }
  return null;
}

function transform(node, prefix, usedIds) {
  const anims = node.children.filter((c) => REMOVE.has(c.name));
  const hadOpacityAnim = anims.some((a) => a.name === "animate" && a.attrs.attributeName === "opacity");
  const t = stillTransform(anims);
  node.children = node.children.filter((c) => !REMOVE.has(c.name) && c.name !== "clipPath" && c.name !== "defs");
  const a = node.attrs;
  if (t) a.transform = a.transform ? `${a.transform} ${t}` : t;
  if (hadOpacityAnim && a.opacity === "0") delete a.opacity;
  delete a["clip-path"];
  delete a["clip-rule"];
  // Colors.
  for (const k of ["fill", "stroke"]) {
    const v = (a[k] ?? "").toLowerCase();
    if (v === "black" || v === "#000" || v === "#000000") a[k] = "currentColor";
    else if (v === "white" || v === "#fff" || v === "#ffffff") {
      delete a[k];
      a.style = `${k}:var(--weather-bg,#000);${a.style ?? ""}`;
    }
  }
  // Ids: keep (prefixed) only the ones referenced by url(#id) or href.
  if (a.id !== undefined) {
    if (usedIds.has(a.id)) a.id = prefix + a.id;
    else delete a.id;
  }
  for (const k of ["mask", "filter", "fill", "stroke"]) {
    if (a[k]?.startsWith("url(#")) a[k] = a[k].replace(/url\(#([^)]+)\)/, (_, id) => `url(#${prefix}${id})`);
  }
  node.children.forEach((c) => c.name !== "#text" && transform(c, prefix, usedIds));
}

function referencedIds(xml) {
  return new Set([...xml.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
}

const out = {};
for (const name of ICONS) {
  const xml = readFileSync(join(srcDir, "monochrome", `${name}.svg`), "utf8");
  const svg = parse(xml);
  if (!svg) throw new Error(`${name}: no <svg>`);
  // The root group's clip-path only references the clip rectangle we drop, so ignore those ids.
  const refs = new Set([...referencedIds(xml)].filter((id) => !id.startsWith("clip")));
  svg.children.forEach((c) => c.name !== "#text" && transform(c, `mc-${name}-`, refs));
  out[name] = svg.children.map(serialize).join("");
  if (/<animate|<set\b|<style|clip/.test(out[name])) throw new Error(`${name}: leftover animation or clip`);
}

const body = Object.entries(out)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");
writeFileSync(
  outFile,
  `// Generated by scripts/import-meteocons.mjs from the Meteocons monochrome set. Do not edit.
// Meteocons by Bas Milius, MIT license (see LICENSE in this folder).
// Inner markup of 128x128 icons: black is currentColor, overlaps use var(--weather-bg, #000).

export const weatherIconSvg = {
${body}
} as const;

export type WeatherIconName = keyof typeof weatherIconSvg;
`,
);
console.log(`wrote ${ICONS.length} icons to ${outFile}`);
