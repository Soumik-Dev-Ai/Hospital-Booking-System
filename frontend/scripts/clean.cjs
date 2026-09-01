#!/usr/bin/env node
/**
 * clean.cjs — Phase 1.3 helper.
 * Removes the unified dist/ directory (or any path passed) so each build
 * run starts from a clean slate. Safe if the path doesn't exist.
 *
 * Usage: node clean.cjs <path>
 */
"use strict";
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
if (!target) {
  console.error("[clean] usage: node clean.cjs <path>");
  process.exit(1);
}
const abs = path.resolve(target);
if (fs.existsSync(abs)) {
  fs.rmSync(abs, { recursive: true, force: true });
  console.log(`[clean] removed ${path.relative(process.cwd(), abs) || path.basename(abs)}`);
} else {
  console.log(`[clean] ${path.relative(process.cwd(), abs) || path.basename(abs)} (already absent)`);
}
