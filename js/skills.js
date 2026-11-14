// スキルの値のルール(係数の掛け方、攻撃or防御、初期スキルの特殊効果のチェック、模倣、無尽の倍率、重複上限、保存するときの形)
// 使うファイル:core.js、fields.js、cards.js(調べ方:node tests/deps.js)
/* スキル上昇率 = 素スキル上昇率 + 係数 × n
   n はスキルごとの「係数の掛け方」で決まる:人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数 */
const COEF_BY = {
  people: '人数',
  same: '部隊内の同じスキルの数',
  x: '部隊内のXスキルの数',
  hisho: '部隊内の飛翔の数',
};
const COEF_SHORT = { people: '人数', same: '同スキル数', x: 'Xスキル数', hisho: '飛翔数' };
/* 初期スキルの総攻・防バフの掛け方:固定、または 総攻・防バフ + 無尽を持つ武将数 × 総攻・防バフ係数 ÷ 100 × 無尽2倍 */
const TB_BY = { fixed: '固定', muzin: '無尽を持つ武将数' };
const tbByOf = d => (TB_BY[d?.tbBy] ? d.tbBy : 'fixed');
const coefByOf = d => (COEF_BY[d?.coefBy] ? d.coefBy : 'people');
const isX = d => toFlag(d?.xskill) === 1;
/* スキルの攻防:攻撃 / 防御 / 攻撃・防御。値は1組だけ持ち、攻撃部隊では「防御」スキルの値を使わない(未設定は攻撃) */
const SIDES = ['攻撃', '防御', '攻撃・防御'];
const skillSide = d => (SIDES.includes(d?.side) ? d.side : '攻撃');
/* この部隊(攻撃部隊・防御部隊)で使うスキルか。「攻撃・防御」はどちらでも使う */
const forMode = d => skillSide(d) !== MD().opp;
/* 攻撃と防御で値を分けた初期スキル:防御部隊では「(防)」の値を使う(空欄なら攻撃と同じ値) */
const SPLIT_FIELDS = ['base', 'coef', 'statBuff', 'mulNormal', 'mulLimit', 'totalBuff', 'tbCoef', 'troopAdd'];
function modeTr(d, t) {
  if (!t || mode !== 'def' || !splitOn(d)) return t;
  const o = { ...t };
  for (const f of SPLIT_FIELDS) if (hasV(t[f + 'D'])) o[f] = t[f + 'D'];
  return o;
}
const sw = d => ({ 攻撃: '攻', 防御: '防', '攻撃・防御': '攻・防' })[skillSide(d)];
/* 攻防に合わせた初期スキル列の名前(素攻バフ/素防バフ/素攻・防バフ など) */
/* 初期スキルの効果のチェック:素攻バフ・倍枠(通常・極限)・総攻バフ・兵数加算。チェックした効果の列だけTR表に出す。
   未保存の古いデータは、値が入っているか(1以外か)で判定する */
