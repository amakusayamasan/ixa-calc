// マスタ管理画面(一覧・編集パネル・保存)
// 使うファイル:core.js、fields.js、skills.js、cards.js、admin.js(調べ方:node tests/deps.js)
/* ---------- マスタ一覧の絞り込みと並べ替え ----------
   絞り込みは1段ずつボタンの行で出す。tabs はその段を出すタブ。'' はすべて。
   件数は、その段以外の絞り込み(と名前の絞り込み)をかけた中での数 */
const SIDE_FILTERS = [
  ['', 'すべて'],
  ['攻撃', '攻撃'],
  ['防御', '防御'],
  ['攻撃・防御', '攻・防'],
];
/* スキルの種類:初期スキル / 模倣スキル / 追加スキル(模倣でないもの) */
const skillKind = d => (isInitSkill(d) ? 'init' : isMimic(d) ? 'mimic' : 'add');
/* 人数系:人数で値が変わるスキル(係数の掛け方が「人数」か「敵武将の総コスト」で、係数が0でないTRがあるもの) */
const peopleSkill = d =>
  !isMimic(d) &&
  ['people', 'cost'].includes(coefByOf(d)) &&
  trsOf(d).some(t => N(t.coef) !== 0 || (splitOn(d) && N(t.coefD) !== 0));
const MFILTERS = [
  {
    key: 'side',
    label: '攻撃or防御',
    tabs: ['cards', 'skills'],
    items: SIDE_FILTERS,
    test: (d, v) => skillSide(d) === v,
  },
  {
    key: 'kind',
    label: '種類',
    tabs: ['skills'],
    items: [
      ['', 'すべて'],
      ['add', '追加スキル'],
      ['init', '初期スキル'],
      ['mimic', '模倣スキル'],
    ],
    test: (d, v) => skillKind(d) === v,
  },
  {
    key: 'people',
    label: '人数',
    tabs: ['skills'],
    items: [
      ['', 'すべて'],
      ['yes', '人数系'],
      ['no', '人数系以外'],
    ],
    test: (d, v) => (peopleSkill(d) ? 'yes' : 'no') === v,
  },
  {
    key: 'rar',
    label: 'レアリティ',
    tabs: ['cards'],
    items: () => [['', 'すべて'], ...RARITIES.map(r => [r, r])],
    test: (d, v) => d.rarity === v,
  },
];
const mfilter = { side: '', kind: '', people: '', rar: '' };
const fOn = f => f.tabs.includes(mtab) && !!mfilter[f.key];
const anyFilter = () => MFILTERS.some(fOn);
const filterOk = (d, skip) => MFILTERS.every(f => f === skip || !fOn(f) || f.test(d, mfilter[f.key]));
function renderFilters(named) {
  const fs = MFILTERS.filter(f => f.tabs.includes(mtab)),
    box = $('mfilters');
  box.hidden = !fs.length;
  box.innerHTML =
    '<legend>絞り込み条件</legend>' +
    fs
      .map(f => {
        const pool = named.filter(([, d]) => filterOk(d, f)),
          items = typeof f.items === 'function' ? f.items() : f.items;
        const btns = items
          .map(([v, l]) => {
            const n = v ? pool.filter(([, d]) => f.test(d, v)).length : pool.length;
            return `<button type="button" data-fk="${f.key}" data-fv="${esc(v)}" aria-pressed="${mfilter[f.key] === v}">${esc(l)}<span class="cnt">${n}</span></button>`;
          })
          .join('');
        return `<div class="mfrow"><span class="label">${f.label}</span><div class="seg sidefilter" role="group" aria-label="${f.label}で絞り込み">${btns}</div></div>`;
      })
      .join('');
}
$('mfilters').addEventListener('click', e => {
  const b = e.target.closest('[data-fk]');
  if (!b) return;
  mfilter[b.dataset.fk] = b.dataset.fv;
  renderMaster();
});
/* スキル一覧の並べ替え:TRの見出しをクリックするたびに 大きい順 → 小さい順 → 名前順。
   数字で比べられないもの(模倣スキル、部隊で値が変わる掛け方、そのTRがない)は、いつも一番下 */
let msort = null; // { tr, dir: 'desc' | 'asc' }
const sortValue = (d, tr) => {
  const t = trEntry(d, tr);
  if (!t || isMimic(d)) return null;
  const by = coefByOf(d);
  if (by === 'people') return skillValue(t);
  if (by === 'cost') return skillValue(t, enemyCost());
  return null;
};
function sortSkills(list) {
  if (!msort || mtab !== 'skills') return list;
  const k = msort.dir === 'asc' ? 1 : -1,
    v = new Map(list.map(([id, d]) => [id, sortValue(d, msort.tr)]));
  return [...list].sort(([a], [b]) => {
    const x = v.get(a),
      y = v.get(b);
    if (x == null || y == null) return (x == null) - (y == null);
    return (x - y) * k;
  });
}
$('mtable').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort-tr]');
  if (!th) return;
  const tr = N(th.dataset.sortTr);
  msort = msort?.tr !== tr ? { tr, dir: 'desc' } : msort.dir === 'desc' ? { tr, dir: 'asc' } : null;
  renderMaster();
});
/* ---------- マスタ一覧の列 ----------
   各列は [見出し, 左寄せか, セルの中身(d)=>HTML, 追加の属性(d)=>文字列] */
const sideChip = side =>
  `<span class="chip ${side === '攻撃・防御' ? 'side-both' : side === '防御' ? 'side-def' : side === '攻撃' ? 'side-atk' : ''}">${esc(side || '')}</span>`;
