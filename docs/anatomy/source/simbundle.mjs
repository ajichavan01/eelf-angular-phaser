import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const IMPORT = /^\s*import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';?/gm;
const STAR = /^\s*export\s+\*\s+from\s+'([^']+)';?/gm;
const DECL = /^export\s+(?:(?:abstract\s+)?class|function\*?|async\s+function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

export function bundle(entries, root) {
  const order = [];
  const seen = new Map();
  const visit = (file) => {
    const key = resolve(file);
    if (seen.has(key)) {
      if (seen.get(key) === "busy") throw new Error(`import cycle at ${key}`);
      return;
    }
    seen.set(key, "busy");
    const source = readFileSync(key, "utf8");
    for (const match of source.matchAll(IMPORT)) if (!match[1]) visit(resolve(dirname(key), match[3]));
    for (const match of source.matchAll(STAR)) visit(resolve(dirname(key), match[1]));
    seen.set(key, "done");
    order.push(key);
  };
  entries.forEach(visit);
  const name = (file) => relative(root, file).replace(/\\/g, "/");
  const modules = order.map((file) => {
    let code = stripTypeScriptTypes(readFileSync(file, "utf8"), { mode: "strip" });
    const here = dirname(file);
    code = code.replace(IMPORT, (all, type, names, from) => {
      if (type) return "";
      const list = names.split(",").map((part) => part.trim()).filter(Boolean).filter((part) => !part.startsWith("type "));
      if (!list.length) return "";
      const fields = list.map((part) => part.replace(/\s+as\s+/, ": "));
      return `const { ${fields.join(", ")} } = __mod[${JSON.stringify(name(resolve(here, from)))}];`;
    });
    const stars = [];
    code = code.replace(STAR, (all, from) => {
      stars.push(name(resolve(here, from)));
      return "";
    });
    const exported = [];
    code = code.replace(DECL, (all, id) => {
      exported.push(id);
      return all.replace(/^export\s+/, "");
    });
    if (/^\s*export\s/m.test(code)) throw new Error(`unhandled export form in ${name(file)}`);
    const merge = stars.map((from) => `...__mod[${JSON.stringify(from)}]`);
    return `__mod[${JSON.stringify(name(file))}] = (() => {\n${code}\nreturn { ${[...merge, ...exported].join(", ")} };\n})();`;
  });
  return `const __mod = {};\n${modules.join("\n")}\n`;
}

export function exportsOf(entry, root) {
  return `__mod[${JSON.stringify(relative(root, resolve(entry)).replace(/\\/g, "/"))}]`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const root = process.argv[2];
  const entries = [join(root, "packages/browser/src/Runtime.ts"), join(root, "packages/browser/src/Drawing.ts")];
  const code = bundle(entries, root);
  const run = new Function(`${code}\nreturn { runtime: ${exportsOf(entries[0], root)}, drawing: ${exportsOf(entries[1], root)} };`);
  const { runtime, drawing } = run();
  const rt = new runtime.SimulationRuntime();
  const [first] = rt.dispatch({ type: "init", config: { ...runtime.INITIAL_CONFIG } });
  console.log("bundle", (code.length / 1024).toFixed(1), "KB", "founders", first.frame.creatures.length, "plants", first.frame.statistics.plants);
  let posted = 0;
  for (let call = 0; call < 20 * 60; call++) if (rt.advance(0.05)) posted++;
  const stats = rt.world.statistics();
  console.log("after 60 s:", "tick", stats.tick, "pop", stats.population, "gen", stats.generation, "births", stats.births, "deaths", stats.deaths, "frames", posted);
  console.log("save KiB", (JSON.stringify(rt.world.save()).length / 1024).toFixed(1), "interp", typeof drawing.SnapshotInterpolator);
}