const EFFS = [
  ['stat', '素攻バフ', ['statBuff']],
  ['mul', '倍枠', ['mulNormal', 'mulLimit']],
  ['total', '総攻バフ', ['totalBuff']],
  ['troop', '兵数加算', ['troopAdd']],
];
/* スキル・初期スキル共通の特殊効果:チェックするとTR表に数値の列が出る(無尽は計算に使う。飛翔・不屈・速度スキルは記録のみ) */
const EXTRA_EFFS = [
  ['muzin', '無尽'],
  ['hisho', '飛翔'],
  ['fukutsu', '不屈'],
  ['speed', '速度スキル'],
];
/* 特殊効果のチェック。保存したチェックを優先し、保存していない項目は値の入り方から決める */
const effsOf = d => ({ ...derivedEffs(d), ...(d?.effs || {}) });
const derivedEffs = d => {
  const tr = d?.trs || [],
    ne1 = f => tr.some(t => hasV(t[f]) && N(t[f]) !== 1),
    has = f => tr.some(t => hasV(t[f]));
  return {
    muzin: N(d?.muzin) > 0 || has('muzin'),
    hisho: has('hisho'),
    fukutsu: has('fukutsu'),
    speed: has('speed'),
    stat: ne1('statBuff'),
    mul: ne1('mulNormal') || ne1('mulLimit'),
    total: ne1('totalBuff') || tbByOf(d) === 'muzin',
    troop: tr.some(t => N(t.troopAdd) !== 0),
    self: false,
    leader: false,
    enemy: false,
    split: false,
  };
};
/* スキルの無尽(TRごと)。tr を省くと、いちばん大きい値。TRごとの値がない古いスキルは、スキル全体の無尽を使う */
function skillMuzin(d, tr) {
  if (!d || !effsOf(d).muzin) return 0;
  const trs = d.trs || [];
  if (!trs.some(t => hasV(t.muzin))) return N(d.muzin);
  if (tr == null) return Math.max(0, ...trs.map(t => N(t.muzin)));
  return N(trEntry(d, tr)?.muzin);
}
/* 攻撃と防御で値を分けるのは、攻撃or防御が「攻撃・防御」の初期スキルだけ */
const splitOn = d => toFlag(d?.init) === 1 && skillSide(d) === '攻撃・防御' && !!effsOf(d).split;
const effLabel = (d, k) =>
  k === 'stat' ? `素${sw(d)}バフ` : k === 'total' ? `総${sw(d)}バフ` : EFFS.find(x => x[0] === k)[1];
const skillValue = (t, n) => N(t.base) + N(t.coef) * (n == null ? N(config.people) : n);
/* 部隊の編成から n を数える。人数のときは null(=設定の人数) */
/* 部隊内で同じスキルを使っているところのTR(追加・極限スキルと、同じ初期スキルを持つ武将) */
function sameUses(id) {
  const out = [];
  if (!form || !id) return out;
  form.slots.forEach(s => {
    for (const k of ['s1', 's2', 'lim']) if (s[k].id === id) out.push(N(s[k].tr));
    const c = M.cards.get(s.card);
    if (c && skillByName(c.initName)?.id === id) out.push(N(s.tr));
  });
  return out;
}
/* 係数を部隊内のTRの最大値から取るか(係数の掛け方が「同じスキルの数」のとき) */
const coefMax = d => coefByOf(d) === 'same' && toFlag(d?.coefMaxTr) === 1;
const maxTrOf = id => {
  const u = sameUses(id);
  return u.length ? Math.max(...u) : null;
};
/* 部隊の中でのスキル上昇率:素スキル上昇率(自分のTR) + 係数(最大TRを参照するなら部隊内の最大TRの係数) × 数 */
function skillValueIn(t, d, id) {
  t = modeTr(d, t);
  const n = coefN(d, id);
  if (!coefMax(d) || n == null) return skillValue(t, n);
  const mt = maxTrOf(id),
    e = mt != null && modeTr(d, trEntry(d, mt));
  return N(t.base) + N(e ? e.coef : t.coef) * n;
}
/* 部隊内の飛翔の数:4人それぞれの、持っているスキル(初期・追加・極限)の飛翔のいちばん大きい値を、足したもの */
const hishoOf = (d, tr) => (d && effsOf(d).hisho ? N(trEntry(d, tr)?.hisho) : 0);
function hishoCount() {
  if (!form) return 0;
  return form.slots.reduce((a, s) => {
    const init = skillByName(M.cards.get(s.card)?.initName)?.d;
    const vals = [
      hishoOf(init, s.tr),
      ...['s1', 's2', 'lim'].map(k => hishoOf(M.skills.get(s[k].id), s[k].tr)),
    ];
    return a + Math.max(0, ...vals);
  }, 0);
}
function coefN(d, id) {
  const by = coefByOf(d);
  if (by === 'people' || !form) return null;
  if (by === 'same') return sameUses(id).length;
  if (by === 'hisho') return hishoCount();
  return Math.min(
    8,
    form.slots.reduce((a, s) => a + ['s1', 's2'].filter(k => isX(M.skills.get(s[k].id))).length, 0),
  );
}
/* 編成がない場面(マスタ一覧など)での表示 */
/* 模倣スキル:自模倣=自分の初期スキル、他真似=部隊長の初期スキル。部隊の中で計算した初期スキルの値(無尽×2後)× 模倣倍率。
   部隊長に付けた他真似は0。特殊効果は模倣しない。極限枠でも ×1.2 はかけない */
