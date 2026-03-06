#!/usr/bin/env node
/**
 * Release script — bumps version, builds, tags, and pushes.
 *
 * Usage:
 *   yarn release patch    → 1.0.0 → 1.0.1
 *   yarn release minor    → 1.0.0 → 1.1.0
 *   yarn release major    → 1.0.0 → 2.0.0
 *   yarn release          → prompts (defaults to patch)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// ─── Determine new version ────────────────────────────────────────────────────

const bump = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: yarn release [patch|minor|major]");
  process.exit(1);
}

const [maj, min, pat] = pkg.version.split(".").map(Number);
let newVersion;
if (bump === "patch") newVersion = `${maj}.${min}.${pat + 1}`;
else if (bump === "minor") newVersion = `${maj}.${min + 1}.0`;
else newVersion = `${maj + 1}.0.0`;

console.log(`\nBumping ${pkg.version} → ${newVersion} (${bump})\n`);

// ─── Write new version ────────────────────────────────────────────────────────

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`✓ package.json updated to ${newVersion}`);

// ─── Build ────────────────────────────────────────────────────────────────────

run("yarn dist:win");

// ─── Git tag & push ───────────────────────────────────────────────────────────

run("git add package.json");
run(`git commit -m "chore: release v${newVersion}"`);
run(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
run("git push origin main");
run(`git push origin v${newVersion}`);

console.log(`\n✓ Released v${newVersion} — tag pushed to GitHub`);
console.log(
  `  Upload release/BibleNDI\\ Setup\\ ${newVersion}.exe to the GitHub release page.`,
);
