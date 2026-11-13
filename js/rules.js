// 武将・スキルのルール(項目の定義、初期スキルの効果、模倣、重複上限、傑バフなど)
/* スキル上昇率 = 素スキル上昇率 + 係数 × n
   n はスキルごとの「係数の掛け方」で決まる:人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数 */
const COEF_BY = { people: '人数', same: '部隊内の同じスキルの数', x: '部隊内のXスキルの数' };
const COEF_SHORT = { people: '人数', same: '同スキル数', x: 'Xスキル数' };
/* 初期スキルの総攻・防バフの掛け方:固定、または 総攻・防バフ + 無尽を持つ武将数 × 総攻・防バフ係数 ÷ 100 × 無尽2倍 */
const TB_BY = { fixed: '固定', muzin: '無尽を持つ武将数' };
const tbByOf = d => (TB_BY[d?.tbBy] ? d.tbBy : 'fixed');
const coefByOf = d => (COEF_BY[d?.coefBy] ? d.coefBy : 'people');
const isX = d => toFlag(d?.xskill) === 1;
/* スキルの攻防:攻撃 / 防御 / 攻撃・防御。値は1組だけ持ち、攻撃部隊では「防御」スキルの値を使わない(未設定は攻撃) */
const SIDES = ['攻撃', '防御', '攻撃・防御'];
const skillSide = d => (SIDES.includes(d?.side) ? d.side : '攻撃');
const forAtk = d => skillSide(d) !== '防御';
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
const effsOf = d => {
  if (d?.effs) return { ...d.effs };
  const tr = d?.trs || [],
    ne1 = f => tr.some(t => hasV(t[f]) && N(t[f]) !== 1);
  return {
    stat: ne1('statBuff'),
    mul: ne1('mulNormal') || ne1('mulLimit'),
    total: ne1('totalBuff') || tbByOf(d) === 'muzin',
    troop: tr.some(t => N(t.troopAdd) !== 0),
    self: false,
    leader: false,
  };
};
const effLabel = (d, k) =>
  k === 'stat' ? `素${sw(d)}バフ` : k === 'total' ? `総${sw(d)}バフ` : EFFS.find(x => x[0] === k)[1];
