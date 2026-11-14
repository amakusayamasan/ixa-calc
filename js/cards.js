// 武将と初期スキルのルール(武将のTR、初期スキルの効果、無尽部隊、部隊長限定、傑バフ、保存するときの形)
// 使うファイル:core.js、fields.js、skills.js(調べ方:node tests/deps.js)
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
  if (sk && !forMode(sk.d)) return 0;
  if (sk) {
    const e = trEntry(sk.d, t?.tr);
    if (e) return skillValueIn(e, sk.d, sk.id);
  }
  return 0;
}
/* 武将のTRごとの値は、初期スキル(スキルマスタ)のTRから作る。
   チェックしていない特殊効果は1倍。初期スキルがスキルマスタにない武将は、TR0・初期スキル0・バフ1 */
const CARD_DEFAULT_TR = { tr: 0, statBuff: 1, mulNormal: 1, mulLimit: 1, totalBuff: 1 };
function cardTrs(c) {
  if (!c) return [];
  const sk = skillByName(c.initName),
    st = sk ? trsOf(sk.d) : [];
  if (st.length)
    return st.map(e0 => {
      const e = modeTr(sk.d, e0),
        o = { tr: N(e.tr) };
      for (const [f] of SKILL_INIT) o[f] = hasV(e[f]) ? N(e[f]) : 1;
      if (hasV(e.troopAdd)) o.troopAdd = N(e.troopAdd);
      {
        const ef = sk.d.effs || {};
        if (ef.leader) o.leaderOnly = true;
        if (ef.self) o.selfStat = true;
        if (ef.enemy) o.enemyAdd = true;
      }
      /* この部隊で使わない側の初期スキル(攻撃部隊での防御スキルなど)は、素バフ・総バフを使わない(倍枠は共通) */
      if (!forMode(sk.d)) {
        o.statBuff = 1;
        o.totalBuff = 1;
      } else if (tbByOf(sk.d) === 'muzin') o.tbCoef = N(e.tbCoef);
      return o;
    });
  return [{ ...CARD_DEFAULT_TR }];
}
const cardV = c => c && { ...c, trs: cardTrs(c) };
function cardT(c, tr) {
  return cardTrs(c).find(t => N(t.tr) === N(tr));
}
/* 武将が無尽を持つか:初期スキル(スキルマスタ)の無尽で決める */
const cardMuzin = (c, tr) => {
  if (!c) return 0;
  const sk = skillByName(c.initName);
  return sk ? skillMuzin(sk.d, tr) : 0;
};
function initEff(c, t) {
  if (t?.loOff) return 0;
  const v = initBase(c, t);
  if (!muzinOn() || c?.rarity === '傑') return v;
  if (cardMuzin(c, t?.tr) > 0) return coefByOf(skillByName(c?.initName)?.d) === 'speed' ? v : v * 2;
  return 0;
}
/* 無尽が有効で、初期スキルに無尽がない武将は、初期スキル由来の効果がすべて無効:
   総攻バフ・素攻バフ・倍枠通常・倍枠極限を1(等倍)として扱う */
const muzinVoid = (c, tr) => muzinOn() && !!c && c.rarity !== '傑' && !(cardMuzin(c, tr) > 0);
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
  if (!muzinVoid(c, t.tr)) return t;
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
/* 外部からかけられるのは、外部の値(攻撃部隊なら外部攻撃力、防御部隊なら外部防御力)が0より大きい傑バフだけ */
const jbHasOuter = d => jv(d, MD().jbOut) > 0;
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
    jbInUnit().reduce((a, d) => a + (jbHits(d, sname) ? jv(d, MD().jbIn) : 0), 0) +
    jbOuter().reduce((a, d) => a + (jbHits(d, sname) ? jv(d, MD().jbOut) : 0), 0)
  );
}
/* 武将:項目の型をそろえる */
function normalizeCard(d) {
  const o = {};
  for (const [f, , t] of CARD_FIELDS)
    o[f] =
      t === 'flag' || t === 'check' ? toFlag(d[f]) : t === 'number' ? N(d[f]) : String(d[f] ?? '').trim();
  return o;
}
