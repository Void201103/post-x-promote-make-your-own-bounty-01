// Validator for the make.fun "Promote make.fun's make-your-own-bounty post on X" entry.
// Reads POST.json (the X post URL) and POST_TEXT.md (the exact post text) from the
// bot directory, checks them against the bounty rules, prints one line per check,
// and writes a deterministic JSON report to the output directory.
// Standard library only. No network. No clock. No randomness.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BOT_DIR: string = process.env.MAKEFUN_BOT_DIR ?? process.cwd();
const OUT_DIR: string =
  process.env.MAKEFUN_OUTPUT_DIR ?? join(BOT_DIR, "output");
const PLAY_CODE = "makefun-sparrow-flask-highland";
const SLUG = "post-x-promote-make-your-own-bounty-01";

type Check = { id: string; pass: boolean; detail: string };

function readText(rel: string): string | null {
  const p = join(BOT_DIR, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

// X counts every URL as 23 characters and astral-plane characters as 2.
function xLength(text: string): number {
  const squashed = text.replace(/https?:\/\/\S+/g, "x".repeat(23));
  let n = 0;
  for (const ch of squashed) n += ch.codePointAt(0)! > 0xffff ? 2 : 1;
  return n;
}

const checks: Check[] = [];

// 1. POST.json exists, parses, and carries a string url.
const postJsonRaw = readText("POST.json");
let postUrl = "";
if (postJsonRaw === null) {
  checks.push({ id: "post_json_present", pass: false, detail: "POST.json missing" });
} else {
  try {
    const parsed: unknown = JSON.parse(postJsonRaw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { url?: unknown }).url === "string"
    ) {
      postUrl = (parsed as { url: string }).url;
      checks.push({ id: "post_json_present", pass: true, detail: "POST.json parses with a url" });
    } else {
      checks.push({ id: "post_json_present", pass: false, detail: "POST.json has no string url" });
    }
  } catch {
    checks.push({ id: "post_json_present", pass: false, detail: "POST.json is not valid JSON" });
  }
}

// 2. The url is a real X status address (handle/status/id, numeric id).
const urlOk = /^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/[0-9]+$/.test(postUrl);
checks.push({
  id: "post_url_shape",
  pass: urlOk,
  detail: urlOk ? postUrl : `not an X status URL: ${postUrl}`,
});

// 3. POST_TEXT.md exists and is non-empty.
const postText = readText("POST_TEXT.md");
checks.push({
  id: "post_text_present",
  pass: postText !== null && postText.trim().length > 0,
  detail: postText === null ? "POST_TEXT.md missing" : "POST_TEXT.md present",
});
const text = postText ?? "";

// 4. The post text carries the entrant's make.fun play code.
checks.push({
  id: "text_has_play_code",
  pass: text.includes(PLAY_CODE),
  detail: `play code ${PLAY_CODE}`,
});

// 5. The post text carries make.fun or @makefunai.
const lower = text.toLowerCase();
checks.push({
  id: "text_has_makefun",
  pass: lower.includes("@makefunai") || lower.includes("make.fun"),
  detail: "@makefunai or make.fun",
});

// 6. The post text carries the sponsor line's make.fun link.
checks.push({
  id: "text_has_sponsor_link",
  pass: text.includes("make.fun/sponsor/new"),
  detail: "make.fun/sponsor/new",
});

// 7. The post text fits in one X post (280 characters by X counting).
const len = xLength(text.trim());
checks.push({
  id: "text_fits_x",
  pass: len <= 280,
  detail: `${len}/280 characters by X counting`,
});

// 8. README.md carries the three live make.fun badges for this bounty.
const readme = readText("README.md") ?? "";
const badgeBase = `https://make.fun/badge/${SLUG}`;
checks.push({
  id: "readme_has_badges",
  pass:
    readme.includes(`${badgeBase}.svg`) &&
    readme.includes(`${badgeBase}/Void201103/post-x-promote-make-your-own-bounty-01/rank.svg`) &&
    readme.includes(`${badgeBase}/Void201103/post-x-promote-make-your-own-bounty-01/reward.svg`),
  detail: "competition, rank and reward badges",
});

const pass = checks.every((c) => c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.id} — ${c.detail}`);
console.log(`OVERALL: ${pass ? "PASS" : "FAIL"}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "report.json"),
  JSON.stringify({ competition: SLUG, pass, checks }, null, 2) + "\n",
  "utf8",
);
process.exit(pass ? 0 : 1);
