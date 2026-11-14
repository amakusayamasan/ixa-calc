// スキルの値のルール(係数の掛け方、攻撃or防御、初期スキルの特殊効果のチェック、模倣、無尽の倍率、重複上限、保存するときの形)
// 使うファイル:core.js、fields.js、cards.js、unit.js(調べ方:node tests/deps.js)
/* スキル上昇率 = 素スキル上昇率 + 係数 × n
   n はスキルごとの「係数の掛け方」で決まる:人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数 */
const COEF_BY = {
  people: '人数',
  same: '部隊内の同じスキルの数',
  x: '部隊内のXスキルの数',
  hisho: '部隊内の飛翔の数',
  speed: '部隊移動速度/係数',
  cost: '敵武将の総コスト',
};
const COEF_SHORT = {
  people: '人数',
  same: '同スキル数',
  x: 'Xスキル数',
  hisho: '飛翔数',
  speed: '移動速度',
  cost: '総コスト',
};
/* 初期スキルの総攻・防バフの掛け方:固定、または 総攻・防バフ + 無尽を持つ武将数 × 総攻・防バフ係数 ÷ 100 × 無尽2倍 */
const TB_BY = {
  fixed: '固定',
  muzin: '無尽を持つ武将数',
  hime: '部隊内の姫の数',
  branch: '部隊内の対象兵科・兵種の数',
};
const tbByOf = d => (TB_BY[d?.tbBy] ? d.tbBy : 'fixed');
/* 総攻・総防バフに「係数 × 数」を足す掛け方か(無尽を持つ武将数・部隊内の姫の数) */
const tbCoefOn = d => tbByOf(d) !== 'fixed';
/* 部隊内の姫の数・対象兵科の数に、自分も数えるか(初期値は数える。himeSelf は前の名前) */
const tbCounts = d => ['hime', 'branch'].includes(tbByOf(d));
const tbSelfOf = d => toFlag(d?.tbSelf ?? d?.himeSelf ?? 1) === 1;
/* 部隊内の対象兵科・兵種の数で数える兵科(兵種マスタの兵科名)と兵種(兵種名) */
const tbBranchesOf = d => (Array.isArray(d?.tbBranches) ? d.tbBranches : []);
const tbSoldiersOf = d => (Array.isArray(d?.tbSoldiers) ? d.tbSoldiers : []);
/* 「自身のもつ兵種」:このスキルを持つ武将が選んでいる兵種と同じ兵種の武将も数える */
const tbOwnOf = d => toFlag(d?.tbOwn) === 1;
const coefByOf = d => (COEF_BY[d?.coefBy] ? d.coefBy : 'people');
const isX = d => toFlag(d?.xskill) === 1;
/* スキルの攻防:攻撃 / 防御 / 攻撃・防御。値は1組だけ持ち、攻撃部隊では「防御」スキルの値を使わない(未設定は攻撃) */
const SIDES = ['攻撃', '防御', '攻撃・防御'];
const skillSide = d => (SIDES.includes(d?.side) ? d.side : '攻撃');
/* この部隊(攻撃部隊・防御部隊)で使うスキルか。「攻撃・防御」はどちらでも使う */
const forMode = d => skillSide(d) !== MD().opp;
/* 攻撃と防御で値を分けたスキル(初期スキル・追加スキル):防御部隊では「(防)」の値を使う(空欄なら攻撃と同じ値)。
   追加スキルで分けるのは素スキル上昇率と係数だけ */
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
    total: ne1('totalBuff') || tbCoefOn(d),
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
/* 攻撃と防御で値を分けるのは、攻撃or防御が「攻撃・防御」のスキル(模倣スキルは模倣元の初期スキルに従うので分けない) */
const splitOn = d =>
  skillSide(d) === '攻撃・防御' && !!effsOf(d).split && (toFlag(d?.init) === 1 || !isMimic(d));
