// ファイル同士のつながりを調べる:各ファイルが、ほかのどのファイルで定義された名前を使っているかを出す。
// 使い方:node tests/deps.js   (--write を付けると、各ファイルの2行目に「使うファイル」を書き込む)
const acorn = require(process.env.ACORN || '/opt/node-tools/node_modules/acorn');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const order = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="js\/([a-z-]+)\.js/g)].map(m => m[1]);
const defs = {}, uses = {};
const walk = (n, f) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(x => walk(x, f)); if (n.type === 'Identifier') f(n.name); for (const k in n) if (k !== 'loc') walk(n[k], f); };
for (const f of order) {
  const src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022 });
  defs[f] = new Set();
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration') defs[f].add(n.id.name);
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => d.id.name && defs[f].add(d.id.name));
  }
  uses[f] = new Set(); walk(ast, x => uses[f].add(x));
}
const result = {};
for (const f of order) {
  result[f] = {};
  for (const g of order) if (g !== f) { const names = [...defs[g]].filter(x => uses[f].has(x)); if (names.length) result[f][g] = names; }
}
for (const f of order) console.log(`${f}.js が使う:` + Object.entries(result[f]).map(([g, n]) => `\n  ${g}.js(${n.length}): ${n.join(', ')}`).join('') + '\n');
if (process.argv.includes('--write'))
  for (const f of order) {
    const p = path.join(root, 'js', f + '.js'); const lines = fs.readFileSync(p, 'utf8').split('\n');
    const dep = `// 使うファイル:${Object.keys(result[f]).map(g => g + '.js').join('、') || 'なし'}(調べ方:node tests/deps.js)`;
    if (lines[1].startsWith('// 使うファイル:')) lines[1] = dep; else lines.splice(1, 0, dep);
    fs.writeFileSync(p, lines.join('\n'));
  }
