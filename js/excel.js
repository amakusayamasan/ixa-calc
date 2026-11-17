// Excelの取り込み・ダウンロード
// 使うファイル:core.js、fields.js、skills.js、unit.js、master.js、admin.js(調べ方:node tests/deps.js)
/* ---------- Excel取り込み ---------- */
let xlsxPromise = null;
function loadXLSX() {
  return (
    xlsxPromise ||
    (xlsxPromise = new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX);
      s.onerror = () => {
        xlsxPromise = null;
        ng(new Error('読み込み失敗'));
      };
      document.head.appendChild(s);
    }))
  );
}
function renderImport() {
  const box = $('importbox');
  if (!importPlan) {
    box.innerHTML = '';
    return;
  }
  if (importPlan === 'pick') {
    box.innerHTML = `<div class="import"><strong>Excelから取り込み</strong>
    <p class="note">「武将データ」「スキルデータ」「兵種データ」「バフデータ」シートを読み込みます(列はフォーマットのとおり)(あるシートだけで構いません)。武将とバフはカードNo、スキルはスキル名、兵種は兵種名が同じものを上書きし、それ以外はそのまま残します。素攻とスキル上昇率は取り込まず、この画面で計算し直します。</p>
    ${buttonRow(
      button('フォーマットをダウンロード(空)', 'data-imp="fmt"', 'btn small ghost'),
      button('今のマスタをダウンロード', 'data-imp="dump"', 'btn small ghost'),
    )}
    <p class="note">「今のマスタ」は、登録済みのデータが入った取り込み用のExcelです。直してそのまま取り込めます。</p>
    <input id="xfile" type="file" accept=".xlsx,.xlsm,.xls">
    <div style="display:flex;gap:8px">${button('やめる', 'data-imp="cancel"', 'btn ghost')}</div><p class="msg" id="impmsg"></p></div>`;
    return;
  }
  const p = importPlan;
  box.innerHTML = `<div class="import"><strong>取り込み内容の確認</strong><ul>
    <li>武将:${p.cards.length}枚 うち新規 ${p.cards.filter(c => !c.id).length}枚</li>
    <li>スキル:${p.skills.length}件 うち新規 ${p.skills.filter(c => !c.id).length}件</li>
    <li>兵種:${p.soldiers.length}件 うち新規 ${p.soldiers.filter(c => !c.id).length}件</li>
    <li>バフ:${p.jbuffs.length}件 うち新規 ${p.jbuffs.filter(c => !c.id).length}件</li>
    ${p.people != null ? `<li>人数:${p.people}</li>` : ''}${p.avgCost != null ? `<li>平均コスト:${p.avgCost}</li>` : ''}${p.warn.map(w => `<li style="color:var(--danger)">${esc(w)}</li>`).join('')}</ul>
    ${buttonRow(button('取り込む', 'data-imp="run"'), button('やめる', 'data-imp="cancel"', 'btn ghost'))}<p class="msg" id="impmsg"></p></div>`;
}
/* 取り込み用のExcelを作る(列名は取り込みと同じ)。withData=false なら見出しだけ */
const X_CARD = [
  'カードNo',
  'カード名',
  'レアリティ',
  '武将コスト',
  '攻撃or防御',
  '初期スキル名',
  '兵数',
  '素攻撃力',
  '素防御力',
  '攻撃上昇率',
  '防御上昇率',
  '姫',
  '剣豪',
];
/* 攻撃と防御で値を分ける初期スキルの、防御の列 */
const SPLIT_COL = {
  base: '素スキル上昇率(防)',
  coef: '係数(防)',
  statBuff: '素攻・防バフ(防)',
  mulNormal: '倍枠通常(防)',
  mulLimit: '倍枠極限(防)',
  totalBuff: '総攻・防バフ(防)',
  tbCoef: '総攻・防バフ係数(防)',
  troopAdd: '兵数加算(防)',
  mulNormalCoef: '倍枠係数(通常・防)',
  mulLimitCoef: '倍枠係数(極限・防)',
};
const X_SKILL = [
  'スキル名',
  '種類',
  '攻撃or防御',
  'スキル付与',
  '係数の掛け方',
  '係数最大TR参照',
  '無尽',
  'Xスキル',
  '総攻・防バフの掛け方',
  '模倣',
  '模倣可否',
  'TR',
  '素スキル上昇率',
  '係数',
  '模倣倍率',
  '重複上限',
  '素攻・防バフ',
  '素攻バフ本人のみ',
  '部隊長限定',
  '倍枠通常',
  '倍枠極限',
  '総攻・防バフ',
  '総攻・防バフ係数',
  '兵数加算',
  '敵火力加算',
  '攻防で値を分ける',
  ...SPLIT_FIELDS.map(f => SPLIT_COL[f]),
  '飛翔',
  '不屈',
  '速度スキル',
  '総攻・防バフの数に自身を含む',
  '総攻・防バフの対象兵科',
  '総攻・防バフの対象兵種',
  '総攻・防バフの自身のもつ兵種',
  '兵数加算に自身を含む',
  '兵数加算の対象',
  '倍枠の掛け方',
  '倍枠の数に自身を含む',
  '倍枠の対象兵科',
  '倍枠の対象兵種',
  '倍枠の自身のもつ兵種',
  '倍枠係数(通常)',
  '倍枠係数(極限)',
  '係数の数に自身を含む',
  '係数の対象兵科',
  '係数の対象兵種',
  '係数の自身のもつ兵種',
  'コスト減の減らし方',
  'コスト減',
  '兵士攻撃・防御力加算',
  '兵士加算の対象兵科',
  '兵士加算の対象兵種',
  '兵士加算の自身のもつ兵種',
  '兵数を最大に揃える',
  '効果の対象',
];
const X_SOLDIER = ['兵科', '兵種', '攻撃力', '防禦力', '破壊', '速度'];
/* A, B, …, Z, AA, … */
const colName = i => (i < 26 ? '' : colName(Math.floor(i / 26) - 1)) + String.fromCharCode(65 + (i % 26));
/* 「列の説明」シートの中身。空欄の列は使わない(その機能を使わないスキル)という意味 */
const HELP_SK = 'スキルデータ';
const COL_HELP = [
  ['武将データ', 'カードNo', '武将を見分ける番号(同じ番号は1つだけ)'],
  ['武将データ', '初期スキル名', 'スキルデータに登録した初期スキルの名前'],
  ['武将データ', '姫・剣豪', '1なら姫・剣豪(総バフ・倍枠・兵数加算で数える)'],
  [HELP_SK, 'スキル名', 'スキルの名前。TRごとに1行(同じ名前の行をTRの数だけ並べる)'],
  [HELP_SK, '種類', '初期スキル / スキル'],
  [HELP_SK, '攻撃or防御', '攻撃 / 防御 / 攻撃・防御'],
  [HELP_SK, 'スキル付与', '付与できる / 付与できない'],
  [
    HELP_SK,
    '係数の掛け方',
    '人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数 / 部隊内の飛翔の数 / 部隊移動速度/係数 / 敵武将の総コスト / 部隊内の兵科・兵種の数',
  ],
  [HELP_SK, 'TR・素スキル上昇率・係数', 'スキル上昇率 = 素スキル上昇率 + 係数 × (係数の掛け方で決まる数)'],
  [
    HELP_SK,
    '模倣・模倣倍率',
    '模倣スキル:なし / 自模倣 / 他真似(部隊長)。値 = 素スキル上昇率 + 模倣倍率 × 真似る初期スキル',
  ],
  [
    HELP_SK,
    '効果の対象',
    '部隊全員 / 姫の武将だけ / 剣豪の武将だけ / 覇の武将だけ(スキル上昇率をその武将の素攻にだけ掛ける)',
  ],
  [HELP_SK, '兵数を最大に揃える', '1なら、本丸防御陣形(防御部隊)でこの武将の兵数を陣形内の最大兵数に揃える'],
  [
    HELP_SK,
    'コスト減の減らし方 / コスト減',
    '自合流使用コストを減らすスキル。減らし方は「スキルを付けた武将のコスト分」か「決めた数値」(数値はコスト減の列)。空欄ならコスト減なし',
  ],
  [
    HELP_SK,
    '兵士攻撃・防御力加算 / 兵士加算の対象兵科・兵種 / 兵士加算の自身のもつ兵種',
    '初期スキル。部隊内のコスト減の合計1につき、対象の兵科・兵種の武将の兵士攻撃力(防御力)に足す値',
  ],
  [
    HELP_SK,
    '係数の数に自身を含む / 係数の対象兵科・兵種 / 係数の自身のもつ兵種',
    '係数の掛け方が「部隊内の兵科・兵種の数」のときの数え方。対象は「、」区切り',
  ],
  [HELP_SK, '重複上限', '部隊内で効果が出る数(スキルで1つ。どの行に書いても同じ)'],
  [
    HELP_SK,
    '素攻・防バフ / 本人のみ / 部隊長限定',
    '初期スキルの素攻・防バフ(掛け算)。本人のみ=1なら本人だけ、部隊長限定=1なら部隊長の枠でだけ効く',
  ],
  [HELP_SK, '倍枠通常・倍枠極限', '初期スキルの倍枠(追加スキル・極限スキルに掛ける)'],
  [
    HELP_SK,
    '倍枠の掛け方 / 倍枠係数(通常・極限)',
    '固定、または 倍枠 + 倍枠係数 × 部隊内の姫・剣豪・対象兵科・兵種の数(係数はそのままの数。0.2など)',
  ],
  [
    HELP_SK,
    '倍枠の数に自身を含む / 倍枠の対象兵科・兵種 / 倍枠の自身のもつ兵種',
    '倍枠の数え方。対象は「、」区切り',
  ],
  [
    HELP_SK,
    '総攻・防バフ / 総攻・防バフ係数',
    '初期スキルの総攻・防バフ。掛け方が固定以外なら + 数 × 係数 ÷ 100(係数は%。4%なら4)',
  ],
  [
    HELP_SK,
    '総攻・防バフの掛け方',
    '固定 / 無尽を持つ武将数 / 部隊内の姫の数 / 部隊内の剣豪の数 / 部隊内の兵科・兵種の数',
  ],
  [
    HELP_SK,
    '総攻・防バフの数に自身を含む / 対象兵科・兵種 / 自身のもつ兵種',
    '総攻・防バフの数え方。対象は「、」区切り',
  ],
  [
    HELP_SK,
    '兵数加算 / 兵数加算に自身を含む / 兵数加算の対象',
    'ほかの武将の兵数に足す数。対象は すべて / 姫 / 剣豪(「、」区切り)',
  ],
  [HELP_SK, '敵火力加算', '1なら防御部隊で 敵の推定火力 ÷ 敵の武将数 を足す'],
  [HELP_SK, '攻防で値を分ける と (防)の列', '1なら防御部隊では(防)の列の値を使う(空欄なら攻撃と同じ値)'],
  [HELP_SK, '無尽・飛翔・不屈・速度スキル', 'TRごとの値(特殊効果)'],
  [HELP_SK, '人数・平均コスト(右上)', '全員共通の設定。取り込むと設定も更新する'],
  ['兵種データ', '兵科・兵種・攻撃力・防禦力・破壊・速度', '兵種の値'],
  [
    'バフデータ',
    'カードNo・対象兵種・所属時・外部',
    '兵科バフ。所属時はそのカードが部隊にいるとき、外部は兵科バフボタンで選んだとき',
  ],
];
const X_JBUFF = [
  'カードNo',
  '武将名',
  '対象兵種',
  '所属時攻撃力',
  '所属時防御力',
  '外部攻撃力',
  '外部防御力',
];
async function downloadXlsx(withData) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const cards = withData
    ? [...M.cards.values()]
        .sort((a, b) => N(a.no) - N(b.no))
        .map(c => [
          N(c.no),
          c.name,
          c.rarity || '',
          N(c.cost),
          c.side || '',
          c.initName || '',
          N(c.troops),
          N(c.baseStat),
          N(c.baseDef),
          N(c.growth),
          N(c.growthDef),
          toFlag(c.hime),
          toFlag(c.kengou),
        ])
    : [];
  const skills = [];
  if (withData)
    for (const [, d] of [...M.skills].sort(byName)) {
      const ini = isInitSkill(d),
        tb = ini && tbCoefOn(d);
      for (const t of trsOf(d))
        skills.push([
          d.name,
          ini ? '初期スキル' : 'スキル',
          skillSide(d),
          toFlag(d.noAdd) ? '付与できない' : '付与できる',
          COEF_BY[coefByOf(d)],
          coefMax(d) ? 1 : 0,
          effsOf(d).muzin ? skillMuzin(d, t.tr) : 0,
          isX(d) ? 1 : 0,
          ini ? TB_BY[tbByOf(d)] : '',
          ini ? '' : MIMIC[mimicOf(d)],
          ini ? (toFlag(d.noMimic) ? '模倣できない' : '模倣できる') : '',
          N(t.tr),
          N(t.base),
          N(t.coef),
          isMimic(d) ? N(t.mimicRate) : '',
          dupOn(d) ? skillDupMax(d) || '' : '',
          ...(ini
            ? [
                t.statBuff ?? '',
                effsOf(d).self ? 1 : 0,
                effsOf(d).leader ? 1 : 0,
                t.mulNormal ?? '',
                t.mulLimit ?? '',
                t.totalBuff ?? '',
                tb ? (t.tbCoef ?? '') : '',
                t.troopAdd ?? '',
                effsOf(d).enemy ? 1 : 0,
                splitOn(d) ? 1 : 0,
                ...SPLIT_FIELDS.map(f => (splitOn(d) ? (t[f + 'D'] ?? '') : '')),
              ]
            : [
                ...['', '', '', '', '', '', '', '', ''],
                splitOn(d) ? 1 : 0,
                ...SPLIT_FIELDS.map(f =>
                  splitOn(d) && (f === 'base' || f === 'coef') ? (t[f + 'D'] ?? '') : '',
                ),
              ]),
          ...['hisho', 'fukutsu', 'speed'].map(k => (effsOf(d)[k] && hasV(t[k]) ? N(t[k]) : '')),
          ini && tbCounts(d) ? (tbSelfOf(d) ? 1 : 0) : '',
          ini && tbByOf(d) === 'branch' ? tbBranchesOf(d).join('、') : '',
          ini && tbByOf(d) === 'branch' ? tbSoldiersOf(d).join('、') : '',
          ini && tbByOf(d) === 'branch' ? (tbOwnOf(d) ? 1 : 0) : '',
          ini && effsOf(d).troop ? (effsOf(d).troopSelf ? 1 : 0) : '',
          ini && effsOf(d).troop
            ? troopToOf(d)
                .map(v => TROOP_TO.find(([k]) => k === v)[1])
                .join('、')
            : '',
          ...(ini && effsOf(d).mul && mulByOf(d) !== 'fixed'
            ? [
                MUL_BY[mulByOf(d)],
                mulCounts(d) ? (mulSelfOf(d) ? 1 : 0) : '',
                mulByOf(d) === 'branch' ? mulBranchesOf(d).join('、') : '',
                mulByOf(d) === 'branch' ? mulSoldiersOf(d).join('、') : '',
                mulByOf(d) === 'branch' ? (mulOwnOf(d) ? 1 : 0) : '',
                t.mulNormalCoef ?? '',
                t.mulLimitCoef ?? '',
              ]
            : ['', '', '', '', '', '', '']),
          ...(coefByOf(d) === 'branch'
            ? [
                coefSelfOf(d) ? 1 : 0,
                coefBranchesOf(d).join('、'),
                coefSoldiersOf(d).join('、'),
                coefOwnOf(d) ? 1 : 0,
              ]
            : ['', '', '', '']),
          effsOf(d).cut ? CUT_BY[cutByOf(d)] : '',
          effsOf(d).cut && cutByOf(d) === 'value' ? (t.costCut ?? '') : '',
          ...(ini && effsOf(d).sadd
            ? [
                t.soldierAdd ?? '',
                saddBranchesOf(d).join('、'),
                saddSoldiersOf(d).join('、'),
                saddOwnOf(d) ? 1 : 0,
              ]
            : ['', '', '', '']),
          effsOf(d).tmax ? 1 : 0,
          ONLY_TO[onlyToOf(d)],
        ]);
    }
  const sold = withData
    ? [...M.soldiers]
        .sort(bySoldierOrder)
        .map(([, o]) => [o.branch || '', o.name, N(o.atk), N(o.def), N(o.destroy), N(o.speed)])
    : [];
  const jb = withData
    ? [...M.jbuffs]
        .sort(byNo)
        .map(([, j]) => [N(j.no), j.name, (j.targets || []).join('、'), ...JBUFF_VALS.map(f => jv(j, f))])
    : [];
  const add = (name, head, rows, extra) => {
    const ws = XLSX.utils.aoa_to_sheet([extra ? [...head, '', ...extra] : head, ...rows]);
    ws['!cols'] = head.map(h => ({ wch: Math.max(8, h.length * 2 + 2) }));
    /* 見出しの行に絞り込み(フィルタ)を付ける */
    ws['!autofilter'] = { ref: `A1:${colName(head.length - 1)}${rows.length + 1}` };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('武将データ', X_CARD, cards);
  add('スキルデータ', X_SKILL, skills, ['人数', N(config.people), '平均コスト', N(config.avgCost)]);
  add('兵種データ', X_SOLDIER, sold);
  add('バフデータ', X_JBUFF, jb);
  /* 列の説明(取り込みでは読まないシート) */
  const help = XLSX.utils.aoa_to_sheet([['シート', '列', '説明'], ...COL_HELP]);
  help['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, help, '列の説明');
  XLSX.writeFile(
    wb,
    withData
      ? `IXAマスタ_${new Date().toISOString().slice(0, 10)}.xlsx`
      : 'IXAマスタ_取り込みフォーマット.xlsx',
  );
}
function readSheet(XLSX, wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}
/* ---------- 取り込み内容の組み立て ---------- */
/* シートの1行目(見出し)から列番号を探す道具。名前の配列を渡すと、最初に見つかった列を返す(表記ゆれ対応) */
function headerOf(rows) {
  const h = rows[0].map(x => String(x ?? '').trim());
  return n => {
    for (const x of Array.isArray(n) ? n : [n]) {
      const k = h.indexOf(x);
      if (k >= 0) return k;
    }
    return -1;
  };
}
/* 登録済みのスキルの、同じTRの値 */
const oldSkillTr = (name, tr) => {
  const old = M.skills.get(findId(M.skills, d => d.name === name) || '');
  return old && trEntry(old, tr);
};
function planFrom(XLSX, wb) {
  const warn = [],
    plan = { cards: [], skills: [], soldiers: [], jbuffs: [], people: null, avgCost: null, warn };
  const cr = readSheet(XLSX, wb, '武将データ'),
    sr = readSheet(XLSX, wb, 'スキルデータ'),
    or = readSheet(XLSX, wb, '兵種データ'),
    jr = readSheet(XLSX, wb, 'バフデータ') || readSheet(XLSX, wb, '傑バフデータ'); // 旧名のシートも読む
  if (!cr && !sr && !or && !jr)
    throw new Error('「武将データ」「スキルデータ」「兵種データ」「バフデータ」のどのシートも見つかりません');
  if (cr) planCards(cr, plan, warn);
  if (sr) planSkills(sr, plan);
  if (or && or.length) planSoldiers(or, plan, warn);
  if (jr && jr.length) planJbuffs(jr, plan, warn);
  plan.warn = [...new Set(warn)];
  return plan;
}

/* 武将データ:1枚1行。TRと初期スキルの値はスキルマスタで持つので、TRの列があっても読まない(同じカードNoの2行目以降は無視) */
const CARD_COLS = {
  no: 'カードNo',
  rarity: 'レアリティ',
  cost: '武将コスト',
  side: '攻撃or防御',
  name: 'カード名',
  initName: '初期スキル名',
  troops: '兵数',
  baseStat: ['素攻撃力', '素攻撃力・素防御力'],
  baseDef: ['素防御力'],
  growth: ['攻撃上昇率', '攻撃・防御上昇率', '上昇率'],
  growthDef: ['防御上昇率'],
  hime: '姫',
  kengou: '剣豪',
};
function planCards(cr, plan, warn) {
  const ix = headerOf(cr);
  for (const n of ['カードNo', 'カード名'])
    if (ix(n) < 0) throw new Error(`武将データに「${n}」列がありません`);
  const g = new Map();
  for (const row of cr.slice(1)) {
    const v = k => (ix(CARD_COLS[k]) < 0 ? null : row[ix(CARD_COLS[k])]);
    if (v('no') == null || v('name') == null) continue;
    const rar = String(v('rarity') ?? '').trim();
    if (v('rarity') != null && rar !== '' && !RARITIES.includes(rar))
      warn.push(
        `カードNo ${String(v('no')).trim()} のレアリティ「${rar}」は選択肢にありません(そのまま登録します)`,
      );
    const no = String(v('no')).trim();
    if (g.has(no)) continue;
    const c = {};
    for (const [f, , t] of CARD_FIELDS)
      c[f] =
        t === 'flag' || t === 'check' ? toFlag(v(f)) : t === 'number' ? N(v(f)) : String(v(f) ?? '').trim();
    g.set(no, c);
  }
  /* シートに無い列(姫・剣豪など)は、登録済みの値をそのまま残す */
  const missing = CARD_FIELDS.map(([f]) => f).filter(f => ix(CARD_COLS[f]) < 0);
  for (const [no, c] of g) {
    const id = findId(M.cards, d => String(d.no) === no);
    if (id) {
      const old = M.cards.get(id);
      for (const f of missing) if (old[f] != null) c[f] = old[f];
    }
    plan.cards.push({ id, data: c });
  }
}

/* スキルデータ:1行が1TR。スキル全体の項目は、どの行に書いてあってもよい(後の行が優先) */
function planSkills(sr, plan) {
  const ix = headerOf(sr);
  for (const n of ['スキル名', 'TR', '係数'])
    if (ix(n) < 0) throw new Error(`スキルデータに「${n}」列がありません`);
  for (const row of sr) {
    const k = row.findIndex(x => String(x ?? '').trim() === '人数');
    if (k >= 0 && Number.isFinite(Number(row[k + 1]))) {
      plan.people = Number(row[k + 1]);
      break;
    }
  }
  for (const row of sr) {
    const k = row.findIndex(x => String(x ?? '').trim() === '平均コスト');
    if (k >= 0 && hasV(row[k + 1]) && Number(row[k + 1]) > 0) {
      plan.avgCost = Number(row[k + 1]);
      break;
    }
  }
  const g = new Map();
  for (const row of sr.slice(1)) {
    const name = row[ix('スキル名')];
    if (name == null || String(name).trim() === '') continue;
    const n = String(name).trim();
    if (!g.has(n)) g.set(n, { name: n, trs: [] });
    const s = g.get(n);
    readSkillRow(s, row, ix);
    const tr = readSkillTr(n, row, ix);
    s.trs = s.trs.filter(t => t.tr !== tr.tr);
    s.trs.push(tr);
  }
  for (const [n, s] of g) {
    const id = findId(M.skills, d => d.name === n);
    finishSkill(s, id ? M.skills.get(id) : null);
    plan.skills.push({ id, data: s });
  }
}
/* スキル全体の項目(1行分) */
function readSkillRow(s, row, ix) {
  const val = c => (c >= 0 && hasV(row[c]) ? row[c] : null);
  const str = c => String(row[c]).trim();
  const addCol = ix('付与不可') >= 0 ? ix('付与不可') : ix('スキル付与') >= 0 ? ix('スキル付与') : ix('付与');
  if (val(addCol) != null)
    s.noAdd =
      ix('付与不可') >= 0 ? toFlag(str(addCol)) : /不可|できない|×|✕|^0$|^false$/i.test(str(addCol)) ? 1 : 0;
  if (val(ix('Xスキル')) != null) s.xskill = toFlag(row[ix('Xスキル')]);
  if (val(ix('係数の掛け方')) != null) {
    const v = str(ix('係数の掛け方'));
    s.coefBy =
      /同/.test(v) || v === 'same'
        ? 'same'
        : /X|Ｘ/i.test(v) || v === 'x'
          ? 'x'
          : /飛翔/.test(v) || v === 'hisho'
            ? 'hisho'
            : /速度/.test(v) || v === 'speed'
              ? 'speed'
              : /コスト/.test(v) || v === 'cost'
                ? 'cost'
                : /兵科|兵種/.test(v) || v === 'branch'
                  ? 'branch'
                  : 'people';
  }
  if (val(ix('種類')) != null) s.init = /初期/.test(String(row[ix('種類')])) ? 1 : 0;
  for (const [col, key] of [
    ['素攻バフ本人のみ', 'self'],
    ['部隊長限定', 'leader'],
    ['敵火力加算', 'enemy'],
    ['攻防で値を分ける', 'split'],
    ['兵数加算に自身を含む', 'troopSelf'],
    ['兵数を最大に揃える', 'tmax'],
  ])
    if (val(ix(col)) != null) s.effFlags = { ...(s.effFlags || {}), [key]: toFlag(row[ix(col)]) === 1 };
  /* コスト減:減らし方の列が空でなければコスト減あり(「数値」なら決めた数値、それ以外は武将のコスト分) */
  if (ix('コスト減の減らし方') >= 0) {
    const v = val(ix('コスト減の減らし方'));
    s.effFlags = { ...(s.effFlags || {}), cut: v != null };
    if (v != null) s.cutBy = /数値/.test(String(v)) || String(v) === 'value' ? 'value' : 'self';
  }
  /* 兵士攻撃・防御力加算の対象 */
  if (val(ix('兵士加算の自身のもつ兵種')) != null) s.saddOwn = toFlag(row[ix('兵士加算の自身のもつ兵種')]);
  for (const [h, f] of [
    ['兵士加算の対象兵科', 'saddBranches'],
    ['兵士加算の対象兵種', 'saddSoldiers'],
  ])
    if (val(ix(h)) != null)
      s[f] = String(row[ix(h)])
        .split(/[、,，]/)
        .map(x => x.trim())
        .filter(Boolean);
  if (val(ix('重複上限')) != null) s.dupMax = N(row[ix('重複上限')]);
  /* 兵数加算の対象(すべて・姫・剣豪を「、」区切り) */
  if (val(ix('兵数加算の対象')) != null)
    s.troopTo = String(row[ix('兵数加算の対象')])
      .split(/[、,，]/)
      .map(x => TROOP_TO.find(([, l]) => l === x.trim())?.[0])
      .filter(Boolean);
  if (val(ix('係数最大TR参照')) != null) s.coefMaxTr = toFlag(row[ix('係数最大TR参照')]);
  if (val(ix('模倣可否')) != null) s.noMimic = /不可|できない/.test(String(row[ix('模倣可否')])) ? 1 : 0;
  if (val(ix('模倣')) != null) {
    const v = String(row[ix('模倣')]);
    s.mimic = /自/.test(v) ? 'self' : /他|部隊長/.test(v) ? 'leader' : 'none';
  }
  const sideCol = [ix('攻撃or防御'), ix('攻防')].find(x => x >= 0);
  if (sideCol != null && hasV(row[sideCol])) {
    const v = str(sideCol);
    s.side = /攻/.test(v) && /防/.test(v) ? '攻撃・防御' : /防/.test(v) ? '防御' : '攻撃';
  }
  if (val(ix('総攻・防バフの掛け方')) != null)
    s.tbBy = (v =>
      /無尽/.test(v)
        ? 'muzin'
        : /姫/.test(v)
          ? 'hime'
          : /剣豪/.test(v)
            ? 'kengou'
            : /兵科|兵種/.test(v)
              ? 'branch'
              : 'fixed')(String(row[ix('総攻・防バフの掛け方')]));
  /* 総攻・防バフの数え方(前の列名「数に自身を含む」「姫数に自身を含む」「対象兵科」などのファイルも読む) */
  for (const h of ['総攻・防バフの数に自身を含む', '数に自身を含む', '姫数に自身を含む'])
    if (val(ix(h)) != null) s.tbSelf = toFlag(row[ix(h)]);
  for (const h of ['総攻・防バフの自身のもつ兵種', '自身のもつ兵種'])
    if (val(ix(h)) != null) s.tbOwn = toFlag(row[ix(h)]);
  /* 倍枠の掛け方と、その数え方(総バフとは別) */
  if (val(ix('倍枠の掛け方')) != null) {
    const v = String(row[ix('倍枠の掛け方')]);
    s.mulBy = /LV|ＬＶ/i.test(v)
      ? 'initlv'
      : /4人/.test(v)
        ? 'hime4'
        : /姫/.test(v)
          ? 'hime'
          : /剣豪/.test(v)
            ? 'kengou'
            : /兵科|兵種/.test(v)
              ? 'branch'
              : 'fixed';
  }
  /* 係数の掛け方「部隊内の兵科・兵種の数」の数え方 */
  /* 効果の対象:「姫」を含めば姫の武将だけ */
  if (val(ix('効果の対象')) != null) {
    const v = String(row[ix('効果の対象')]);
    s.onlyTo = /姫/.test(v) ? 'hime' : /剣豪/.test(v) ? 'kengou' : /覇/.test(v) ? 'ha' : 'all';
  }
  if (val(ix('係数の数に自身を含む')) != null) s.coefSelf = toFlag(row[ix('係数の数に自身を含む')]);
  if (val(ix('係数の自身のもつ兵種')) != null) s.coefOwn = toFlag(row[ix('係数の自身のもつ兵種')]);
  for (const [h, f] of [
    ['係数の対象兵科', 'coefBranches'],
    ['係数の対象兵種', 'coefSoldiers'],
  ])
    if (val(ix(h)) != null)
      s[f] = String(row[ix(h)])
        .split(/[、,，]/)
        .map(x => x.trim())
        .filter(Boolean);
  if (val(ix('倍枠の数に自身を含む')) != null) s.mulSelf = toFlag(row[ix('倍枠の数に自身を含む')]);
  if (val(ix('倍枠の自身のもつ兵種')) != null) s.mulOwn = toFlag(row[ix('倍枠の自身のもつ兵種')]);
  for (const [h, f] of [
    ['倍枠の対象兵科', 'mulBranches'],
    ['倍枠の対象兵種', 'mulSoldiers'],
  ])
    if (val(ix(h)) != null)
      s[f] = String(row[ix(h)])
        .split(/[、,，]/)
        .map(x => x.trim())
        .filter(Boolean);
  for (const [h, f] of [
    ['対象兵科', 'tbBranches'],
    ['対象兵種', 'tbSoldiers'],
    ['総攻・防バフの対象兵科', 'tbBranches'],
    ['総攻・防バフの対象兵種', 'tbSoldiers'],
  ])
    if (val(ix(h)) != null)
      s[f] = String(row[ix(h)])
        .split(/[、,，]/)
        .map(x => x.trim())
        .filter(Boolean);
}
/* TRごとの値(1行分)。初期スキル用の値は、列がなければ登録済みの値を残す */
function readSkillTr(n, row, ix) {
  const tr = {
    tr: N(row[ix('TR')]),
    base: ix('素スキル上昇率') < 0 ? 0 : N(row[ix('素スキル上昇率')]),
    coef: N(row[ix('係数')]),
  };
  const has = c => c >= 0 && hasV(row[c]);
  if (has(ix('模倣倍率'))) tr.mimicRate = N(row[ix('模倣倍率')]);
  for (const f of SPLIT_FIELDS) if (has(ix(SPLIT_COL[f]))) tr[f + 'D'] = N(row[ix(SPLIT_COL[f])]);
  /* 無尽・飛翔・不屈・速度スキルはTRごと(1行ごと)の値 */
  for (const [k, l] of EXTRA_EFFS) if (has(ix(l))) tr[k] = N(row[ix(l)]);
  const keepOld = [
    ['tbCoef', '総攻・防バフ係数'],
    ['mulNormalCoef', '倍枠係数(通常)'],
    ['mulLimitCoef', '倍枠係数(極限)'],
    ['troopAdd', '兵数加算'],
    ['costCut', 'コスト減'],
    ['soldierAdd', '兵士攻撃・防御力加算'],
    ...SKILL_INIT.map(([f, l]) => [f, l]),
  ];
  for (const [f, col] of keepOld) {
    if (has(ix(col))) tr[f] = N(row[ix(col)]);
    else {
      const oe = oldSkillTr(n, tr.tr);
      if (oe && oe[f] != null) tr[f] = oe[f];
    }
  }
  return tr;
}
/* シートに無かった項目は登録済みの値を使い、種類に合わない値を消す */
function finishSkill(s, old) {
  s.trs = trsOf(s);
  /* 無尽などの列が無いシートなら、登録済みのTRごとの値を残す */
  for (const [k] of EXTRA_EFFS)
    if (!s.trs.some(t => hasV(t[k])) && old)
      for (const t of s.trs) {
        const v = k === 'muzin' ? skillMuzin(old, t.tr) : trEntry(old, t.tr)?.[k];
        if (hasV(v) && (k !== 'muzin' || v > 0)) t[k] = N(v);
      }
  s.muzin = Math.max(0, ...s.trs.map(t => N(t.muzin)));
  if (s.xskill == null) s.xskill = old ? toFlag(old.xskill) : 0;
  if (s.noAdd == null) s.noAdd = old ? toFlag(old.noAdd) : 0;
  if (s.coefBy == null) s.coefBy = old ? coefByOf(old) : 'people';
  if (s.side == null) s.side = old ? skillSide(old) : '攻撃';
  if (s.mimic == null && old && isMimic(old)) s.mimic = mimicOf(old);
  if (s.mimic === 'none') delete s.mimic;
  if (s.init)
    s.effs = {
      ...effsOf({ ...s, effs: undefined }),
      ...(old?.effs
        ? {
            self: !!old.effs.self,
            leader: !!old.effs.leader,
            enemy: !!old.effs.enemy,
            split: !!old.effs.split,
            troopSelf: !!old.effs.troopSelf,
            cut: !!old.effs.cut,
            tmax: !!old.effs.tmax,
          }
        : {}),
      ...(s.effFlags || {}),
    };
  /* 追加スキルの「攻防で値を分ける」:列があればその値、なければ登録済みの値(種類が決まってから使う) */
  const spFlag = s.effFlags?.split,
    cutFlag = s.effFlags?.cut ?? !!old?.effs?.cut,
    tmaxFlag = s.effFlags?.tmax ?? !!old?.effs?.tmax;
  delete s.effFlags;
  if (s.dupMax == null && old && dupOn(old)) s.dupMax = skillDupMax(old);
  if (!(N(s.dupMax) > 0)) delete s.dupMax;
  if (s.coefMaxTr == null && old && old.coefMaxTr) s.coefMaxTr = 1;
  if (!s.coefMaxTr || s.coefBy !== 'same') delete s.coefMaxTr;
  if (s.noMimic == null && old && old.noMimic != null) s.noMimic = toFlag(old.noMimic);
  if (s.tbBy == null && old && old.tbBy) s.tbBy = tbByOf(old);
  if (s.tbSelf == null && old && (old.tbSelf ?? old.himeSelf) != null) s.tbSelf = old.tbSelf ?? old.himeSelf;
  if (s.tbBranches == null && old && old.tbBranches) s.tbBranches = old.tbBranches;
  if (s.tbSoldiers == null && old && old.tbSoldiers) s.tbSoldiers = old.tbSoldiers;
  if (s.tbOwn == null && old && old.tbOwn != null) s.tbOwn = old.tbOwn;
  if (s.troopTo == null && old && old.troopTo) s.troopTo = old.troopTo;
  for (const f of ['cutBy', 'saddBranches', 'saddSoldiers', 'saddOwn', 'onlyTo', 'himeOnly'])
    if (s[f] == null && old && old[f] != null) s[f] = old[f];
  for (const f of ['coefSelf', 'coefBranches', 'coefSoldiers', 'coefOwn'])
    if (s[f] == null && old && old[f] != null) s[f] = old[f];
  for (const f of ['mulBy', 'mulSelf', 'mulBranches', 'mulSoldiers', 'mulOwn'])
    if (s[f] == null && old && old[f] != null) s[f] = old[f];
  if (s.init == null)
    s.init = old
      ? isInitSkill(old)
        ? 1
        : 0
      : s.trs.some(t => SKILL_INIT.some(([f]) => t[f] != null))
        ? 1
        : 0;
  /* 新しく登録する初期スキルは、模倣可否の列がなければ「模倣できない」 */
  if (s.init && s.noMimic == null && !old) s.noMimic = 1;
  if (!s.init && (spFlag ?? !!old?.effs?.split)) s.effs = { ...(s.effs || {}), split: true };
  if (!s.init && cutFlag) s.effs = { ...(s.effs || {}), cut: true };
  if (!s.init && tmaxFlag) s.effs = { ...(s.effs || {}), tmax: true };
  if (!s.init)
    s.trs = s.trs.map(t => {
      const o = { ...t };
      for (const f of INIT_TR_FIELDS()) if (!(splitOn(s) && (f === 'baseD' || f === 'coefD'))) delete o[f];
      return o;
    });
}

/* 兵種データ:兵科・兵種・攻撃力・防禦力・破壊・速度。兵種名が同じものを上書き。列名は表記ゆれも受け付ける */
function planSoldiers(or, plan, warn) {
  const ix = headerOf(or);
  const col = {
    name: ix(['兵種', '兵種名']),
    branch: ix(['兵科']),
    atk: ix(['攻撃力', '兵士攻撃力']),
    def: ix(['防禦力', '防御力', '兵士防御力', '兵士防禦力']),
    destroy: ix(['破壊']),
    speed: ix(['速度']),
  };
  if (col.name < 0) throw new Error('兵種データに「兵種」列がありません');
  if (col.atk < 0) throw new Error('兵種データに「攻撃力」列がありません');
  const g = new Map();
  let order = 0;
  for (const row of or.slice(1)) {
    const name = row[col.name];
    if (name == null || String(name).trim() === '') continue;
    const n = String(name).trim();
    const d = { name: n, branch: col.branch < 0 ? '' : String(row[col.branch] ?? '').trim(), order: ++order };
    for (const f of ['atk', 'def', 'destroy', 'speed']) {
      const v = col[f] < 0 ? null : row[col[f]];
      if (f === 'atk' && (v == null || String(v).trim() === '' || !Number.isFinite(Number(v))))
        warn.push(`兵種「${n}」の攻撃力が数値ではありません(0として取り込みます)`);
      d[f] = N(v);
    }
    if (g.has(n)) warn.push(`兵種「${n}」が2行あります(後の行を使います)`);
    g.set(n, d);
  }
  for (const [n, d] of g) plan.soldiers.push({ id: findId(M.soldiers, x => x.name === n), data: d });
}

/* バフデータ:カードNo・武将名・対象兵種(「、」区切り。空なら全兵種)・所属時攻撃力・所属時防御力・外部攻撃力・外部防御力。カードNoが同じものを上書き */
const JBUFF_COLS = {
  no: [['カードNo', 'カードNO', 'No'], 'カードNo'],
  name: [['武将名', 'カード名'], '武将名'],
  targets: [['対象兵種', '兵種'], '対象兵種'],
  atkIn: [['所属時攻撃力'], '所属時攻撃力'],
  defIn: [['所属時防御力', '所属時防禦力'], '所属時防御力'],
  atkOut: [['外部攻撃力'], '外部攻撃力'],
  defOut: [['外部防御力', '外部防禦力'], '外部防御力'],
};
function planJbuffs(jr, plan, warn) {
  const ix = headerOf(jr),
    col = {};
  for (const [k, [names, label]] of Object.entries(JBUFF_COLS)) {
    col[k] = ix(names);
    if (col[k] < 0) throw new Error(`バフデータに「${label}」列がありません`);
  }
  const g = new Map();
  for (const row of jr.slice(1)) {
    const no = row[col.no],
      name = row[col.name];
    if ((no == null || String(no).trim() === '') && (name == null || String(name).trim() === '')) continue;
    const n = String(name ?? '').trim();
    if (no == null || !Number.isFinite(Number(no))) {
      warn.push(`バフ「${n || '(名前なし)'}」のカードNoが数値ではないため、取り込みません`);
      continue;
    }
    const key = String(Number(no)),
      d = { no: Number(no), name: n, targets: splitTargets(row[col.targets]) };
    const miss = d.targets.filter(t => !findId(M.soldiers, x => x.name === t));
    if (miss.length)
      warn.push(`バフ「${n}」の対象兵種「${miss.join('、')}」は兵種マスタにありません(名前のまま登録します)`);
    for (const f of JBUFF_VALS) {
      const v = row[col[f]];
      if (v != null && String(v).trim() !== '' && !Number.isFinite(Number(v)))
        warn.push(`バフ「${n}」の${JBUFF_COLS[f][1]}が数値ではありません(0として取り込みます)`);
      d[f] = N(v);
    }
    if (g.has(key)) warn.push(`カードNo ${key} のバフが2行あります(後の行を使います)`);
    g.set(key, d);
  }
  for (const [key, d] of g) plan.jbuffs.push({ id: findId(M.jbuffs, x => String(x.no) === key), data: d });
}
$('mimport').addEventListener('click', () => {
  draft = null;
  renderEditor();
  importPlan = 'pick';
  renderImport();
});
$('importbox').addEventListener('change', async e => {
  if (e.target.id !== 'xfile' || !e.target.files[0]) return;
  const m = $('impmsg');
  m.className = 'msg';
  m.textContent = '読み込んでいます…';
  try {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(await e.target.files[0].arrayBuffer(), { type: 'array' });
    importPlan = planFrom(XLSX, wb);
    renderImport();
  } catch (err) {
    m.className = 'msg err';
    m.textContent = '読み込めませんでした:' + err.message;
  }
});
$('importbox').addEventListener('click', async e => {
  const b = e.target.closest('[data-imp]');
  if (!b) return;
  if (b.dataset.imp === 'cancel') {
    importPlan = null;
    renderImport();
    return;
  }
  if (b.dataset.imp === 'fmt' || b.dataset.imp === 'dump') {
    const m = $('impmsg');
    try {
      m.className = 'msg';
      m.textContent = '作成しています…';
      await downloadXlsx(b.dataset.imp === 'dump');
      m.textContent = '';
    } catch (err) {
      m.className = 'msg err';
      m.textContent = '作成できませんでした:' + err.message;
    }
    return;
  }
  if (needName()) return;
  const p = importPlan,
    m = $('impmsg');
  b.disabled = true;
  let done = 0;
  const total =
    p.cards.length +
    p.skills.length +
    p.soldiers.length +
    p.jbuffs.length +
    (p.people != null || p.avgCost != null ? 1 : 0);
  try {
    for (const c of p.cards) {
      await writeWithLog(
        'Excel取り込み',
        'cards',
        c.id || 'n' + c.data.no + '_' + Math.random().toString(36).slice(2, 6),
        c.data,
      );
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const s of p.skills) {
      await writeWithLog('Excel取り込み', 'skills', s.id || newId('s'), s.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const o of p.soldiers) {
      await writeWithLog('Excel取り込み', 'soldiers', o.id || newId('o'), o.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const j of p.jbuffs) {
      await writeWithLog('Excel取り込み', 'jbuffs', j.id || 'j' + j.data.no, j.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    if (p.people != null || p.avgCost != null) {
      await writeWithLog('Excel取り込み', 'config', 'main', {
        ...plain(config),
        ...(p.people != null ? { people: p.people } : {}),
        ...(p.avgCost != null ? { avgCost: p.avgCost } : {}),
      });
      done++;
    }
    importPlan = null;
    renderImport();
    status(`Excelから ${done} 件を取り込みました。`);
    setTimeout(() => status(''), 5000);
  } catch (err) {
    m.className = 'msg err';
    m.textContent = `${done}件まで取り込んだところで止まりました(${logErr(err)})。もう一度「取り込む」を押すと続きから上書きします。`;
    b.disabled = false;
  }
});
