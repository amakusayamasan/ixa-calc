// マスタの項目の定義(武将・スキル・兵種・傑バフの入力項目、選択肢、並び順)
// 使うファイル:core.js、skills.js(調べ方:node tests/deps.js)
/* flag は 0/1 の選択。姫:0=姫ではない 1=姫。無尽は数値(0=なし、1以上=あり) */
const FLAG_LABELS = {
  noMimic: ['模倣できる', '模倣できない'],
  init: ['スキル', '初期スキル'],
  hime: ['姫ではない', '姫'],
  xskill: ['該当しない', 'Xスキル'],
  noAdd: ['付与できる', '付与できない'],
};
const RARITIES = ['覇・天', '天', '極', '傑'];
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
 */
const isInitSkill = d => toFlag(d.init) === 1;
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
const jv = (d, f) => N(d[f]);
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
/* 初期スキルにしかない、TRごとの項目 */
const INIT_TR_FIELDS = () => [
  ...SKILL_INIT.map(([f]) => f),
  'troopAdd',
  'tbCoef',
  ...SPLIT_FIELDS.map(f => f + 'D'),
];