const orDash = (v, f) => (v == null ? '—' : f(v));
const LIST_COLS = {
  cards: () => [
    ['カード名', 1, d => esc(d.name) + sideChip(d.side)],
    ['初期スキル名', 1, d => esc(d.initName || '—')],
    ['カードNo', 0, d => esc(d.no)],
    ['レアリティ', 1, d => esc(d.rarity)],
    ['コスト', 0, d => fmt(N(d.cost), 1)],
    ['兵数', 0, d => fmt(N(d.troops))],
    ['素攻撃力', 0, d => fmt(N(d.baseStat))],
    ['素防御力', 0, d => orDash(d.baseDef, v => fmt(N(v)))],
    ['攻撃上昇率', 0, d => fmt(N(d.growth), 2)],
    ['防御上昇率', 0, d => orDash(d.growthDef, v => fmt(N(v), 2))],
    ['TR', 1, d => trRange({ trs: cardTrs(d) })],
    ['最大TRの初期スキル', 0, d => fmt(initBase(d, lastTr(d)), 1)],
    ['最大TRの総攻バフ', 0, d => fmt(N(cardT(d, lastTr(d).tr)?.totalBuff), 2)],
    ['姫', 0, d => (toFlag(d.hime) ? '姫' : '—')],
    ['剣豪', 0, d => (toFlag(d.kengou) ? '剣豪' : '—')],
    ['無尽', 0, d => (cardMuzin(d) > 0 ? fmt(cardMuzin(d), 2) : '—')],
  ],
  skills: list => {
    const maxTr = Math.max(5, ...list.flatMap(([, d]) => trsOf(d).map(t => N(t.tr))));
    return [
      ['スキル名', 1, d => esc(d.name)],
      ['種類', 1, d => ({ init: '初期スキル', mimic: '模倣スキル', add: 'スキル' })[skillKind(d)]],
      ['攻撃or防御', 1, d => sideChip(skillSide(d))],
      ['スキル付与', 0, d => (toFlag(d.noAdd) ? '不可' : '可')],
      ['係数の掛け方', 1, d => (isMimic(d) ? '—' : COEF_SHORT[coefByOf(d)])],
      ['無尽', 0, d => (skillMuzin(d) > 0 ? fmt(skillMuzin(d), 2) : '—')],
      ['Xスキル', 0, d => (isX(d) ? '○' : '—')],
      ['総攻バフの掛け方', 1, d => (isInitSkill(d) ? TB_BY[tbByOf(d)] : '—')],
      ...[...Array(maxTr + 1).keys()].map(t => [
        `TR${t}${msort?.tr === t ? (msort.dir === 'desc' ? ' ▼' : ' ▲') : ''}`,
        0,
        d => (trEntry(d, t) ? skillLabel(trEntry(d, t), d) : '—'),
        d => {
          const e = trEntry(d, t);
          return `title="${e ? (coefByOf(d) === 'speed' ? `素${N(e.base)} + 移動速度÷${N(e.coef)}×100` : `素${N(e.base)} + 係数${N(e.coef)}×${COEF_SHORT[coefByOf(d)]}`) : ''}"`;
        },
        t,
      ]),
    ];
  },
  jbuffs: () => [
    ['カードNo', 0, d => esc(d.no)],
    ['武将名', 1, d => esc(d.name)],
    ['対象兵種', 1, d => esc(targetsLabel(d)), () => 'style="white-space:normal;min-width:140px"'],
    ...JBUFF_VALS.map(f => [JBUFF_FIELDS.find(x => x[0] === f)[1], 0, d => `+${fmt(jv(d, f), 2)}`]),
  ],
  soldiers: () => [
    ['兵種名', 1, d => esc(d.name)],
    ['兵科', 1, d => esc(d.branch || '')],
    ...[
      ['atk', '攻撃力'],
      ['def', '防御力'],
      ['destroy', '破壊'],
      ['speed', '速度'],
    ].map(([f, h]) => [h, 0, d => orDash(d[f], v => fmt(N(v), 2))]),
  ],
};
const lastTr = d => {
  const t = cardTrs(d);
  return t[t.length - 1] || {};
};
const jbuffList = q =>
  [...M.jbuffs]
    .filter(
      ([, d]) =>
        !q ||
        String(d.name).includes(q) ||
        String(d.no).includes(q) ||
        (d.targets || []).some(t => t.includes(q)),
    )
    .sort(byNo);
const soldierList = q =>
  [...M.soldiers]
    .filter(([, d]) => !q || String(d.name).includes(q) || String(d.branch || '').includes(q))
    .sort(bySoldierOrder);

