import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import ts from "typescript";

// Inspect source only: importing application modules could initialize real storage.
const root = path.resolve("src");
const files = fs.readdirSync(root, { recursive: true }).filter((name): name is string =>
  typeof name === "string" && /\.(ts|tsx)$/.test(name) && !/(^|\/)(__tests__|[^/]+\.test\.)/.test(name),
).map(name => path.join(root, name));
const graph = new Map<string, string[]>();
const clients: string[] = [];
const relative = (file: string) => path.relative(root, file);
const serverBuiltins = new Set(builtinModules.map(name => name.replace(/^node:/, "")));
function resolveImport(file: string, specifier: string): string {
  const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2))
    : specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : null;
  if (!base) return specifier;
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? specifier;
}
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const references: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      if (!clause?.isTypeOnly && (!bindings || !ts.isNamedImports(bindings) || clause.name || bindings.elements.length === 0 || bindings.elements.some(item => !item.isTypeOnly))) references.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(item => !item.isTypeOnly))) references.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) references.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (source.statements.some(node => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use client")) clients.push(file);
  graph.set(file, references.map(specifier => resolveImport(file, specifier)));
}

describe("application module boundaries", () => {
  it("keeps runtime imports acyclic throughout the application", () => {
    const visited = new Set<string>();
    const active = new Set<string>();
    function visit(file: string, chain: string[]): void {
      assert.ok(!active.has(file), `Circular runtime dependency: ${[...chain, file].map(relative).join(" -> ")}`);
      if (visited.has(file)) return;
      active.add(file);
      for (const dependency of graph.get(file) ?? []) if (graph.has(dependency)) visit(dependency, [...chain, file]);
      active.delete(file); visited.add(file);
    }
    for (const file of files) visit(file, []);
  });
  it("keeps Node capabilities out of every client import graph", () => {
    for (const client of clients) {
      const visited = new Set<string>();
      function visit(file: string, chain: string[]): void {
        if (visited.has(file)) return;
        visited.add(file);
        for (const dependency of graph.get(file) ?? []) {
          const serverOnly = dependency === "server-only" || /^next\/(headers|cache|server)(?:\.js)?$/.test(dependency) || serverBuiltins.has(dependency.replace(/^node:/, ""));
          assert.ok(!serverOnly, `Client/server boundary: ${[...chain, relative(file), dependency].join(" -> ")}`);
          if (graph.has(dependency)) visit(dependency, [...chain, relative(file)]);
        }
      }
      visit(client, []);
    }
  });
  it("keeps business libraries independent of views, hooks and API routes", () => {
    for (const [file, dependencies] of graph) {
      if (!relative(file).startsWith("lib/")) continue;
      for (const dependency of dependencies) {
        if (graph.has(dependency)) assert.ok(!/^(app|components|hooks|context)\//.test(relative(dependency)), `${relative(file)} imports ${relative(dependency)}`);
      }
    }
  });
  it("keeps workflow execution independent of individual business modules", () => {
    for (const [file, dependencies] of graph) {
      if (!relative(file).startsWith("lib/workflows/")) continue;
      for (const dependency of dependencies) assert.ok(graph.has(dependency) && relative(dependency).startsWith("lib/workflows/"), `${relative(file)} imports ${dependency}`);
    }
  });
});
