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
/* i はスキルを持つ武将の枠(「部隊内の兵科・兵種の数」の自身・自身のもつ兵種に使う。わからなければ0人) */
function coefN(d, id, i) {
  const by = coefByOf(d);
  if (by === 'people') return null;
  if (by === 'cost') return enemyCost();
  if (by === 'branch')
    return !form || i == null
      ? 0
      : unitCount(i, {
          by: 'branch',
          self: coefSelfOf(d),
          branches: coefBranchesOf(d),
          soldiers: coefSoldiersOf(d),
          own: coefOwnOf(d),
        });
  if (!form) return null;
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
      const { c, t, raw } = slotEff(x.i);
      if (x.k === 'init') return t ? initEff(c, t, x.i) : 0;
      const ml = slotMul(x.i, t, raw),
        m = !t ? 1 : x.k === 'lim' ? ml.l * limX(x.sel) : ml.n;
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
function spCount(names) {
  const id = findId(M.skills, d => names.includes(String(d.name).trim()));
  if (!id || !form) return 0;
  return Math.min(dupLimit(M.skills.get(id)) ?? 2, dupInstances(id).length);
}

/* ---------- 部隊内の姫・剣豪・対象兵科・兵種の数(総バフ・倍枠の「係数 × 数」) ----------
   cfg = { by: 'hime' | 'kengou' | 'branch', self: 自分を数えるか, branches, soldiers, own: 自身のもつ兵種 }。i は持ち主の枠 */
function unitCount(i, cfg) {
  if (!form) return 0;
  const own = form.slots[i]?.soldier;
  const hit = s => {
    const c = M.cards.get(s.card);
    if (!c) return false;
    if (cfg.by === 'hime') return !!toFlag(c.hime);
    if (cfg.by === 'kengou') return !!toFlag(c.kengou);
    const o = M.soldiers.get(s.soldier);
    return (
      !!o &&
      ((cfg.soldiers || []).includes(o.name) ||
        (cfg.branches || []).includes(o.branch) ||
        (!!cfg.own && !!own && s.soldier === own))
    );
  };
  return form.slots.filter((s, j) => hit(s) && (j !== i || cfg.self)).length;
}
/* その枠の倍枠(通常・極限)。倍枠を数で掛ける初期スキルなら 倍枠 + 係数 × 数。
   t は効果の出るTR(部隊長限定・重複上限で外れたときは raw と別物になり、数で掛けない) */
function slotMul(i, t, raw) {
  if (!t) return { n: 1, l: 1, cnt: null };
  if (t === raw && raw?.mulLv) {
    /* 倍枠極限 = 部隊内武将の初期スキルLV(10 + TR)の合計 ÷ 10(この部隊で使わない側なら1倍)。
       傑(初期スキルなし)は合計に入れない */
    const lv = (form?.slots || []).reduce((a, s) => {
      const c = M.cards.get(s.card);
      return a + (c && c.rarity !== '傑' && String(c.initName || '').trim() ? INIT_LV_BASE + N(s.tr) : 0);
    }, 0);
    return raw.mulLv.on ? { n: 1, l: lv / 10, cnt: null, lv } : { n: 1, l: 1, cnt: null };
  }
  if (t !== raw || !raw?.mul) return { n: N(t.mulNormal), l: N(t.mulLimit), cnt: null };
  const m = raw.mul,
    cnt = unitCount(i, m);
  return { n: N(t.mulNormal) + m.n * cnt, l: N(t.mulLimit) + m.l * cnt, cnt, by: m.by };
}

/* ---------- コスト減(自合流使用コスト) ----------
   部隊のコスト合計(武将マスタの武将コスト)から、部隊内のスキル(初期・追加・極限)の「コスト減」を引いたものが自合流使用コスト。
   ①スキルを付けた武将のコスト分(1人につき1回) ②決めた数値。無尽を持つスキルも無尽1につき0.5減らす(MUZIN_CUT)。①→②の順に引き、0より下がらない(引ける合計は部隊のコスト合計まで) */
const MUZIN_CUT = 0.5;
function costCut(drop = dupDropped()) {
  let total = 0,
    cut = 0;
  if (!form) return { total, cut, left: 0 };
  form.slots.forEach((s, i) => {
    const c = M.cards.get(s.card);
    if (!c) return;
    const cost = slotCost(s);
    total += cost;
    const { t } = slotEff(i);
    /* ①武将のコスト分は1人につき1回だけ(同じ武将に複数付けても重ならない) */
    let self = false;
    if (t && !t.loOff && !drop.has(i + ':init')) {
      if (t.cut) t.cut.self ? (self = true) : (cut += N(t.cut.v));
      /* 無尽:無尽1につきコスト0.5減 */
      cut += MUZIN_CUT * cardMuzin(c, s.tr);
    }
    for (const k of ['s1', 's2', 'lim']) {
      const sel = s[k],
        d = sel?.id && M.skills.get(sel.id);
      if (!d || drop.has(i + ':' + k)) continue;
      cut += MUZIN_CUT * skillMuzin(d, sel.tr);
      if (effsOf(d).cut)
        cutByOf(d) === 'self'
          ? (self = true)
          : (cut += N(trsOf(d).find(x => N(x.tr) === N(sel.tr))?.costCut));
    }
    if (self) cut += cost;
  });
  cut = Math.min(Math.max(cut, 0), total);
  return { total, cut, left: total - cut };
}
/* 枠 j の兵士攻撃力(防御力)に足す値:初期スキルの「兵士攻撃力加算」× コスト減の合計。
   対象は兵科・兵種(「自身のもつ兵種」はスキルを持つ武将と同じ兵種) */
function soldierAdd(j, drop = dupDropped()) {
  const s = form?.slots[j],
    o = s && M.soldiers.get(s.soldier);
  if (!o) return 0;
  let v = 0,
    cc = null;
  form.slots.forEach((h, i) => {
    const a = slotEff(i).t?.sadd;
    if (!a || drop.has(i + ':init')) return;
    const hit =
      a.soldiers.includes(o.name) ||
      a.branches.includes(o.branch) ||
      (a.own && !!h.soldier && s.soldier === h.soldier);
    if (!hit) return;
    cc ??= costCut(drop).cut;
    v += a.v * cc;
  });
  return v;
}

/* ---------- 兵数を陣形内の最大に揃える(本丸防御陣形。防御部隊だけ) ---------- */
/* 枠 i にこの効果のスキル(初期・追加・極限)があるか */
function slotTroopMax(i, drop = dupDropped()) {
  const s = form?.slots[i];
  if (!s || !M.cards.get(s.card)) return false;
  const t = slotEff(i).t;
  if (t?.tmax && !drop.has(i + ':init')) return true;
  return ['s1', 's2', 'lim'].some(k => {
    const d = s[k]?.id && M.skills.get(s[k].id);
    return !!d && !!effsOf(d).tmax && !drop.has(i + ':' + k) && forMode(d);
  });
}
/* 陣形内の最大兵数の初期値:マスタの武将でいちばん兵数が多くなる部隊を考える。
   武将の兵数(ランクアップ・兵数バフ込み)+ ほかの3人の初期スキルの兵数加算(TR0)の大きいもの3つ */
function defaultFormationMax() {
  let best = { v: 0, parts: [] };
  const adders = [...M.cards.values()]
    .map(k => ({ k, t: cardT(k, 0) }))
    .filter(x => x.t && N(x.t.troopAdd) > 0);
  for (const c of M.cards.values()) {
    const hit = to =>
      !to ||
      to.includes('all') ||
      (to.includes('hime') && !!toFlag(c.hime)) ||
      (to.includes('kengou') && !!toFlag(c.kengou));
    const tbs = troopBuffsFor(form, c);
    const add = adders
      .filter(x => x.k !== c && hit(x.t.troopTo))
      .sort((a, b) => N(b.t.troopAdd) - N(a.t.troopAdd))
      .filter((x, j, a) => a.findIndex(y => y.k.name === x.k.name) === j)
      .slice(0, 3);
    const v =
      N(c.troops) +
      rarityTroops(c) +
      tbs.reduce((a, b) => a + b.troops, 0) +
      add.reduce((a, x) => a + N(x.t.troopAdd), 0);
    if (v > best.v)
      best = {
        v,
        parts: [
          `${c.name}(${c.rarity}) ${fmt(N(c.troops) + rarityTroops(c))}`,
          ...tbs.map(b => `${b.name} ${fmt(b.troops)}`),
          ...add.map(x => `${x.k.name} ${fmt(N(x.t.troopAdd))}`),
        ],
      };
  }
  return best;
}
/* 揃える先の兵数:防御部隊の兵数バフに入力した値、空なら初期値 */
const formationMax = () => (N(form?.maxTroops) > 0 ? N(form.maxTroops) : defaultFormationMax().v);
