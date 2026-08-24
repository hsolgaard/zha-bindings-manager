// Bundles src/index.js (the real source, split into modules) into
// zha-binding-map-card.js — the single file Home Assistant/Lovelace
// actually loads as a resource. Not minified deliberately: this is a small
// HACS card, not a large app, and an unminified bundle stays readable if
// anyone opens it in HA's own file browser or on GitHub, same as the
// original hand-written single file always was.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const pkg = require("./package.json");
const watch = process.argv.includes("--watch");

// docs/ is the standalone zigbee-capabilities website (GitHub Pages, see
// README). It imports capexplorer.js and capexplorer-constants.js directly
// as plain ES modules — no bundler, no build step of its own — so those
// two files just need to be identical copies of the real source, not a
// separate maintained fork that can drift. Copied on every build rather
// than symlinked so docs/ stays a normal, self-contained static directory
// (GitHub Pages doesn't reliably follow symlinks anyway).
function syncCapexplorerToDocs() {
  const files = ["capexplorer.js", "capexplorer-constants.js"];
  fs.mkdirSync("docs", { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join("src", file), path.join("docs", file));
  }
  console.log(`Synced ${files.join(", ")} into docs/`);
}

// esbuild orders bundled output by execution order — the entry file's own
// top-level code (src/index.js's header comment, CARD_VERSION, the
// console.info banner) ends up AFTER everything it imports, not at the top
// of the file the way it read in the original hand-written single file.
// `banner` is esbuild's supported fix: text injected verbatim at the very
// start of the output, independent of module order. Keeps the version
// visible at a glance (HACS file browser, GitHub, a quick look) the same
// way it always was — pulled from package.json so there's one place to
// bump, not two that can drift out of sync.
const BANNER = `/**
 * ZHA Bindings Manager
 * --------------------
 * A visual manager for Zigbee (ZHA) direct bindings: a graph/table overview
 * of every binding on your network, plus drag-and-drop bind/unbind.
 *
 * GENERATED FILE — built from src/ via \`npm run build\` (see build.js).
 * Don't hand-edit this file directly; edit the source in src/ and rebuild.
 *
 * The custom element itself is still named/typed "zha-binding-map-card"
 * (see customElements.define() and window.customCards.push() below) — that
 * must never change, since it's what dashboard YAML references
 * (\`type: custom:zha-binding-map-card\`).
 *
 * This card is a UI layer on top of two things that already exist on your
 * Home Assistant install:
 *   1. The native ZHA websocket API (read-only device/cluster/group info).
 *   2. The "zha_toolkit" custom integration (https://github.com/mdeweerd/zha-toolkit),
 *      used for the actual bind / unbind / "read binding table" operations.
 *
 * zha_toolkit MUST be installed (via HACS) and working for bind/unbind/scan
 * to function. See README.md for details.
 *
 * Version: ${pkg.version}
 */`;

const options = {
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "zha-binding-map-card.js",
  format: "iife",
  target: "es2020",
  minify: false,
  legalComments: "none",
  banner: { js: BANNER },
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    // One-time sync on watch startup only — esbuild's watch mode doesn't
    // expose a rebuild hook here to resync on every subsequent change, so
    // a plain `node build.js` (no --watch) right before shipping is what
    // actually guarantees docs/ is current.
    syncCapexplorerToDocs();
    console.log("Watching src/ for changes — Ctrl+C to stop.");
  } else {
    await esbuild.build(options);
    console.log("Built zha-binding-map-card.js from src/index.js");
    syncCapexplorerToDocs();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