const MIMIC = { none: 'なし', self: '自模倣', leader: '他真似(部隊長)' };
const mimicOf = d => (MIMIC[d?.mimic] ? d.mimic : 'none');
const isMimic = d => mimicOf(d) !== 'none';
/* 模倣元の初期スキルの値。初期スキルが「模倣できない」なら0 */
const mimicBlocked = i => {
  const c = M.cards.get(form?.slots[i]?.card);
  return toFlag(skillByName(c?.initName)?.d.noMimic) === 1;
};
function slotInit(i) {
  const s = form?.slots[i];
  if (!s || mimicBlocked(i)) return 0;
  const { c, t } = slotEff(i);
  return c && t ? initEff(c, t) : 0;
}
const mimicSrc = (d, i) => (mimicOf(d) === 'self' ? i : i === 0 ? null : 0);
function skillLabel(t, d) {
  if (isMimic(d)) return `${N(t.base) ? fmt(N(t.base), 1) + '+' : ''}模倣×${fmt(N(t.mimicRate), 2)}`;
  return skillLabelBase(t, d);
}
function skillLabelBase(t, d) {
  const by = coefByOf(d);
  return by === 'people'
    ? fmt(skillValue(t), 1)
    : `${fmt(N(t.base), 1)}+${fmt(N(t.coef), 2)}×${COEF_SHORT[by]}`;
}

/* ---------- 計算 ---------- */
function skillVal(sel, i) {
  const s = M.skills.get(sel.id);
  if (!s || !forMode(s)) return 0;
  const t = trEntry(s, sel.tr);
  if (!t) return 0;
  if (!isMimic(s)) return skillValueIn(t, s, sel.id);
  const v = N(t.base);
  /* 模倣スキル = 素スキル上昇率 + 模倣倍率 × 模倣元の初期スキル。部隊長に付けた他真似は0 */
  const src = mimicSrc(s, i);
  return src == null ? 0 : v + N(t.mimicRate) * slotInit(src);
}
const limX = sel => (isMimic(M.skills.get(sel.id)) ? 1 : 1.2);
/* 無尽でスキル効果が何倍になるか(k: s1 / s2 / lim) */
function muzinMul(sel, k) {
  if (!muzinOn()) return 1;
  if (k === 'lim') return 2;
  const s = M.skills.get(sel.id);
  return skillMuzin(s, sel.tr) > 0 ? 2 : 1;
}
/* 重複上限(スキルの特殊効果のチェック「重複上限」):部隊内で同じスキルが付いていても、効果が出るのは
   倍枠などをかけたあとの実際の上昇値が高い順に、上限の数まで。数(Xスキルの数・同じスキルの数)は全部数える。
   特殊効果(黎天列光・火焔武闘)は倍枠で変わらないので、上限の数まで */
const dupOn = d =>
  d?.effs?.dup != null ? !!d.effs.dup : hasV(d?.dupMax) || (d?.trs || []).some(t => hasV(t.dupMax));
/* 重複上限はスキル全体で1つ(TRに左右されない)。TRごとに持っていた古いデータは、いちばん大きい値を使う */
const skillDupMax = d =>
  hasV(d?.dupMax) ? N(d.dupMax) : Math.max(0, ...(d?.trs || []).map(t => N(t.dupMax)));
