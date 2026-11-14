// Excelの取り込み・ダウンロード
// 使うファイル:core.js、fields.js、skills.js、master.js、admin.js(調べ方:node tests/deps.js)
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
    <p class="note">「武将データ」「スキルデータ」「兵種データ」「傑バフデータ」シートを読み込みます(列はフォーマットのとおり)(あるシートだけで構いません)。武将と傑バフはカードNo、スキルはスキル名、兵種は兵種名が同じものを上書きし、それ以外はそのまま残します。素攻とスキル上昇率は取り込まず、この画面で計算し直します。</p>
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
    <li>傑バフ:${p.jbuffs.length}件 うち新規 ${p.jbuffs.filter(c => !c.id).length}件</li>
    ${p.people != null ? `<li>人数:${p.people}</li>` : ''}${p.warn.map(w => `<li style="color:var(--danger)">${esc(w)}</li>`).join('')}</ul>
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
];
const X_SOLDIER = ['兵科', '兵種', '攻撃力', '防禦力', '破壊', '速度'];
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
        tb = ini && tbByOf(d) === 'muzin';
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
            : ['', '', '', '', '', '', '', '', '', '', ...SPLIT_FIELDS.map(() => '')]),
          ...['hisho', 'fukutsu', 'speed'].map(k => (effsOf(d)[k] && hasV(t[k]) ? N(t[k]) : '')),
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
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('武将データ', X_CARD, cards);
  add('スキルデータ', X_SKILL, skills, ['人数', N(config.people)]);
  add('兵種データ', X_SOLDIER, sold);
  add('傑バフデータ', X_JBUFF, jb);
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
    plan = { cards: [], skills: [], soldiers: [], jbuffs: [], people: null, warn };
  const cr = readSheet(XLSX, wb, '武将データ'),
    sr = readSheet(XLSX, wb, 'スキルデータ'),
    or = readSheet(XLSX, wb, '兵種データ'),
    jr = readSheet(XLSX, wb, '傑バフデータ');
  if (!cr && !sr && !or && !jr)
    throw new Error(
      '「武将データ」「スキルデータ」「兵種データ」「傑バフデータ」のどのシートも見つかりません',
    );
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
            : 'people';
  }
  if (val(ix('種類')) != null) s.init = /初期/.test(String(row[ix('種類')])) ? 1 : 0;
  for (const [col, key] of [
    ['素攻バフ本人のみ', 'self'],
    ['部隊長限定', 'leader'],
    ['敵火力加算', 'enemy'],
    ['攻防で値を分ける', 'split'],
  ])
    if (val(ix(col)) != null) s.effFlags = { ...(s.effFlags || {}), [key]: toFlag(row[ix(col)]) === 1 };
  if (val(ix('重複上限')) != null) s.dupMax = N(row[ix('重複上限')]);
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
    s.tbBy = /無尽/.test(String(row[ix('総攻・防バフの掛け方')])) ? 'muzin' : 'fixed';
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
    ['troopAdd', '兵数加算'],
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
          }
        : {}),
      ...(s.effFlags || {}),
    };
  delete s.effFlags;
  if (s.dupMax == null && old && dupOn(old)) s.dupMax = skillDupMax(old);
  if (!(N(s.dupMax) > 0)) delete s.dupMax;
  if (s.coefMaxTr == null && old && old.coefMaxTr) s.coefMaxTr = 1;
  if (!s.coefMaxTr || s.coefBy !== 'same') delete s.coefMaxTr;
  if (s.noMimic == null && old && old.noMimic != null) s.noMimic = toFlag(old.noMimic);
  if (s.tbBy == null && old && old.tbBy) s.tbBy = tbByOf(old);
  if (s.init == null)
    s.init = old
      ? isInitSkill(old)
        ? 1
        : 0
      : s.trs.some(t => SKILL_INIT.some(([f]) => t[f] != null))
        ? 1
        : 0;
  if (!s.init)
    s.trs = s.trs.map(t => {
      const o = { ...t };
      for (const f of INIT_TR_FIELDS()) delete o[f];
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

/* 傑バフデータ:カードNo・武将名・対象兵種(「、」区切り。空なら全兵種)・所属時攻撃力・所属時防御力・外部攻撃力・外部防御力。カードNoが同じものを上書き */
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
    if (col[k] < 0) throw new Error(`傑バフデータに「${label}」列がありません`);
  }
  const g = new Map();
  for (const row of jr.slice(1)) {
    const no = row[col.no],
      name = row[col.name];
    if ((no == null || String(no).trim() === '') && (name == null || String(name).trim() === '')) continue;
    const n = String(name ?? '').trim();
    if (no == null || !Number.isFinite(Number(no))) {
      warn.push(`傑バフ「${n || '(名前なし)'}」のカードNoが数値ではないため、取り込みません`);
      continue;
    }
    const key = String(Number(no)),
      d = { no: Number(no), name: n, targets: splitTargets(row[col.targets]) };
    const miss = d.targets.filter(t => !findId(M.soldiers, x => x.name === t));
    if (miss.length)
      warn.push(
        `傑バフ「${n}」の対象兵種「${miss.join('、')}」は兵種マスタにありません(名前のまま登録します)`,
      );
    for (const f of JBUFF_VALS) {
      const v = row[col[f]];
      if (v != null && String(v).trim() !== '' && !Number.isFinite(Number(v)))
        warn.push(`傑バフ「${n}」の${JBUFF_COLS[f][1]}が数値ではありません(0として取り込みます)`);
      d[f] = N(v);
    }
    if (g.has(key)) warn.push(`カードNo ${key} の傑バフが2行あります(後の行を使います)`);
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
    p.cards.length + p.skills.length + p.soldiers.length + p.jbuffs.length + (p.people != null ? 1 : 0);
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
    if (p.people != null) {
      await writeWithLog('Excel取り込み', 'config', 'main', { ...plain(config), people: p.people });
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
