#!/usr/bin/env node
/**
 * move-out.cjs ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Phase 2 addendum helper.
 *
 * Next.js `output: 'export'` always writes to a hard-coded `out/` directory;
 * there is no `outDir` config option for the export. This script relocates
 * the freshly-generated `out/` contents to a unified target under
 * `frontend/dist/` without clobbering sibling app folders.
 *
 * Usage:
 *   node move-out.cjs <src-dir> <dst-dir>
 *
 * Safeguards:
 *   - Refuses to overwrite protected sibling app folders (`patient`, `doctor`,
 *     `admin`) when the destination is `dist/` itself (e.g. Base Website must
 *     never clobber the dashboard subfolders).
 *   - Cross-volume safe fallback (rename -> copy -> delete).
 *   - Verbose stdout for build logs.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const PROTECTED = new Set(["patient", "doctor", "admin"]);

function die(msg) {
  console.error("[move-out] FATAL: " + msg);
  process.exit(1);
}

function moveOne(srcPath, dstPath, name, isProtectedRoot) {
  if (isProtectedRoot && PROTECTED.has(name)) {
    console.warn(`[move-out] SKIP protected sibling subfolder: ${name}`);
    return;
  }
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  try {
    fs.renameSync(srcPath, dstPath);
  } catch (err) {
    if (err && (err.code === "EXDEV" || err.code === "EPERM")) {
      // Cross-volume or same-volume-but-locked: copy + delete.
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDir(srcPath, dstPath);
        rmDir(srcPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
        fs.unlinkSync(srcPath);
      }
    } else {
      throw err;
    }
  }
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) die("usage: node move-out.cjs <src-dir> <dst-dir>");
  const srcAbs = path.resolve(src);
  const dstAbs = path.resolve(dst);
  if (!fs.existsSync(srcAbs)) die(`source does not exist: ${srcAbs}`);
  if (srcAbs === dstAbs) die("source and destination are identical");

  const isDistRoot = path.basename(dstAbs) === "dist";
  fs.mkdirSync(dstAbs, { recursive: true });

  const entries = fs.readdirSync(srcAbs, { withFileTypes: true });
  let moved = 0;
  let skipped = 0;
  for (const entry of entries) {
    const s = path.join(srcAbs, entry.name);
    const d = path.join(dstAbs, entry.name);
    if (isDistRoot && PROTECTED.has(entry.name) && entry.isDirectory()) {
      console.warn(`[move-out] PROTECTED: ${entry.name}/ left untouched`);
      skipped++;
      continue;
    }
    moveOne(s, d, entry.name, isDistRoot);
    moved++;
  }
  // remove the now-empty source dir
  try { fs.rmdirSync(srcAbs); } catch { /* maybe non-empty due to skips */ }
  console.log(`[move-out] ${path.basename(path.dirname(srcAbs))}/out -> ${path.relative(process.cwd(), dstAbs)} (moved=${moved}, skipped=${skipped})`);
}

main();
createRscAliases(path.resolve(process.argv[3])); createHtmlDirectoryAliases(path.resolve(process.argv[3]));
function createRscAliases(distAbs){const files=collectFiles(distAbs);for(const file of files){const parts=file.split(path.sep);const idx=parts.findIndex(x=>x.startsWith("__next."));if(idx<1)continue;const rel=parts.slice(idx+1).join(".");if(!rel)continue;const alias=parts[idx]+"."+rel;const target=path.join(parts.slice(0,idx).join(path.sep),alias);if(target!==file&&!fs.existsSync(target))fs.copyFileSync(file,target);}function collectFiles(dir){let out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())out=out.concat(collectFiles(p));else out.push(p);}return out;}}function createHtmlDirectoryAliases(distAbs){for(const entry of fs.readdirSync(distAbs,{withFileTypes:true})){if(!entry.isFile()||!entry.name.endsWith(".html")||entry.name==="index.html")continue;const route=entry.name.slice(0,-5);const dir=path.join(distAbs,route);fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,"index.html");if(!fs.existsSync(target))fs.copyFileSync(path.join(distAbs,entry.name),target);}}