/* 部隊内でこのスキルが付いているところ。withInit なら、このスキルを初期スキルに持つ武将(k='init')も入れる */
function dupInstances(id, withInit) {
  const out = [];
  if (!form) return out;
  form.slots.forEach((s, i) => {
    for (const k of ['s1', 's2', 'lim']) if (s[k].id === id) out.push({ i, k, sel: s[k] });
    if (withInit && skillByName(M.cards.get(s.card)?.initName)?.id === id)
      out.push({ i, k: 'init', sel: { id, tr: s.tr } });
  });
  return out;
}
function dupLimit(d) {
  return dupOn(d) && skillDupMax(d) > 0 ? skillDupMax(d) : null;
}
/* 効果を出さない枠の集合("i:k"。初期スキルは k='init') */
function dupDropped() {
  const drop = new Set();
  if (!form) return drop;
  const ids = new Set(
    form.slots
      .flatMap(s => [s.s1.id, s.s2.id, s.lim.id, skillByName(M.cards.get(s.card)?.initName)?.id])
      .filter(Boolean),
  );
  for (const id of ids) {
    const d = M.skills.get(id),
      inst = dupInstances(id, true),
      L = dupLimit(d);
    if (L == null || inst.length <= L) continue;
    const val = x => {
      const t = slotEff(x.i).t;
      if (x.k === 'init') return t ? initEff(slotEff(x.i).c, t) : 0;
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
/* 特殊効果の数:重複上限があればその数まで、なければ従来どおり2つまで */
function spCount(name) {
  const id = findId(M.skills, d => d.name === name);
  if (!id || !form) return 0;
  const inst = dupInstances(id),
    L = dupLimit(M.skills.get(id));
  return Math.min(L ?? 2, inst.length);
}

/* ---------- 保存するときの形(画面から保存するとき) ---------- */
/* スキル:種類(スキル/初期スキル)・模倣・特殊効果のチェックに合わせて、使う項目だけを残す */
function normalizeSkill(d) {
  return {
    init: toFlag(d.init),
    side: skillSide(d),
    ...(coefByOf(d) === 'same' && toFlag(d.coefMaxTr) ? { coefMaxTr: 1 } : {}),
    ...(!toFlag(d.init) && isMimic(d) ? { mimic: mimicOf(d) } : {}),
    ...(toFlag(d.init) ? { noMimic: toFlag(d.noMimic) } : {}),
    name: String(d.name).trim(),
    muzin: effsOf(d).muzin ? Math.max(0, ...d.trs.map(t => N(t.muzin))) : 0,
    xskill: toFlag(d.init) ? 0 : toFlag(d.xskill),
    noAdd: toFlag(d.noAdd),
    coefBy: coefByOf(d),
    ...(dupOn(d) ? { dupMax: skillDupMax(d) || 2 } : {}),
    trs: trsOf({
      trs: d.trs.map(t => {
        const o = Object.fromEntries(SKILL_TR.map(([f]) => [f, N(t[f])]));
        if (!toFlag(d.init) && isMimic(d)) {
          o.mimicRate = N(t.mimicRate);
          o.coef = 0;
        }
        for (const [k] of EXTRA_EFFS) if (effsOf(d)[k] && hasV(t[k])) o[k] = N(t[k]);
        if (toFlag(d.init)) {
          const ef = effsOf(d);
          for (const [k, , fs] of EFFS) if (ef[k]) for (const f of fs) if (hasV(t[f])) o[f] = N(t[f]);
          if (ef.total && tbByOf(d) === 'muzin') o.tbCoef = N(t.tbCoef);
          /* 攻撃と防御で値を分けるときは、使っている項目の(防)の値も保存する */
          if (splitOn(d))
            for (const f of SPLIT_FIELDS)
              if (o[f] !== undefined && hasV(t[f + 'D'])) o[f + 'D'] = N(t[f + 'D']);
        }
        return o;
      }),
    }),
    ...(toFlag(d.init)
      ? {
          tbBy: effsOf(d).total ? tbByOf(d) : 'fixed',
          effs: { ...effsOf(d), split: splitOn(d), dup: dupOn(d) },
        }
      : { effs: { dup: dupOn(d), ...extraEffs(d) } }),
  };
}
const extraEffs = d => Object.fromEntries(EXTRA_EFFS.map(([k]) => [k, !!effsOf(d)[k]]));