const PEOPLE_FORMULA = 'スキル上昇率 = 素スキル上昇率 + 係数×人数';
/* 人数・平均コストを保存したときのメッセージ(保存で画面が描き直されても残す) */
let cfgMsg = null;
const COST_FORMULA = '係数の掛け方「敵武将の総コスト」:素スキル上昇率 + 係数×平均コスト×人数';
function renderMaster() {
  $('madd').hidden = !isOwner || mtab === 'skills';
  $('maddSkill').hidden = $('maddInit').hidden = !isOwner || mtab !== 'skills';
  $('mimport').hidden = !isOwner;
  $('mnote').textContent = isOwner
    ? '行をクリックすると編集できます。保存した内容はすぐに全員の画面へ反映されます。'
    : 'マスタの編集は管理者のみです。管理者は右上の「管理者ログイン」からログインしてください。ここでは内容を確認できます。';
  const pp = $('people');
  pp.hidden = mtab !== 'skills';
  if (mtab === 'skills')
    pp.innerHTML = isOwner
      ? `<div class="pgrp"><label class="label" for="peopleIn">人数(${PEOPLE_FORMULA})</label>` +
        `<input id="peopleIn" type="number" value="${esc(config.people)}">` +
        '<button class="btn small ghost" type="button" data-cfg="people">人数を保存</button></div>' +
        `<div class="pgrp"><label class="label" for="avgCostIn">敵武将の平均コスト(${COST_FORMULA})</label>` +
        `<input id="avgCostIn" type="number" step="0.1" value="${esc(config.avgCost)}">` +
        '<button class="btn small ghost" type="button" data-cfg="avgCost">平均コストを保存</button></div>' +
        `<span id="peopleMsg" class="msg${cfgMsg ? ' ' + cfgMsg.cls : ''}">${esc(cfgMsg?.text || '')}</span>`
      : `<div class="pgrp"><span class="label">人数</span><b class="num">${fmt(N(config.people))}</b><span class="note">${PEOPLE_FORMULA}</span></div>` +
        `<div class="pgrp"><span class="label">敵武将の平均コスト</span><b class="num">${fmt(N(config.avgCost), 2)}</b><span class="note">${COST_FORMULA}</span></div>`;
  const q = $('msearch').value.trim();
  const ed = isOwner ? 'editable' : '';
  const named = [...M[mtab]].filter(([, d]) => !q || String(d.name).includes(q));
  const list = sortSkills(named.filter(([, d]) => filterOk(d)).sort(byName));
  renderFilters(named);
  $('msortnote').hidden = mtab !== 'skills';
  const rows = mtab === 'jbuffs' ? jbuffList(q) : mtab === 'soldiers' ? soldierList(q) : list;
  const cols = LIST_COLS[mtab](rows);
  const emptyRow = `<tr><td class="l" colspan="${cols.length}" style="color:var(--muted)">${
    loaded[mtab]
      ? q || anyFilter()
        ? '該当なし'
        : `${LABEL[mtab]}はまだ登録されていません。`
      : '読み込み中…'
  }</td></tr>`;
  /* 5つ目の要素(TR)がある列は、見出しのクリックで並べ替えられる */
  const head = cols
    .map(([h, l, , , st]) =>
      st == null
        ? `<th${l ? ' class="l"' : ''}>${h}</th>`
        : `<th class="sortable${msort?.tr === st ? ' sorted' : ''}" data-sort-tr="${st}" title="クリックで並べ替え(大きい順 → 小さい順 → 名前順)" aria-sort="${msort?.tr === st ? (msort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}">${h}</th>`,
    )
    .join('');
  const body = rows.length
    ? rows
        .map(
          ([id, d]) =>
            `<tr data-id="${esc(id)}" class="${ed}">${cols
              .map(
                ([, l, cell, extra]) =>
                  `<td class="${l ? 'l' : 'num'}"${extra ? ' ' + extra(d) : ''}>${cell(d)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')
    : emptyRow;
  const html = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  $('mtable').innerHTML = html;
}

/* ---------- 編集パネル ---------- */
function openEditor(coll, id, kind) {
  const d = id ? structuredClone(M[coll].get(id)) : null;
  if (coll === 'cards')
    draft = {
      coll,
      id,
      data: d || {
        no: '',
        rarity: '天',
        cost: '',
        side: '攻撃',
        name: '',
        initName: '',
        troops: '',
        baseStat: '',
        baseDef: '',
        growth: '',
        growthDef: '',
        hime: 0,
        kengou: 0,
      },
    };
  else if (coll === 'skills')
    draft = {
      coll,
      id,
      data: d
        ? {
            ...d,
            side: skillSide(d),
            init: isInitSkill(d) ? 1 : 0,
            muzin: N(d.muzin),
            /* 重複上限はスキル全体で1つ。TRごとに持っていた古いスキルは、いちばん大きい値で開く */
            ...(dupOn(d) ? { dupMax: skillDupMax(d) || 2 } : {}),
            /* TRごとの無尽がない古いスキルは、スキル全体の無尽をTR表に入れて開く */
            trs: (d.trs || []).map(t =>
              effsOf(d).muzin && !hasV(t.muzin) ? { ...t, muzin: skillMuzin(d, t.tr) } : t,
            ),
            xskill: toFlag(d.xskill),
            noAdd: toFlag(d.noAdd),
            coefBy: coefByOf(d),
          }
        : kind === 'init'
          ? {
              init: 1,
              side: '攻撃',
              name: '',
              muzin: 0,
              xskill: 0,
              noAdd: 1,
              noMimic: 1,
              coefBy: 'people',
              effs: { stat: false, mul: false, total: false, troop: false },
              trs: [{ tr: 0, base: 0, coef: 0 }],
            }
          : {
              init: 0,
              side: '攻撃',
              name: '',
              muzin: 0,
              xskill: 0,
              noAdd: 0,
              coefBy: 'people',
              trs: [{ tr: 0, base: 0, coef: 0 }],
            },
    };
  else if (coll === 'jbuffs') {
    if (d) {
      for (const f of JBUFF_VALS) d[f] = jv(d, f);
      d.targets = d.targets || [];
    }
    draft = {
      coll,
      id,
      data: d || { no: '', name: '', targets: [], atkIn: '', defIn: '', atkOut: '', defOut: '' },
    };
  } else draft = { coll, id, data: d || { name: '', branch: '', atk: '', def: '', destroy: '', speed: '' } };
  draft.data.trs && (draft.data.trs = trsOf(draft.data));
  renderEditor();
  $('editor').scrollIntoView({ block: 'nearest' });
}
function syncDraft() {
  if (!draft) return;
  const d = draft.data;
  for (const el of $('editor').querySelectorAll('[data-f]')) {
    const f = el.dataset.f;
    d[f] =
      el.type === 'checkbox'
        ? el.dataset.inv
          ? el.checked
            ? 0
            : 1
          : el.checked
            ? 1
            : 0
        : el.dataset.flag
          ? Number(el.value)
          : el.type === 'number'
            ? el.value === ''
              ? ''
              : Number(el.value)
            : el.value;
  }
  if (draft.coll === 'jbuffs' && $('editor').querySelector('[name=jtarget]')) {
    const known = [...$('editor').querySelectorAll('[name=jtarget]')];
    const unknown = (d.targets || []).filter(t => !known.some(k => k.value === t));
    d.targets = [...known.filter(k => k.checked).map(k => k.value), ...unknown];
  }
  for (const el of $('editor').querySelectorAll('[data-t]')) {
    const [r, f] = el.dataset.t.split(':');
    d.trs[+r][f] = el.value === '' ? '' : Number(el.value);
  }
}
/* ---------- 編集パネルの部品 ---------- */
/* 入力欄1つ分。type でプルダウン・チェックボックス・数値などを切り替える */
const SELECTS = {
  mimic: d => Object.entries(MIMIC).map(([v, l]) => [v, l, mimicOf(d) === v]),
  tbby: d => Object.entries(TB_BY).map(([v, l]) => [v, l, tbByOf(d) === v]),
  coef: d => Object.entries(COEF_BY).map(([v, l]) => [v, l, coefByOf(d) === v]),
  side: (d, f) => SIDES.map(v => [null, v, d[f] === v]),
  rarity: (d, f) =>
    (RARITIES.includes(d[f]) || !d[f] ? RARITIES : [...RARITIES, d[f]]).map(v => [null, esc(v), d[f] === v]),
  flag: (d, f) => (FLAG_LABELS[f] || ['0', '1']).map((l, v) => [v, l, toFlag(d[f]) === v]),
};
function fieldHtml(d, f, label, type) {
  const lab = `<label class="label" for="f-${f}">${label}</label>`;
  if (f === 'initName')
    return `<div class="field">${lab}<input id="f-${f}" data-f="${f}" type="text" list="skillNames" autocomplete="off" placeholder="スキルマスタから選択" value="${esc(d[f] ?? '')}"></div>`;
  if (type === 'check')
    return `<div class="field"><span class="label">${label}</span><label class="checkline"><input type="checkbox" id="f-${f}" data-f="${f}"${toFlag(d[f]) ? ' checked' : ''}>${label}</label></div>`;
  if (SELECTS[type]) {
    const opts = SELECTS[type](d, f)
      .map(
        ([v, l, sel]) => `<option${v == null ? '' : ` value="${v}"`}${sel ? ' selected' : ''}>${l}</option>`,
      )
      .join('');
    return `<div class="field">${lab}<select id="f-${f}" data-f="${f}"${type === 'flag' ? ' data-flag="1"' : ''}>${opts}</select></div>`;
  }
  /* 重複の警告を出す欄(カードNo、スキル・兵種の名前) */
  const warn =
    f === 'no' || (f === 'name' && NAME_UNIQUE.includes(draft?.coll))
      ? `<span class="msg err" id="f-${f}-warn" aria-live="polite"></span>`
      : '';
  return `<div class="field">${lab}<input id="f-${f}" data-f="${f}" type="${type}" ${type === 'number' ? 'step="any"' : ''} value="${esc(d[f] ?? '')}">${warn}</div>`;
}
const checkbox = (attrs, checked, label) =>
  `<label><input type="checkbox" ${attrs}${checked ? ' checked' : ''}>${label}</label>`;
const checksField = (label, inner) =>
  `<div class="field">${label ? `<span class="label">${label}</span>` : ''}<div class="checks">${inner}</div></div>`;
const EFFECT_PROMPT = '特殊効果にチェックを入れてください(チェックした効果の値をTR表で入力)';

/* スキル・初期スキルの編集画面 */
function skillEditorBody(d) {
  const ini = toFlag(d.init) === 1,
    mm = !ini && isMimic(d),
    ef = effsOf(d);
  const fields = [
    ['name', 'スキル名', 'text'],
    ['side', '攻撃or防御', 'side'],
    ['noAdd', 'スキル付与', 'flag'],
    !mm && ['coefBy', '係数の掛け方', 'coef'],
    !ini && ['xskill', 'Xスキル', 'flag'],
    ini ? ['noMimic', '模倣', 'flag'] : ['mimic', '模倣', 'mimic'],
    ini && ef.total && ['tbBy', `総${sw(d)}バフの掛け方`, 'tbby'],
  ].filter(Boolean);
  const coefMaxBox =
    coefByOf(d) === 'same' && !mm
      ? `<div class="field"><div class="checks">${checkbox('id="f-coefMaxTr"', toFlag(d.coefMaxTr), '係数は部隊内武将のTRの最大値を参照')}</div></div>`
      : '';
  /* 特殊効果のチェック(並び順は EFFECT_ORDER) */
  const effects = effectOrder(d)
    .map(k => {
      if (EXTRA_EFFS.some(([x]) => x === k))
        return checkbox(`data-effx="${k}"`, ef[k], EXTRA_EFFS.find(([x]) => x === k)[1]);
      if (k === 'dup') return checkbox('data-eff="dup"', dupOn(d), '重複上限');
      if (k === 'leader') return checkbox('data-eff2="leader"', ef.leader, '部隊長限定');
      if (k === 'enemy') return checkbox('data-eff2="enemy"', ef.enemy, '敵火力加算');
      if (k === 'split') return checkbox('data-eff2="split"', ef.split, '攻撃と防御で値を分ける');
      return (
        checkbox(`data-eff="${k}"`, ef[k], effLabel(d, k)) +
        (k === 'stat' && ef.stat
          ? checkbox('data-eff2="self"', ef.self, `${effLabel(d, 'stat')}は本人のみ`)
          : '')
      );
    })
    .join('');
  return (
    `<div class="grid">${fields.map(([f, l, t]) => fieldHtml(d, f, l, t)).join('')}</div>
    ${coefMaxBox}
    ${checksField(EFFECT_PROMPT, effects)}
    ${dupOn(d) ? `<div class="grid">${fieldHtml(d, 'dupMax', '重複上限(部隊内で効果が出る数)', 'number')}</div>` : ''}
    <p class="note">${skillNotes(d).join('')}</p>` +
    trTable(skillTrCols(d), d.trs, t => skillLabel(t, d), 'スキル上昇率')
  );
}
/* スキル編集画面の説明文(選んだ項目に合わせて出す) */
function skillNotes(d) {
  const ini = toFlag(d.init) === 1,
    ef = effsOf(d),
    b = sw(d);
  const notes = [
    'スキル上昇率 = 素スキル上昇率 + 係数 × (人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数 / 部隊内の飛翔の数 / 敵武将の総コスト)。敵武将の総コスト = 平均コスト × 人数。「部隊移動速度/係数」は計算のしかたが違います(下の説明)。',
    coefByOf(d) === 'speed' &&
      'スキル上昇率 = 素スキル上昇率 + 部隊移動速度 ÷ 係数 × 100。部隊移動速度 = 部隊の兵種の速度のいちばん遅い値 × (100 + 部隊全員のスキルの速度スキルの合計) ÷ 100。無尽のとき、速度スキルの値は2倍になりませんが、このスキルの効果はほかのスキルと同じく2倍になります。',
    coefByOf(d) === 'hisho' &&
      '部隊内の飛翔の数 = 4人それぞれが持つスキル(初期・追加・極限)の飛翔のいちばん大きい値を、4人分足したもの。',
    dupOn(d) &&
      '重複上限:部隊内でこのスキルが上限より多いときは、値の大きいものから上限の数だけ効果が出ます(TRに関係なく1つの値)。初期スキルが外れたときは特殊効果も出ません。',
    coefMax(d) && '係数は、部隊内でこのスキルを持つ武将のうち、いちばん高いTRの係数を使います。',
    'Xスキルは通常枠にしか付けられません。',
    splitOn(d) && '攻撃と防御で値を分ける:防御部隊では(防)の列の値を使います(空欄なら攻撃と同じ値)。',
  ];
  if (ini)
    notes.push(
      `素${b}バフ〜総${b}バフは、このスキルを初期スキルに持つ武将に効く値です。兵数加算は、同じ部隊の他の武将の兵数に足します(空欄なら0)。`,
      ef.stat &&
        (ef.self
          ? `素${b}バフは本人だけにかかります。`
          : `素${b}バフは、部隊のどこにいても部隊全員にかかります。`),
      ef.leader && '部隊長限定:部隊長の枠にいるときだけ、この初期スキルの効果が出ます。',
      ef.enemy &&
        '敵火力加算:防御部隊で、この初期スキルを持つ武将1人につき「敵の推定火力 ÷ 敵の武将数」を合計に足します。',
      ef.total &&
        tbByOf(d) === 'muzin' &&
        `総${b}バフ = 総${b}バフ + 無尽を持つ武将数(本人を含む、最大4) × 総${b}バフ係数 ÷ 100 × 無尽2倍(無尽部隊で本人が無尽を持つとき)。係数は %で、4%なら 4 と入力します。`,
    );
  if (!ini && isMimic(d))
    notes.push(
      `模倣スキルの値 = 素スキル上昇率 + 模倣倍率 × ${mimicOf(d) === 'self' ? '自分' : '部隊長'}の初期スキルのスキル上昇率(部隊の中で計算した値)。特殊効果は模倣しません。極限枠でも ×1.2 はかけません。${mimicOf(d) === 'leader' ? '部隊長に付けたときは効果なし。' : ''}`,
    );
  if (skillSide(d) === '防御')
    notes.push('防御スキルの値は、攻撃部隊の計算では使いません(倍枠通常・倍枠極限は使います)。');
  return notes.filter(Boolean);
}
/* 特殊効果のチェックとTR表の列の並び。初期スキルとスキルで出すものが違う */
const EFFECT_ORDER_INIT = [
  'split',
  'speed',
  'hisho',
  'fukutsu',
  'muzin',
  'mul',
  'leader',
  'stat',
  'total',
  'troop',
  'enemy',
  'dup',
];
const EFFECT_ORDER_SKILL = ['split', 'speed', 'hisho', 'fukutsu', 'muzin', 'dup'];
/* 「攻撃と防御で値を分ける」は、攻撃or防御が「攻撃・防御」のときだけ(模倣スキルは出さない) */
const effectOrder = d =>
  (toFlag(d.init) === 1 ? EFFECT_ORDER_INIT : EFFECT_ORDER_SKILL).filter(
    k => k !== 'split' || (skillSide(d) === '攻撃・防御' && (toFlag(d.init) === 1 || !isMimic(d))),
  );
/* TR表の列:TR・素スキル上昇率・係数(模倣は模倣倍率)のあとに、チェックした特殊効果の列を上の並び順で */
function skillTrCols(d) {
  const ini = toFlag(d.init) === 1,
    ef = effsOf(d),
    b = sw(d);
  const head =
    !ini && isMimic(d)
      ? [
          ['tr', 'TR'],
          ['base', '素スキル上昇率'],
          ['mimicRate', '模倣倍率'],
        ]
      : SKILL_TR;
  const colsOf = {
    mul: [
      ['mulNormal', '倍枠通常'],
      ['mulLimit', '倍枠極限'],
    ],
    stat: [['statBuff', `素${b}バフ`]],
    total: [['totalBuff', `総${b}バフ`], ...(tbByOf(d) === 'muzin' ? [['tbCoef', `総${b}バフ係数(%)`]] : [])],
    troop: [['troopAdd', '兵数加算']],
  };
  for (const [k, l] of EXTRA_EFFS) colsOf[k] = [[k, l]];
  const on = k => (k === 'dup' ? dupOn(d) : ef[k]);
  const cols = [...head, ...effectOrder(d).flatMap(k => (on(k) && colsOf[k]) || [])];
  return splitOn(d) ? splitCols(cols) : cols;
}
/* 攻撃と防御で値を分けるスキルのTR表:攻撃の列のあとに、同じ項目の防御の列(項目名+D)を並べる */
function splitCols(cols) {
  const lab = (f, l, side) =>
    f === 'statBuff'
      ? `素${side}バフ`
      : f === 'totalBuff'
        ? `総${side}バフ`
        : f === 'tbCoef'
          ? `総${side}バフ係数(%)`
          : `${l}(${side})`;
  const sp = cols.filter(([f]) => SPLIT_FIELDS.includes(f));
  return [
    ...cols.map(([f, l]) => (SPLIT_FIELDS.includes(f) ? [f, lab(f, l, '攻')] : [f, l])),
    ...sp.map(([f, l]) => [f + 'D', lab(f, l, '防')]),
  ];
}
function cardEditorBody(d) {
  return `<div class="grid">${CARD_FIELDS.map(([f, l, t]) => fieldHtml(d, f, l, t)).join('')}</div>
    <datalist id="skillNames">${[...M.skills.values()].map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
    <div id="initArea" data-key="${esc(String(d.initName ?? '').trim())}">${initAreaHtml(d)}</div>`;
}
function jbuffEditorBody(d) {
  const sold = [...M.soldiers].sort(bySoldierOrder),
    tg = d.targets || [],
    unknown = tg.filter(t => !sold.some(([, x]) => x.name === t));
  const boxes =
    sold
      .map(([, x]) => checkbox(`name="jtarget" value="${esc(x.name)}"`, tg.includes(x.name), esc(x.name)))
      .join('') || '<span class="note">兵種マスタが空です</span>';
  return `<div class="grid">${JBUFF_FIELDS.map(([f, l, t]) => fieldHtml(d, f, l, t)).join('')}</div>
    <div class="field"><span class="label">対象兵種(チェックなしなら全兵種)</span><div class="checks">${boxes}</div>
    ${unknown.length ? `<p class="msg err">兵種マスタにない兵種が指定されています:${unknown.map(esc).join('、')}(このまま残ります)</p>` : ''}</div>
    <p class="note">バフがあると、対象兵種の攻撃力・防御力にこの値が足されます。「所属時」はこのカード(カードNoが同じ武将)が部隊に入っているとき、「外部」は部隊の外からかかるときの値です。</p>`;
}
function soldierEditorBody(d) {
  return `<div class="grid">${SOLDIER_FIELDS.map(([f, l, t]) => fieldHtml(d, f, l, t)).join('')}</div><p class="note">攻撃力は攻撃部隊、防御力は防御部隊の計算に使います。</p>`;
}
function editorTitle(coll, id, d) {
  if (coll === 'skills') {
    const kind = toFlag(d.init) ? '初期スキル' : 'スキル';
    return id ? `${esc(d.name)} を編集(${kind})` : kind + 'を追加';
  }
  return id ? esc(d.name) + ' を編集' : LABEL[coll] + 'を追加';
}
function renderEditor() {
  const box = $('editor');
  if (!draft || !isOwner) {
    box.innerHTML = '';
    return;
  }
  const { coll, id, data: d } = draft;
  const body = {
    cards: cardEditorBody,
    skills: skillEditorBody,
    jbuffs: jbuffEditorBody,
    soldiers: soldierEditorBody,
  }[coll](d);
  box.innerHTML = `<form class="editor" id="edform" novalidate><strong>${editorTitle(coll, id, d)}</strong>${body}
    <div class="actions">${buttonRow('<button class="btn" type="submit">保存</button>', button('閉じる', 'data-act="close"', 'btn ghost'))}
    ${id ? '<button class="btn danger" type="button" data-act="delete">削除</button>' : ''}</div><p class="msg" id="edmsg"></p></form>`;
}
/* 武将の編集画面のうち、初期スキル名で変わる部分(案内・登録ボタン・TR表) */
function initAreaHtml(d) {
  const sk = skillByName(d.initName),
    st = sk ? trsOf(sk.d) : [],
    name = String(d.initName ?? '').trim();
  const note = !name
    ? '初期スキル名を入力してください(必須)。TRと初期スキルの値は、スキルマスタの初期スキルから使います。'
    : sk && st.length
      ? `TRと初期スキルの値(初期スキル・素攻・防バフ・倍枠通常・倍枠極限・総攻・防バフ)は、スキルマスタの「${esc(sk.d.name)}」(${trRange(sk.d)})から使います。変えるときはスキルマスタで編集してください。`
      : `「${esc(name)}」はスキルマスタにありません。保存すると、初期スキル追加画面に進みます。`;
  const btn = sk
    ? `<button class="btn small ghost" type="button" data-act="openInit" style="align-self:start">「${esc(sk.d.name)}」をスキルマスタで編集</button>`
    : '';
  return `<div class="field"><p class="note" id="initNote">${note}</p>${btn}</div>`;
}
/* TRごとの値の入力表。cols=[項目, 見出し]の配列、computed=右端に出す計算値(スキル上昇率) */
function trTable(cols, trs, computed, clabel) {
  const head = `${cols.map(c => `<th class="l">${c[1]}</th>`).join('')}${computed ? `<th>${clabel}</th>` : ''}<th></th>`;
  const cell = (t, r, f, l) =>
    `<td class="l"><input class="${f === 'tr' ? 'tr' : ''}" type="number" step="any" data-t="${r}:${f}" aria-label="${l}" value="${esc(t[f] ?? '')}"></td>`;
  const rmBtn = r =>
    button(
      '行を削除',
      `data-act="rmtr" data-r="${r}"${trs.length < 2 ? ' disabled' : ''}`,
      'btn small danger',
    );
  const rows = trs
    .map(
      (t, r) =>
        `<tr>${cols.map(([f, l]) => cell(t, r, f, l)).join('')}${
          computed ? `<td class="num computed" data-c="${r}">${computed(t)}</td>` : ''
        }<td>${rmBtn(r)}</td></tr>`,
    )
    .join('');
  return `<div class="field"><span class="label">TRごとの値</span><div class="trtable"><table><thead><tr>${head}</tr></thead><tbody>
  ${rows}
  </tbody></table></div><button class="btn small ghost" type="button" data-act="addtr" style="align-self:start">TRを追加(前の行をコピー)</button></div>`;
}
$('editor').addEventListener('change', e => {
  if (draft && e.target.id === 'f-coefMaxTr') {
    syncDraft();
    draft.data.coefMaxTr = e.target.checked ? 1 : 0;
    renderEditor();
    return;
  }
  if (draft && draft.coll === 'skills' && e.target.id === 'f-coefBy') {
    syncDraft();
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.eff2 === 'split' && e.target.checked) {
    /* 分けたときは、防御の空欄に攻撃の値を入れておく */
    syncDraft();
    for (const t of draft.data.trs)
      for (const f of SPLIT_FIELDS) if (!hasV(t[f + 'D']) && hasV(t[f])) t[f + 'D'] = t[f];
  }
  if (draft && e.target.dataset.eff2) {
    syncDraft();
    const d = draft.data;
    d.effs = { ...effsOf(d), [e.target.dataset.eff2]: e.target.checked };
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.effx) {
    syncDraft();
    const d = draft.data,
      k = e.target.dataset.effx;
    /* 無尽にチェックしたら、空欄に今の無尽(古いスキルはスキル全体の値、なければ1)を入れる */
    /* 古い形式(スキル全体の無尽)を持つスキルは、その値をTR表に入れる */
    if (k === 'muzin' && e.target.checked && N(d.muzin) > 0)
      d.trs.forEach(t => hasV(t.muzin) || (t.muzin = N(d.muzin)));
    d.effs = { ...(d.effs || {}), [k]: e.target.checked };
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.eff === 'dup') {
    syncDraft();
    const d = draft.data;
    d.effs = { ...(d.effs || {}), dup: e.target.checked };
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.eff) {
    syncDraft();
    const d = draft.data,
      k = e.target.dataset.eff;
    /* チェックした項目は空欄のまま出す(値の入れ忘れは保存時に知らせる) */
    d.effs = { ...effsOf(d), [k]: e.target.checked };
    renderEditor();
    return;
  }
  if (draft && e.target.id === 'f-mimic') {
    syncDraft();
    if (isMimic(draft.data)) {
      draft.data.side = '攻撃・防御';
      draft.data.trs.forEach(t => {
        if (!hasV(t.mimicRate)) t.mimicRate = 1;
      });
    }
    renderEditor();
    return;
  }
  if (draft && (e.target.id === 'f-tbBy' || (draft.coll === 'skills' && e.target.id === 'f-side'))) {
    syncDraft();
    renderEditor();
    return;
  }
  if (draft && e.target.id === 'f-init') {
    syncDraft();
    const d = draft.data;
    /* 初期スキルに切り替えたら、空の素攻・防バフ〜総攻・防バフに1を入れる */
    if (toFlag(d.init))
      d.trs.forEach(t => {
        for (const [f] of SKILL_INIT) if (t[f] == null || t[f] === '') t[f] = 1;
      });
    renderEditor();
    return;
  }
});
$('editor').addEventListener('input', () => {
  if (!draft) return;
  syncDraft();
  const d = draft.data;
  /* 初期スキル名の案内は入力中に更新する(保存ボタンを押す瞬間に画面がずれないように) */
  if (draft.coll === 'cards') {
    const a = $('initArea'),
      key = String(d.initName ?? '').trim();
    if (a && a.dataset.key !== key) {
      a.dataset.key = key;
      a.innerHTML = initAreaHtml(d);
    }
  }
  if (draft.coll === 'cards' && $('atkPreview')) $('atkPreview').textContent = fmt(cardAtk(d));
  if (draft.coll === 'skills')
    d.trs.forEach((t, r) => {
      const c = document.querySelector(`[data-c="${r}"]`);
      if (c) c.textContent = skillLabel(t, d);
    });
});
$('editor').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || !draft) return;
  const act = b.dataset.act;
  /* 武将の初期スキルを、スキルマスタの編集画面で開く(武将の未保存の変更は破棄) */
  if (act === 'openInit') {
    syncDraft();
    const sk = skillByName(draft.data.initName);
    if (!sk) return;
    $('mtabs').querySelector('[data-m=skills]').click();
    openEditor('skills', sk.id);
    return;
  }
  if (act === 'close') {
    draft = null;
    renderEditor();
    return;
  }
  if (act === 'addtr') {
    syncDraft();
    const last = draft.data.trs[draft.data.trs.length - 1] || {};
    draft.data.trs.push({ ...last, tr: N(last.tr) + 1 });
    renderEditor();
    return;
  }
  if (act === 'rmtr') {
    syncDraft();
    draft.data.trs.splice(+b.dataset.r, 1);
    renderEditor();
    return;
  }
  if (act === 'delete') {
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = '本当に削除する';
      return;
    }
    if (needName()) return;
    try {
      await writeWithLog('削除', draft.coll, draft.id, null);
      draft = null;
      renderEditor();
    } catch (err) {
      msg('削除できませんでした(' + logErr(err) + ')', true);
    }
  }
});
function msg(t, err) {
  const m = $('edmsg');
  if (m) {
    m.textContent = t;
    m.className = 'msg ' + (err ? 'err' : 'ok');
  }
}
/* 同じカードNoがほかに登録されていれば、そのデータを返す(武将・バフ)。M は Firestore と常に同期している */
function dupNo(coll, no, selfId) {
  if (String(no ?? '').trim() === '') return null;
  const id = findId(M[coll], x => String(x.no) === String(no).trim());
  return id && id !== selfId ? M[coll].get(id) : null;
}
/* カードNoの欄から離れたときに、登録済みなら赤字で知らせる */
function checkNo() {
  const w = $('f-no-warn'),
    el = $('f-no');
  if (!w || !el || !draft) return;
  const hit = dupNo(draft.coll, el.value, draft.id);
  w.textContent = hit ? `カードNo ${el.value.trim()} は既に登録済みです(${hit.name})` : '';
}
/* スキル・兵種は名前で重複を確かめる(前後の空白は無視) */
const NAME_UNIQUE = ['skills', 'soldiers'];
function dupName(coll, name, selfId) {
  const n = String(name ?? '').trim();
  if (!n) return null;
  const id = findId(M[coll], x => String(x.name ?? '').trim() === n);
  return id && id !== selfId ? M[coll].get(id) : null;
}
function checkName() {
  const w = $('f-name-warn'),
    el = $('f-name');
  if (!w || !el || !draft) return;
  const hit = dupName(draft.coll, el.value, draft.id);
  w.textContent = hit
    ? `「${el.value.trim()}」は既に登録済みです${draft.coll === 'skills' ? `(${isInitSkill(hit) ? '初期スキル' : 'スキル'})` : ''}`
    : '';
}
$('editor').addEventListener('focusout', e => {
  if (e.target.id === 'f-no') checkNo();
  if (e.target.id === 'f-name') checkName();
});
function validate(coll, d) {
  if (!String(d.name || '').trim()) return '名前を入力してください';
  if (coll === 'cards') {
    if (d.no === '' || !Number.isFinite(Number(d.no))) return 'カードNoを入力してください';
    if (dupNo(coll, d.no, draft.id)) return `カードNo ${d.no} はすでに登録されています`;
    if (!String(d.initName ?? '').trim()) return '初期スキル名を入力してください';
  } else if (coll === 'jbuffs') {
    if (d.no === '' || !Number.isFinite(Number(d.no))) return 'カードNoを入力してください';
    if (dupNo(coll, d.no, draft.id)) return `カードNo ${d.no} はすでに登録されています`;
  } else {
    if (dupName(coll, d.name, draft.id)) return '同じ名前がすでに登録されています';
  }
  if (d.trs) {
    if (!d.trs.length) return 'TRを1行以上入力してください';
    const s = d.trs.map(t => N(t.tr));
    if (new Set(s).size !== s.length) return '同じTRが2行あります';
  }
  if (coll === 'skills') return skillEffectMissing(d);
  return '';
}
/* 特殊効果にチェックを入れた項目は、すべてのTRで値が必須(攻撃と防御で分けるときの(防)の列は空欄なら攻撃と同じ値なので任意) */
function skillEffectMissing(d) {
  if (dupOn(d) && !(N(d.dupMax) > 0)) return '重複上限を入力してください(1以上)';
  const head = ['tr', 'base', 'coef', 'mimicRate'];
  const cols = skillTrCols(d).filter(([f]) => !head.includes(f) && !SPLIT_FIELDS.some(x => f === x + 'D'));
  for (const t of trsOf(d))
    for (const [f, l] of cols)
      if (!hasV(t[f]))
        return `TR${N(t.tr)}の「${l}」を入力してください(特殊効果にチェックを入れた項目は必須です)`;
  return '';
}
function clean(coll, d) {
  if (coll === 'cards') return normalizeCard(d);
  if (coll === 'skills') return normalizeSkill(d);
  if (coll === 'jbuffs') {
    const o = {};
    for (const [f, , t] of JBUFF_FIELDS) o[f] = t === 'number' ? N(d[f]) : String(d[f] ?? '').trim();
    o.targets = [...new Set((d.targets || []).map(x => String(x).trim()).filter(Boolean))];
    return o;
  }
  const o = {};
  for (const [f, , t] of SOLDIER_FIELDS) o[f] = t === 'number' ? N(d[f]) : String(d[f] ?? '').trim();
  if (d.order != null) o.order = N(d.order);
  return o;
}
$('editor').addEventListener('submit', async e => {
  e.preventDefault();
  syncDraft();
  const { coll } = draft;
  const err = validate(coll, draft.data);
  if (err) return msg(err, true);
  const data = clean(coll, draft.data);
  const id =
    draft.id ||
    (coll === 'cards'
      ? 'n' + data.no + '_' + Math.random().toString(36).slice(2, 6)
      : coll === 'jbuffs'
        ? 'j' + data.no
        : newId(coll[0]));
  if (needName()) return;
  try {
    await writeWithLog(draft.id ? '更新' : '追加', coll, id, data);
    draft.id = id;
    draft.data = structuredClone(data);
    renderEditor();
    msg('保存しました');
  } catch (er) {
    msg('保存できませんでした(' + logErr(er) + ')', true);
    return;
  }
  /* 武将の初期スキル名がスキルマスタにないときは、その名前で初期スキル追加画面を開く */
  const iname = coll === 'cards' ? String(data.initName ?? '').trim() : '';
  if (iname && !skillByName(iname)) {
    $('mtabs').querySelector('[data-m=skills]').click();
    openEditor('skills', null, 'init');
    draft.data.name = iname;
    /* 攻撃or防御は、いま保存した武将の値を初期値にする */
    if (SIDES.includes(data.side)) draft.data.side = data.side;
    renderEditor();
    msg(
      `初期スキルを追加してください。(武将「${data.name}」は保存しました。初期スキル「${iname}」がスキルマスタにありません)`,
      true,
    );
  }
});
