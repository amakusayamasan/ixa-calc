// 古い形式のデータを読むための処理(ここ以外のファイルには、古い形式の読み方を書かない)
// 使うファイル:core.js、fields.js、cards.js(調べ方:node tests/deps.js)
//
// 以前の版では、次の値を別の場所に持っていた。今の画面から保存すると今の形式になるので、これらは
// 「まだ今の形式で保存し直されていないデータ」を読むときだけ使う。
//   ・武将マスタのTRごとの値(初期スキル・素攻バフ・倍枠・総攻バフ)と無尽 → 今はスキルマスタの初期スキルに持つ
//   ・スキルの「種類」が保存されていないスキル → 値の入り方から初期スキルかどうかを推定する
//   ・傑バフの「攻撃力・防御力」 → 今は「所属時攻撃力・所属時防御力」
// legacyUsage() で、まだ古い形式を使っているデータを数えられる(管理者のマスタ管理画面に表示)。
// 0件になったら、このファイルと呼び出し箇所は消してよい。

/* 以前の武将マスタのTR表の列 */
const CARD_TR = [
  ['tr', 'TR'],
  ['initSkill', '初期スキル'],
  ['statBuff', '素攻・防バフ'],
  ['mulNormal', '倍枠通常'],
  ['mulLimit', '倍枠極限'],
  ['totalBuff', '総攻・防バフ'],
];
const CARD_DEFAULT_TR = { tr: 0, initSkill: 0, statBuff: 1, mulNormal: 1, mulLimit: 1, totalBuff: 1 };
/* 初期スキルがスキルマスタにない武将のTR(以前の武将マスタの値。なければTR0・バフ1) */
function legacyCardTrs(c) {
  const t = trsOf(c);
  return t.length ? t : [{ ...CARD_DEFAULT_TR }];
}
/* 初期スキルに値がない項目を、以前の武将マスタの同じTRの値で補う(なければ1) */
const legacyCardValue = (c, tr, f) => {
  const old = trEntry(c, tr);
  return old && hasV(old[f]) ? N(old[f]) : 1;
};
const legacyInitSkill = (c, tr) => N(trEntry(c, tr)?.initSkill);
/* 初期スキルがスキルマスタにない武将の無尽 */
const legacyCardMuzin = c => N(c.muzin);
/* 種類が保存されていないスキル:素攻・防バフ〜総攻・防バフが入っているか、初期スキル名に使われていれば初期スキル */
const legacyIsInitSkill = d =>
  (d.trs || []).some(t => SKILL_INIT.some(([f]) => t[f] != null && t[f] !== '')) ||
  [...M.cards.values()].some(c => String(c.initName ?? '').trim() === String(d.name ?? '').trim());
/* 傑バフの古い「攻撃力・防御力」 */
const legacyJbuffValue = (d, f) => (f === 'atkIn' ? d.atk : f === 'defIn' ? d.def : 0);
/* 以前の武将マスタのTRの値を、初期スキル追加画面の最初の値にする */
const legacyInitTrs = card =>
  trsOf(card).map(t => ({
    tr: N(t.tr),
    base: N(t.initSkill),
    coef: 0,
    statBuff: N(t.statBuff),
    mulNormal: N(t.mulNormal),
    mulLimit: N(t.mulLimit),
    totalBuff: N(t.totalBuff),
  }));

/* まだ古い形式を使っているデータ(名前の一覧) */
function legacyUsage() {
  const cards = [],
    skills = [],
    jbuffs = [];
  for (const c of M.cards.values()) {
    const sk = skillByName(c.initName);
    if (!sk && (c.trs || c.muzin != null))
      cards.push(`${c.name}(初期スキル「${c.initName || '未入力'}」がスキルマスタにない)`);
    else if (sk && (c.trs !== undefined || c.muzin !== undefined))
      cards.push(`${c.name}(以前のTRの値・無尽が残っている)`);
  }
  for (const d of M.skills.values())
    if (d.init == null || d.init === '') skills.push(`${d.name}(種類が未保存)`);
  for (const j of M.jbuffs.values())
    if (j.atk !== undefined || j.def !== undefined) jbuffs.push(`${j.name}(古い攻撃力・防御力)`);
  return { cards, skills, jbuffs, n: cards.length + skills.length + jbuffs.length };
}
