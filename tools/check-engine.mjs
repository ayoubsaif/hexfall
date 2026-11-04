// Engine purity guard (tasks 2.4, 2.5). Plain Node ESM, no dependencies.
// Fails if @hexfall/engine declares runtime dependencies, or if engine source
// uses Math.random or Date (the engine must be deterministic: use src/rng.ts).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(root, "packages", "engine");
const srcDir = join(engineDir, "src");
const errors = [];

// ---- 1. No runtime dependencies
const pkg = JSON.parse(readFileSync(join(engineDir, "package.json"), "utf8"));
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  const deps = pkg[field];
  if (deps && typeof deps === "object" && Object.keys(deps).length > 0) {
    errors.push(
      `packages/engine/package.json: "${field}" must be empty, found: ${Object.keys(deps).join(", ")}`,
    );
  }
}

// ---- 2. No Math.random / Date in engine source
/**
 * Blanks out comments and string/template text (keeping newlines and ${} code)
 * so the scan only sees code and line numbers stay correct.
 */
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const templateDepth = []; // brace depth at each open ${
  let braces = 0;
  const blank = (s) => s.replace(/[^\n]/g, " ");
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += ch + blank(src.slice(i + 1, j)) + ch;
      i = j + 1;
    } else if (ch === "`" || (ch === "}" && braces === templateDepth.at(-1))) {
      // Template text, either from the opening backtick or after a ${...} closes.
      if (ch === "}") templateDepth.pop();
      let j = i + 1;
      while (j < src.length && src[j] !== "`" && !(src[j] === "$" && src[j + 1] === "{")) {
        j += src[j] === "\\" ? 2 : 1;
      }
      out += ch + blank(src.slice(i + 1, j));
      if (src[j] === "$") {
        templateDepth.push(braces);
        out += "${";
        i = j + 2;
      } else {
        out += "`";
        i = j + 1;
      }
    } else {
      if (ch === "{") braces++;
      else if (ch === "}") braces--;
      out += ch;
      i++;
    }
  }
  return out;
}

const BANNED = [
  { re: /\bMath\s*\.\s*random\b/g, what: "Math.random", hint: "use the seeded RNG in rng.ts" },
  { re: /(?<![.\w$])Date\b/g, what: "Date", hint: "the engine has no clock; pass time in" },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) yield p;
  }
}

for (const file of walk(srcDir)) {
  const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
  const lines = code.split("\n");
  lines.forEach((line, idx) => {
    for (const { re, what, hint } of BANNED) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const rel = relative(root, file).replaceAll("\\", "/");
        errors.push(`${rel}:${idx + 1}:${m.index + 1}: ${what} is banned in the engine (${hint})`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error(`check-engine: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("check-engine: OK (no engine dependencies, no Math.random/Date in engine src)");