const initCols = d => {
  const e = effsOf(d),
    cols = [...SKILL_INIT, TROOP_ADD].map(([f, l]) => [
      f,
      f === 'statBuff' ? `素${sw(d)}バフ` : f === 'totalBuff' ? `総${sw(d)}バフ` : l,
    ]);
  return cols.filter(([f]) => EFFS.some(([k, , fs]) => e[k] && fs.includes(f)));
};
/* 兵数加算:この初期スキルを持つ武将がいると、同じ部隊の他の武将の兵数に足す */
const TROOP_ADD = ['troopAdd', '兵数加算'];
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
  const n = coefN(d, id);
  if (!coefMax(d) || n == null) return skillValue(t, n);
  const mt = maxTrOf(id),
    e = mt != null && trEntry(d, mt);
  return N(t.base) + N(e ? e.coef : t.coef) * n;
}
function coefN(d, id) {
  const by = coefByOf(d);
  if (by === 'people' || !form) return null;
  if (by === 'same') return sameUses(id).length;
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
const findId = (map, pred) => {
  for (const [id, d] of map) if (pred(d)) return id;
  return '';
};

/* ---------- 計算 ---------- */
function skillVal(sel, i) {
  const s = M.skills.get(sel.id);
  if (!s || !forAtk(s)) return 0;
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
  return s && N(s.muzin) > 0 ? 2 : 1;
}
/* 初期スキルの効果(無尽を反映) */
/* 傑カードは無尽のルールの対象外:初期スキルはそのまま発動し、バフや倍枠も無効にならない */
/* 初期スキルの元の値:初期スキル名がスキルマスタにあれば、武将のTRと同じTRのスキル上昇率。なければ武将マスタのTRごとの値 */
const skillByName = n => {
  const k = String(n ?? '').trim();
  if (!k) return null;
  const id = findId(M.skills, d => String(d.name).trim() === k);
  return id ? { id, d: M.skills.get(id) } : null;
};
function initBase(c, t) {
  const sk = skillByName(c?.initName);
  if (sk && !forAtk(sk.d)) return 0;
  if (sk) {
    const e = trEntry(sk.d, t?.tr);
    if (e) return skillValueIn(e, sk.d, sk.id);
  }
  return N(t?.initSkill);
}
/* 武将のTRごとの値は、初期スキル(スキルマスタ)のTRから作る。
   初期スキルがスキルマスタにない武将だけ、以前武将マスタに登録したTRの値(なければTR0・バフ1)を使う */
const hasV = v => v != null && String(v).trim() !== '';
function cardTrs(c) {
  if (!c) return [];
  const sk = skillByName(c.initName),
    st = sk ? trsOf(sk.d) : [];
  if (st.length)
    return st.map(e => {
      const o = { tr: N(e.tr), initSkill: legacyInitSkill(c, e.tr) };
      for (const [f] of SKILL_INIT) o[f] = hasV(e[f]) ? N(e[f]) : legacyCardValue(c, e.tr, f);
      /* 防御スキルの素防バフ・総防バフは攻撃部隊では使わない(倍枠は共通) */
      if (hasV(e.troopAdd)) o.troopAdd = N(e.troopAdd);
      {
        const ef = sk.d.effs || {};
        if (ef.leader) o.leaderOnly = true;
        if (ef.self) o.selfStat = true;
      }
      if (!forAtk(sk.d)) {
        o.statBuff = 1;
        o.totalBuff = 1;
      } else if (tbByOf(sk.d) === 'muzin') o.tbCoef = N(e.tbCoef);
      return o;
    });
  return legacyCardTrs(c);
}
const cardV = c => c && { ...c, trs: cardTrs(c) };
function cardT(c, tr) {
  return cardTrs(c).find(t => N(t.tr) === N(tr));
}
/* 武将が無尽を持つか:初期スキル(スキルマスタ)の無尽で決める。初期スキルがスキルマスタにない武将だけ、以前の武将マスタの無尽を使う */
const cardMuzin = c => {
  if (!c) return 0;
  const sk = skillByName(c.initName);
  return sk ? N(sk.d.muzin) : legacyCardMuzin(c);
};
function initEff(c, t) {
  if (t?.loOff) return 0;
  const v = initBase(c, t);
  if (!muzinOn() || c?.rarity === '傑') return v;
  return cardMuzin(c) > 0 ? v * 2 : 0;
}
/* 無尽が有効で、初期スキルに無尽がない武将は、初期スキル由来の効果がすべて無効:
   総攻バフ・素攻バフ・倍枠通常・倍枠極限を1(等倍)として扱う */
const muzinVoid = c => muzinOn() && !!c && c.rarity !== '傑' && !(cardMuzin(c) > 0);
/* 部隊長限定の初期スキル:部隊長の枠にいないときは、初期スキルの効果(スキル上昇率・バフ・倍枠・兵数加算)がすべて出ない */
function slotEff(i) {
  const s = form?.slots[i];
  const c = s && M.cards.get(s.card),
    raw = c && cardT(c, s.tr);
  let t = c && effT(c, raw);
  if (t && raw?.leaderOnly && i !== 0)
    t = { ...t, statBuff: 1, totalBuff: 1, mulNormal: 1, mulLimit: 1, loOff: true };
  return { c, raw, t };
}
function effT(c, t) {
  if (!t) return t;
  if (!muzinVoid(c)) return t;
  return { ...t, statBuff: 1, totalBuff: 1, mulNormal: 1, mulLimit: 1 };
}
/* 傑バフ
   ・所属時:その傑カード(カードNoが同じ武将)が部隊長・小隊長のどこかの枠にいれば自動でかかる
   ・外部:傑バフボタンで選んだものがかかる
   ・両方当てはまれば、所属時と外部の値をすべて合計する。対象兵種が空なら全兵種に効く */
const jbFind = no => {
  const id = findId(M.jbuffs, d => String(d.no) === String(no));
  return id ? M.jbuffs.get(id) : null;
};
/* 外部からかけられるのは、外部攻撃力が0より大きい傑バフだけ */
const jbHasOuter = d => jv(d, 'atkOut') > 0;
const jbOuter = () => (form?.jb || []).map(no => jbFind(no)).filter(d => d && jbHasOuter(d));
const jbInUnit = () => {
  if (!form) return [];
  const nos = new Set(
    form.slots
      .map(s => M.cards.get(s.card)?.no)
      .filter(v => v != null)
      .map(String),
  );
  return [...M.jbuffs.values()].filter(d => nos.has(String(d.no)));
};
const jbHits = (d, sname) => !(d.targets && d.targets.length) || (sname && d.targets.includes(sname));
function jbBonus(sname) {
  if (!sname) return 0;
  return (
    jbInUnit().reduce((a, d) => a + (jbHits(d, sname) ? jv(d, 'atkIn') : 0), 0) +
    jbOuter().reduce((a, d) => a + (jbHits(d, sname) ? jv(d, 'atkOut') : 0), 0)
  );
}
/* 重複上限(スキルの特殊効果のチェック「重複上限」):部隊内で同じスキルが付いていても、効果が出るのは
   倍枠などをかけたあとの実際の上昇値が高い順に、上限の数まで。数(Xスキルの数・同じスキルの数)は全部数える。
   特殊効果(黎天列光・火焔武闘)は倍枠で変わらないので、上限の数まで */
const dupOn = d => (d?.effs?.dup != null ? !!d.effs.dup : (d?.trs || []).some(t => hasV(t.dupMax)));
function dupInstances(id) {
  const out = [];
  if (!form) return out;
  form.slots.forEach((s, i) => {
    for (const k of ['s1', 's2', 'lim']) if (s[k].id === id) out.push({ i, k, sel: s[k] });
  });
  return out;
}
function dupLimit(d, inst) {
  if (!dupOn(d)) return null;
  const ls = inst.map(x => N(trEntry(d, x.sel.tr)?.dupMax)).filter(v => v > 0);
  return ls.length ? Math.max(...ls) : null;
}
/* 効果を出さない枠の集合("i:k") */
function dupDropped() {
  const drop = new Set();
  if (!form) return drop;
  const ids = new Set(form.slots.flatMap(s => [s.s1.id, s.s2.id, s.lim.id]).filter(Boolean));
  for (const id of ids) {
    const d = M.skills.get(id),
      inst = dupInstances(id),
      L = dupLimit(d, inst);
    if (L == null || inst.length <= L) continue;
    const val = x => {
      const t = slotEff(x.i).t;
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
    L = dupLimit(M.skills.get(id), inst);
  return Math.min(L ?? 2, inst.length);
}

/* ---------- マスタ一覧 ---------- */
/* flag は 0/1 の選択。姫:0=姫ではない 1=姫。無尽は数値(0=なし、1以上=あり) */
const FLAG_LABELS = {
  noMimic: ['模倣できる', '模倣できない'],
  init: ['スキル', '初期スキル'],
  hime: ['姫ではない', '姫'],
  xskill: ['該当しない', 'Xスキル'],
  noAdd: ['付与できる', '付与できない'],
};
const RARITIES = ['覇・天', '天', '極', '傑'];
const toFlag = v => {
  if (v == null) return 0;
  const t = String(v).trim();
  if (t === '' || t === '0' || /^(false|no|なし|いいえ|×|✕|-|—)$/i.test(t) || /(ではない|しない)$/.test(t))
    return 0;
  return 1;
};
const CARD_FIELDS = [
  ['no', 'カードNo', 'number'],
  ['rarity', 'レアリティ', 'rarity'],
  ['cost', '武将コスト', 'number'],
  ['side', '攻撃or防御', 'side'],
  ['name', 'カード名', 'text'],
  ['initName', '初期スキル名', 'text'],
  ['troops', '兵数', 'number'],
  ['baseStat', '素攻撃力', 'number'],
  ['baseDef', '素防御力', 'number'],
  ['growth', '攻撃上昇率', 'number'],
  ['growthDef', '防御上昇率', 'number'],
  ['hime', '姫', 'check'],
  ['kengou', '剣豪', 'check'],
];
const SKILL_TR = [
  ['tr', 'TR'],
  ['base', '素スキル上昇率'],
  ['coef', '係数'],
];
/* 初期スキルとしての効果(素攻・防バフ、倍枠、総攻・防バフ)。空欄なら武将マスタの値を使う */
const TB_COEF = ['tbCoef', '総攻・防バフ係数(%)'];
const SKILL_INIT = [
  ['statBuff', '素攻・防バフ'],
  ['mulNormal', '倍枠通常'],
  ['mulLimit', '倍枠極限'],
  ['totalBuff', '総攻・防バフ'],
];
/* スキルの種類:0=スキル(通常枠・極限枠に付けるもの)、1=初期スキル(武将が最初から持つもの)。
   init が未設定の古いデータは legacy.js で推定する */
const isInitSkill = d => (d.init != null && d.init !== '' ? toFlag(d.init) === 1 : legacyIsInitSkill(d));
const LABEL = { cards: '武将', skills: 'スキル', soldiers: '兵種', jbuffs: '傑バフ' };
/* 傑バフ:レアリティ「傑」の武将が持つ、兵種の攻撃力・防御力への加算値。カードNoで識別する
   その傑カードが部隊に所属しているときの値(atkIn/defIn)と、外からかかるときの値(atkOut/defOut)を持つ */
const JBUFF_FIELDS = [
  ['no', 'カードNo', 'number'],
  ['name', '武将名', 'text'],
  ['atkIn', '所属時攻撃力', 'number'],
  ['defIn', '所属時防御力', 'number'],
  ['atkOut', '外部攻撃力', 'number'],
  ['defOut', '外部防御力', 'number'],
];
const JBUFF_VALS = ['atkIn', 'defIn', 'atkOut', 'defOut'];
/* 対象兵種:バフがかかる兵種名の一覧。空なら全兵種 */
const splitTargets = v => [
  ...new Set(
    String(v ?? '')
      .split(/[、,，\/／\n]/)
      .map(x => x.trim())
      .filter(Boolean),
  ),
];
const targetsLabel = d => (d.targets && d.targets.length ? d.targets.join('、') : '全兵種');
/* 以前の形(atk/def だけ)で保存されたものは、所属時の値として扱う */
const jv = (d, f) => N(d[f] ?? legacyJbuffValue(d, f));
const byNo = (a, b) => N(a[1].no) - N(b[1].no) || byName(a, b);
/* 兵種:攻撃力は攻撃部隊、防御力は防御部隊の計算に使う。order は取り込んだシートの行順 */
const SOLDIER_FIELDS = [
  ['name', '兵種名', 'text'],
  ['branch', '兵科', 'text'],
  ['atk', '攻撃力', 'number'],
  ['def', '防御力', 'number'],
  ['destroy', '破壊', 'number'],
  ['speed', '速度', 'number'],
];
const bySoldierOrder = (a, b) => N(a[1].order ?? 9999) - N(b[1].order ?? 9999) || byName(a, b);
const trRange = d => {
  const t = trsOf(d);
  return t.length ? `TR${N(t[0].tr)}〜${N(t[t.length - 1].tr)}` : 'TRなし';
};

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
    muzin: N(d.muzin),
    xskill: toFlag(d.init) ? 0 : toFlag(d.xskill),
    noAdd: toFlag(d.noAdd),
    coefBy: coefByOf(d),
    trs: trsOf({
      trs: d.trs.map(t => {
        const o = Object.fromEntries(SKILL_TR.map(([f]) => [f, N(t[f])]));
        if (!toFlag(d.init) && isMimic(d)) {
          o.mimicRate = N(t.mimicRate);
          o.coef = 0;
        }
        if (!toFlag(d.init) && dupOn(d) && hasV(t.dupMax)) o.dupMax = N(t.dupMax);
        if (toFlag(d.init)) {
          const ef = effsOf(d);
          for (const [k, , fs] of EFFS) if (ef[k]) for (const f of fs) if (hasV(t[f])) o[f] = N(t[f]);
          if (ef.total && tbByOf(d) === 'muzin') o.tbCoef = N(t.tbCoef);
        }
        return o;
      }),
    }),
    ...(toFlag(d.init)
      ? { tbBy: effsOf(d).total ? tbByOf(d) : 'fixed', effs: effsOf(d) }
      : { effs: { dup: dupOn(d) } }),
  };
}
/* 武将:項目の型をそろえる。初期スキルがスキルマスタにない武将の、以前の無尽とTRの値は残す */
function normalizeCard(d) {
  const o = {};
  for (const [f, , t] of CARD_FIELDS)
    o[f] =
      t === 'flag' || t === 'check' ? toFlag(d[f]) : t === 'number' ? N(d[f]) : String(d[f] ?? '').trim();
  if (N(d.muzin) > 0)
    o.muzin = N(d.muzin); /* 以前の武将マスタの無尽(初期スキルがスキルマスタにない武将だけ使う) */
  if (Array.isArray(d.trs) && d.trs.length)
    o.trs = trsOf({ trs: d.trs.map(t => Object.fromEntries(CARD_TR.map(([f]) => [f, N(t[f])]))) });
  return o;
}
/* 初期スキルにしかない、TRごとの項目 */
const INIT_TR_FIELDS = () => [...SKILL_INIT.map(([f]) => f), 'troopAdd', 'tbCoef'];
