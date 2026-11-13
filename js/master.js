// マスタ管理画面(一覧・編集パネル・保存)
// 使うファイル:core.js、fields.js、skills.js、cards.js、admin.js(調べ方:node tests/deps.js)
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
      ['種類', 1, d => (isInitSkill(d) ? '初期スキル' : 'スキル')],
      ['攻撃or防御', 1, d => sideChip(skillSide(d))],
      ['スキル付与', 0, d => (toFlag(d.noAdd) ? '不可' : '可')],
      ['係数の掛け方', 1, d => (isMimic(d) ? '—' : COEF_SHORT[coefByOf(d)])],
      ['無尽', 0, d => (N(d.muzin) > 0 ? fmt(N(d.muzin), 2) : '—')],
      ['Xスキル', 0, d => (isX(d) ? '○' : '—')],
      ['総攻バフの掛け方', 1, d => (isInitSkill(d) ? TB_BY[tbByOf(d)] : '—')],
      ...[...Array(maxTr + 1).keys()].map(t => [
        `TR${t}`,
        0,
        d => (trEntry(d, t) ? skillLabel(trEntry(d, t), d) : '—'),
        d => {
          const e = trEntry(d, t);
          return `title="${e ? `素${N(e.base)} + 係数${N(e.coef)}×${COEF_SHORT[coefByOf(d)]}` : ''}"`;
        },
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
      ? `<label class="label" for="peopleIn">人数(${PEOPLE_FORMULA})</label>` +
        `<input id="peopleIn" type="number" value="${esc(config.people)}">` +
        '<button id="peopleSave" class="btn small ghost" type="button">人数を保存</button><span id="peopleMsg" class="msg"></span>'
      : `<span class="label">人数</span><b class="num">${fmt(N(config.people))}</b><span class="note">${PEOPLE_FORMULA}</span>`;
  const q = $('msearch').value.trim();
  const ed = isOwner ? 'editable' : '';
  const list = [...M[mtab]].filter(([, d]) => !q || String(d.name).includes(q)).sort(byName);
  const rows = mtab === 'jbuffs' ? jbuffList(q) : mtab === 'soldiers' ? soldierList(q) : list;
  const cols = LIST_COLS[mtab](rows);
  const emptyRow = `<tr><td class="l" colspan="${cols.length}" style="color:var(--muted)">${
    loaded[mtab] ? (q ? '該当なし' : `${LABEL[mtab]}はまだ登録されていません。`) : '読み込み中…'
  }</td></tr>`;
  const head = cols.map(([h, l]) => `<th${l ? ' class="l"' : ''}>${h}</th>`).join('');
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
  const warn = f === 'no' ? '<span class="msg err" id="f-no-warn" aria-live="polite"></span>' : '';
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
    ['muzin', '無尽(0:なし、1以上:あり)', 'number'],
    !ini && ['xskill', 'Xスキル', 'flag'],
    ini ? ['noMimic', '模倣', 'flag'] : ['mimic', '模倣', 'mimic'],
    ini && ef.total && ['tbBy', `総${sw(d)}バフの掛け方`, 'tbby'],
  ].filter(Boolean);
  const coefMaxBox =
    coefByOf(d) === 'same' && !mm
      ? `<div class="field"><div class="checks">${checkbox('id="f-coefMaxTr"', toFlag(d.coefMaxTr), '係数は部隊内武将のTRの最大値を参照')}</div></div>`
      : '';
  const effects = ini
    ? EFFS.map(
        ([k]) =>
          checkbox(`data-eff="${k}"`, ef[k], effLabel(d, k)) +
          (k === 'stat' && ef.stat
            ? checkbox('data-eff2="self"', ef.self, `${effLabel(d, 'stat')}は本人のみ`)
            : ''),
      ).join('') + checkbox('data-eff2="leader"', ef.leader, '部隊長限定')
    : checkbox('data-eff="dup"', dupOn(d), '重複上限');
  return (
    `<div class="grid">${fields.map(([f, l, t]) => fieldHtml(d, f, l, t)).join('')}</div>
    ${coefMaxBox}
    ${checksField(EFFECT_PROMPT, effects)}
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
    'スキル上昇率 = 素スキル上昇率 + 係数 × (人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数)。',
    coefMax(d) && '係数は、部隊内でこのスキルを持つ武将のうち、いちばん高いTRの係数を使います。',
    'Xスキルは通常枠にしか付けられません。',
  ];
  if (ini)
    notes.push(
      `素${b}バフ〜総${b}バフは、このスキルを初期スキルに持つ武将に効く値です。兵数加算は、同じ部隊の他の武将の兵数に足します(空欄なら0)。`,
      ef.stat &&
        (ef.self
          ? `素${b}バフは本人だけにかかります。`
          : `素${b}バフは、部隊のどこにいても部隊全員にかかります。`),
      ef.leader && '部隊長限定:部隊長の枠にいるときだけ、この初期スキルの効果が出ます。',
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
/* スキル編集画面のTR表の列 */
function skillTrCols(d) {
  const ini = toFlag(d.init) === 1,
    dup = dupOn(d) ? [['dupMax', '重複上限']] : [];
  if (!ini && isMimic(d))
    return [['tr', 'TR'], ['base', '素スキル上昇率'], ['mimicRate', '模倣倍率'], ...dup];
  if (!ini) return [...SKILL_TR, ...dup];
  return [
    ...SKILL_TR,
    ...initCols(d),
    ...(effsOf(d).total && tbByOf(d) === 'muzin' ? [['tbCoef', `総${sw(d)}バフ係数(%)`]] : []),
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
    <p class="note">傑バフがあると、対象兵種の攻撃力・防御力にこの値が足されます。「所属時」はこの傑カードが部隊に入っているとき、「外部」は部隊の外からかかるときの値です。</p>`;
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
  if (draft && e.target.dataset.eff2) {
    syncDraft();
    const d = draft.data;
    d.effs = { ...effsOf(d), [e.target.dataset.eff2]: e.target.checked };
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.eff === 'dup') {
    syncDraft();
    const d = draft.data;
    d.effs = { ...(d.effs || {}), dup: e.target.checked };
    if (e.target.checked)
      d.trs.forEach(t => {
        if (!hasV(t.dupMax)) t.dupMax = 2;
      });
    renderEditor();
    return;
  }
  if (draft && e.target.dataset.eff) {
    syncDraft();
    const d = draft.data,
      k = e.target.dataset.eff;
    d.effs = { ...effsOf(d), [k]: e.target.checked };
    /* チェックしたら空欄に最初の値(バフ・倍枠は1)を入れる */
    if (e.target.checked && k !== 'troop')
      for (const f of EFFS.find(x => x[0] === k)[2])
        d.trs.forEach(t => {
          if (!hasV(t[f])) t[f] = 1;
        });
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
/* 同じカードNoがほかに登録されていれば、そのデータを返す(武将・傑バフ)。M は Firestore と常に同期している */
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
$('editor').addEventListener('focusout', e => {
  if (e.target.id === 'f-no') checkNo();
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
    const dup = findId(M[coll], x => x.name === d.name);
    if (dup && dup !== draft.id) return '同じ名前がすでに登録されています';
  }
  if (d.trs) {
    if (!d.trs.length) return 'TRを1行以上入力してください';
    const s = d.trs.map(t => N(t.tr));
    if (new Set(s).size !== s.length) return '同じTRが2行あります';
  }
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
    renderEditor();
    msg(
      `初期スキルを追加してください。(武将「${data.name}」は保存しました。初期スキル「${iname}」がスキルマスタにありません)`,
      true,
    );
  }
});
