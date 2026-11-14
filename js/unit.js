// 部隊内で数えるもの(編成の4人のスキルを見て数える:同じスキル・Xスキル・飛翔・部隊移動速度・重複上限)
// 使うファイル:core.js、skills.js、cards.js(調べ方:node tests/deps.js)
/* 1人の武将が持つスキル。並びは 追加1・追加2・極限・初期(重複上限で同じ値のときは、この順で先のものを残す)。
   k は 's1' / 's2' / 'lim' / 'init'、sel はそのスキルの { id, tr } */
const SLOT_SKILLS = ['s1', 's2', 'lim'];
function slotSkills(s) {
  const out = [];
  for (const k of SLOT_SKILLS) {
    const d = M.skills.get(s[k].id);
    if (d) out.push({ k, id: s[k].id, d, sel: s[k] });
  }
  const init = skillByName(M.cards.get(s.card)?.initName);
  if (init) out.push({ k: 'init', id: init.id, d: init.d, sel: { id: init.id, tr: s.tr } });
  return out;
}
/* TRごとの値(特殊効果のチェックがあるときだけ) */
const effVal = (x, k) => (effsOf(x.d)[k] ? N(trEntry(x.d, x.sel.tr)?.[k]) : 0);

/* ---------- 係数の n(人数のときは null = 設定の人数) ---------- */
function coefN(d, id) {
  const by = coefByOf(d);
  if (by === 'people' || !form) return null;
  if (by === 'same') return sameUses(id).length;
  if (by === 'hisho') return hishoCount();
  if (by === 'speed') return unitSpeed();
  return xCount();
}
/* 部隊内で同じスキルを使っているところのTR(追加・極限スキルと、同じ初期スキルを持つ武将) */
const sameUses = id =>
  !form || !id
    ? []
    : form.slots.flatMap(s =>
        slotSkills(s)
          .filter(x => x.id === id)
          .map(x => N(x.sel.tr)),
      );
const maxTrOf = id => {
  const u = sameUses(id);
  return u.length ? Math.max(...u) : null;
};
/* 部隊内のXスキルの数(通常枠だけ。最大8) */
const xCount = () =>
  Math.min(
    8,
    form.slots.reduce(
      (a, s) => a + slotSkills(s).filter(x => x.k !== 'lim' && x.k !== 'init' && isX(x.d)).length,
      0,
    ),
  );
/* 部隊内の飛翔の数:4人それぞれの、持っているスキル(初期・追加・極限)の飛翔のいちばん大きい値を、足したもの */
const hishoCount = () =>
  form.slots.reduce((a, s) => a + Math.max(0, ...slotSkills(s).map(x => effVal(x, 'hisho'))), 0);
/* 部隊移動速度 = 部隊の兵種の速度のいちばん遅い値 × 速度スキル ÷ 100。
   速度スキル = 100(基本) + 部隊の全員のスキル(初期・追加・極限)の速度スキルの合計(それぞれのTRの値)。
   兵種を選んでいない枠は、遅い値を探すときに数えない。速度スキルの値は無尽でも2倍にならない
   (2倍になるのは、このあとのスキル効果のほう) */
function unitSpeed() {
  const sp = form.slots
    .map(s => M.soldiers.get(s.soldier))
    .filter(o => o && hasV(o.speed))
    .map(o => N(o.speed));
  if (!sp.length) return 0;
  const skill = form.slots
    .filter(s => s.card)
    .reduce((a, s) => a + slotSkills(s).reduce((b, x) => b + effVal(x, 'speed'), 0), 100);
  return (Math.min(...sp) * skill) / 100;
}

/* ---------- 重複上限 ----------
   部隊内で同じスキルが付いていても、効果が出るのは倍枠などをかけたあとの実際の上昇値が高い順に、上限の数まで。
   数(Xスキルの数・同じスキルの数)は全部数える。特殊効果(黎天列光・火焔武闘)は倍枠で変わらないので、上限の数まで */
/* 部隊内でこのスキルが付いているところ。withInit なら、このスキルを初期スキルに持つ武将(k='init')も入れる */
function dupInstances(id, withInit) {
  if (!form) return [];
  return form.slots.flatMap((s, i) =>
    slotSkills(s)
      .filter(x => x.id === id && (withInit || x.k !== 'init'))
      .map(x => ({ i, k: x.k, sel: x.sel })),
  );
}
/* 効果を出さない枠の集合("i:k"。初期スキルは k='init') */
function dupDropped() {
  const drop = new Set();
  if (!form) return drop;
  const ids = new Set(form.slots.flatMap(s => slotSkills(s).map(x => x.id)));
  for (const id of ids) {
    const inst = dupInstances(id, true),
      L = dupLimit(M.skills.get(id));
    if (L == null || inst.length <= L) continue;
    const val = x => {
      const { c, t } = slotEff(x.i);
      if (x.k === 'init') return t ? initEff(c, t) : 0;
      const m = !t ? 1 : x.k === 'lim' ? N(t.mulLimit) * limX(x.sel) : N(t.mulNormal);
      return skillVal(x.sel, x.i) * muzinMul(x.sel, x.k) * m;
    };
    inst
      .map((x, n) => ({ x, n, v: val(x) }))
      .sort((a, b) => b.v - a.v || a.n - b.n)
      .slice(L)
      .forEach(({ x }) => drop.add(x.i + ':' + x.k));
  }
  return drop;
}
/* 特殊効果(黎天列光・火焔武闘)の数:重複上限があればその数まで、なければ従来どおり2つまで */
function spCount(name) {
  const id = findId(M.skills, d => d.name === name);
  if (!id || !form) return 0;
  return Math.min(dupLimit(M.skills.get(id)) ?? 2, dupInstances(id).length);
}