const effLabel = (d, k) =>
  k === 'stat' ? `素${sw(d)}バフ` : k === 'total' ? `総${sw(d)}バフ` : EFFS.find(x => x[0] === k)[1];
const skillValue = (t, n) => N(t.base) + N(t.coef) * (n == null ? N(config.people) : n);
/* 敵武将の総コスト = 平均コスト × 人数(どちらも全員共通の設定) */
const enemyCost = () => N(config.avgCost) * N(config.people);
/* 係数を部隊内のTRの最大値から取るか(係数の掛け方が「同じスキルの数」のとき) */
const coefMax = d => coefByOf(d) === 'same' && toFlag(d?.coefMaxTr) === 1;
/* 部隊の中でのスキル上昇率(n の数え方は unit.js の coefN):素スキル上昇率(自分のTR) + 係数(最大TRを参照するなら部隊内の最大TRの係数) × 数 */
function skillValueIn(t, d, id) {
  t = modeTr(d, t);
  const n = coefN(d, id);
  if (coefByOf(d) === 'speed') return speedValue(t, n);
  if (!coefMax(d) || n == null) return skillValue(t, n);
  const mt = maxTrOf(id),
    e = mt != null && modeTr(d, trEntry(d, mt));
  return N(t.base) + N(e ? e.coef : t.coef) * n;
}
/* 係数の掛け方が「部隊移動速度/係数」のスキル:素スキル上昇率 + 部隊移動速度 ÷ 係数 × 100 */
const speedValue = (t, n) => N(t.base) + (N(t.coef) ? ((n ?? 0) / N(t.coef)) * 100 : 0);
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
  if (by === 'speed') return `${N(t.base) ? fmt(N(t.base), 1) + '+' : ''}移動速度÷${fmt(N(t.coef), 2)}×100`;
  if (by === 'cost') return fmt(skillValue(t, enemyCost()), 1);
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
/* 重複上限(スキルの特殊効果のチェック「重複上限」)の設定。部隊内でどれを外すかは unit.js */
const dupOn = d =>
  d?.effs?.dup != null ? !!d.effs.dup : hasV(d?.dupMax) || (d?.trs || []).some(t => hasV(t.dupMax));
/* 重複上限はスキル全体で1つ(TRに左右されない)。TRごとに持っていた古いデータは、いちばん大きい値を使う */
const skillDupMax = d =>
  hasV(d?.dupMax) ? N(d.dupMax) : Math.max(0, ...(d?.trs || []).map(t => N(t.dupMax)));
function dupLimit(d) {
  return dupOn(d) && skillDupMax(d) > 0 ? skillDupMax(d) : null;
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
        /* 追加スキルを攻撃と防御で分けるときは、素スキル上昇率・係数の(防)の値も保存する */
        if (!toFlag(d.init) && splitOn(d))
          for (const f of ['base', 'coef']) if (hasV(t[f + 'D'])) o[f + 'D'] = N(t[f + 'D']);
        if (toFlag(d.init)) {
          const ef = effsOf(d);
          for (const [k, , fs] of EFFS) if (ef[k]) for (const f of fs) if (hasV(t[f])) o[f] = N(t[f]);
          if (ef.total && tbCoefOn(d)) o.tbCoef = N(t.tbCoef);
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
          ...(effsOf(d).total && tbCounts(d) ? { tbSelf: tbSelfOf(d) ? 1 : 0 } : {}),
          ...(effsOf(d).total && tbByOf(d) === 'branch'
            ? { tbBranches: tbBranchesOf(d), tbSoldiers: tbSoldiersOf(d), tbOwn: tbOwnOf(d) ? 1 : 0 }
            : {}),
          effs: { ...effsOf(d), split: splitOn(d), dup: dupOn(d) },
        }
      : { effs: { dup: dupOn(d), split: splitOn(d), ...extraEffs(d) } }),
  };
}
const extraEffs = d => Object.fromEntries(EXTRA_EFFS.map(([k]) => [k, !!effsOf(d)[k]]));
