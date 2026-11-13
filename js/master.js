// マスタ管理画面(一覧・編集パネル・保存)
function renderMaster() {
  $('madd').hidden = !isOwner || mtab === 'skills';
  $('maddSkill').hidden = $('maddInit').hidden = !isOwner || mtab !== 'skills';
  $('mimport').hidden = !isOwner;
  $('mclean').hidden = !isOwner || !cleanPlan().n;
  const mzDiff =
    isOwner && mtab === 'cards'
      ? [...M.cards.values()]
          .filter(c => N(c.muzin) > 0 && skillByName(c.initName) && !(cardMuzin(c) > 0))
          .map(c => `${c.name}(初期スキル「${c.initName}」)`)
      : [];
  $('mnote').textContent = isOwner
    ? '行をクリックすると編集できます。保存した内容はすぐに全員の画面へ反映されます。' +
      (mzDiff.length
        ? ` ※無尽は初期スキルで判定します。以前武将マスタで無尽ありにしていた次の武将は、初期スキルの無尽が0です。スキルマスタで無尽を入れてください:${mzDiff.join('、')}`
        : '')
    : 'マスタの編集は管理者のみです。管理者は右上の「管理者ログイン」からログインしてください。ここでは内容を確認できます。';
  const pp = $('people');
  pp.hidden = mtab !== 'skills';
  if (mtab === 'skills')
    pp.innerHTML = isOwner
      ? `<label class="label" for="peopleIn">人数(スキル上昇率 = 素スキル上昇率 + 係数×人数)</label><input id="peopleIn" type="number" value="${esc(config.people)}"><button id="peopleSave" class="btn small ghost" type="button">人数を保存</button><span id="peopleMsg" class="msg"></span>`
      : `<span class="label">人数</span><b class="num">${fmt(N(config.people))}</b><span class="note">スキル上昇率 = 素スキル上昇率 + 係数×人数</span>`;
  const q = $('msearch').value.trim();
  const ed = isOwner ? 'editable' : '';
  const list = [...M[mtab]].filter(([, d]) => !q || String(d.name).includes(q)).sort(byName);
  const empty = cols =>
    `<tr><td class="l" colspan="${cols}" style="color:var(--muted)">${loaded[mtab] ? (q ? '該当なし' : `${LABEL[mtab]}はまだ登録されていません。`) : '読み込み中…'}</td></tr>`;
  let html = '';
  if (mtab === 'cards') {
    html =
      `<thead><tr><th class="l">カード名</th><th class="l">初期スキル名</th><th>カードNo</th><th class="l">レアリティ</th><th>コスト</th><th>兵数</th><th>素攻撃力</th><th>素防御力</th><th>攻撃上昇率</th><th>防御上昇率</th><th class="l">TR</th><th>最大TRの初期スキル</th><th>最大TRの総攻バフ</th><th>姫</th><th>剣豪</th><th>無尽</th></tr></thead><tbody>` +
      (list.length
        ? list
            .map(([id, d]) => {
              const t = cardTrs(d),
                last = t[t.length - 1] || {};
              return `<tr data-id="${esc(id)}" class="${ed}"><td class="l">${esc(d.name)}<span class="chip ${d.side === '攻撃・防御' ? 'side-both' : d.side === '防御' ? 'side-def' : d.side === '攻撃' ? 'side-atk' : ''}">${esc(d.side || '')}</span></td><td class="l">${esc(d.initName || '—')}</td><td class="num">${esc(d.no)}</td><td class="l">${esc(d.rarity)}</td><td class="num">${fmt(N(d.cost), 1)}</td><td class="num">${fmt(N(d.troops))}</td><td class="num">${fmt(N(d.baseStat))}</td><td class="num">${d.baseDef == null ? '—' : fmt(N(d.baseDef))}</td><td class="num">${fmt(N(d.growth), 2)}</td><td class="num">${d.growthDef == null ? '—' : fmt(N(d.growthDef), 2)}</td><td class="l">${trRange({ trs: t })}</td><td class="num">${fmt(initBase(d, last), 1)}</td><td class="num">${fmt(N(cardT(d, last.tr)?.totalBuff), 2)}</td><td class="num">${toFlag(d.hime) ? '姫' : '—'}</td><td class="num">${toFlag(d.kengou) ? '剣豪' : '—'}</td><td class="num">${cardMuzin(d) > 0 ? fmt(cardMuzin(d), 2) : '—'}</td></tr>`;
            })
            .join('')
        : empty(16)) +
      '</tbody>';
  } else if (mtab === 'skills') {
    const maxTr = Math.max(5, ...list.flatMap(([, d]) => trsOf(d).map(t => N(t.tr))));
    const trs = [...Array(maxTr + 1).keys()];
    html =
      `<thead><tr><th class="l">スキル名</th><th class="l">種類</th><th class="l">攻撃or防御</th><th>スキル付与</th><th class="l">係数の掛け方</th><th>無尽</th><th>Xスキル</th><th class="l">総攻バフの掛け方</th>${trs.map(t => `<th>TR${t}</th>`).join('')}</tr></thead><tbody>` +
      (list.length
        ? list
            .map(
              ([id, d]) =>
                `<tr data-id="${esc(id)}" class="${ed}"><td class="l">${esc(d.name)}</td><td class="l">${isInitSkill(d) ? '初期スキル' : 'スキル'}</td><td class="l"><span class="chip ${skillSide(d) === '攻撃・防御' ? 'side-both' : skillSide(d) === '防御' ? 'side-def' : 'side-atk'}">${skillSide(d)}</span></td><td class="num">${toFlag(d.noAdd) ? '不可' : '可'}</td><td class="l">${isMimic(d) ? '—' : COEF_SHORT[coefByOf(d)]}</td><td class="num">${N(d.muzin) > 0 ? fmt(N(d.muzin), 2) : '—'}</td><td class="num">${isX(d) ? '○' : '—'}</td><td class="l">${isInitSkill(d) ? TB_BY[tbByOf(d)] : '—'}</td>${trs
                  .map(t => {
                    const e = trEntry(d, t);
                    return `<td class="num" title="${e ? `素${N(e.base)} + 係数${N(e.coef)}×${COEF_SHORT[coefByOf(d)]}` : ''}">${e ? skillLabel(e, d) : '—'}</td>`;
                  })
                  .join('')}</tr>`,
            )
            .join('')
        : empty(trs.length + 8)) +
      '</tbody>';
  } else if (mtab === 'jbuffs') {
    const jl = [...M.jbuffs]
      .filter(
        ([, d]) =>
          !q ||
          String(d.name).includes(q) ||
          String(d.no).includes(q) ||
          (d.targets || []).some(t => t.includes(q)),
      )
      .sort(byNo);
    html =
      `<thead><tr><th>カードNo</th><th class="l">武将名</th><th class="l">対象兵種</th><th>所属時攻撃力</th><th>所属時防御力</th><th>外部攻撃力</th><th>外部防御力</th></tr></thead><tbody>` +
      (jl.length
        ? jl
            .map(
              ([id, d]) =>
                `<tr data-id="${esc(id)}" class="${ed}"><td class="num">${esc(d.no)}</td><td class="l">${esc(d.name)}</td><td class="l" style="white-space:normal;min-width:140px">${esc(targetsLabel(d))}</td>${JBUFF_VALS.map(f => `<td class="num">+${fmt(jv(d, f), 2)}</td>`).join('')}</tr>`,
            )
            .join('')
        : empty(7)) +
      '</tbody>';
  } else {
    const sl = [...M.soldiers]
      .filter(([, d]) => !q || String(d.name).includes(q) || String(d.branch || '').includes(q))
      .sort(bySoldierOrder);
    html =
      `<thead><tr><th class="l">兵種名</th><th class="l">兵科</th><th>攻撃力</th><th>防御力</th><th>破壊</th><th>速度</th></tr></thead><tbody>` +
      (sl.length
        ? sl
            .map(
              ([id, d]) =>
                `<tr data-id="${esc(id)}" class="${ed}"><td class="l">${esc(d.name)}</td><td class="l">${esc(d.branch || '')}</td>${['atk', 'def', 'destroy', 'speed'].map(f => `<td class="num">${d[f] == null ? '—' : fmt(N(d[f]), 2)}</td>`).join('')}</tr>`,
            )
            .join('')
        : empty(6)) +
      '</tbody>';
  }
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
function renderEditor() {
  const box = $('editor');
  if (!draft || !isOwner) {
    box.innerHTML = '';
    return;
  }
  const { coll, id, data: d } = draft;
  const inp = (f, label, type) =>
    f === 'initName'
      ? `<div class="field"><label class="label" for="f-${f}">${label}</label><input id="f-${f}" data-f="${f}" type="text" list="skillNames" autocomplete="off" placeholder="スキルマスタから選択" value="${esc(d[f] ?? '')}"></div>`
      : type === 'check'
        ? `<div class="field"><span class="label">${label}</span><label class="checkline"><input type="checkbox" id="f-${f}" data-f="${f}"${toFlag(d[f]) ? ' checked' : ''}>${label}</label></div>`
        : type === 'invcheck'
          ? `<div class="field"><span class="label">模倣</span><label class="checkline"><input type="checkbox" id="f-${f}" data-f="${f}" data-inv="1"${toFlag(d[f]) ? '' : ' checked'}>${label}</label></div>`
          : type === 'mimic'
            ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}">${Object.entries(
                MIMIC,
              )
                .map(([v, l]) => `<option value="${v}"${mimicOf(d) === v ? ' selected' : ''}>${l}</option>`)
                .join('')}</select></div>`
            : type === 'tbby'
              ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}">${Object.entries(
                  TB_BY,
                )
                  .map(([v, l]) => `<option value="${v}"${tbByOf(d) === v ? ' selected' : ''}>${l}</option>`)
                  .join('')}</select></div>`
              : type === 'coef'
                ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}">${Object.entries(
                    COEF_BY,
                  )
                    .map(
                      ([v, l]) => `<option value="${v}"${coefByOf(d) === v ? ' selected' : ''}>${l}</option>`,
                    )
                    .join('')}</select></div>`
                : type === 'rarity'
                  ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}">${(RARITIES.includes(d[f]) || !d[f] ? RARITIES : [...RARITIES, d[f]]).map(v => `<option${d[f] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`
                  : type === 'flag'
                    ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}" data-flag="1">${(FLAG_LABELS[f] || ['0', '1']).map((l, v) => `<option value="${v}"${toFlag(d[f]) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`
                    : type === 'side'
                      ? `<div class="field"><label class="label" for="f-${f}">${label}</label><select id="f-${f}" data-f="${f}">${['攻撃', '防御', '攻撃・防御'].map(v => `<option${d[f] === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`
                      : `<div class="field"><label class="label" for="f-${f}">${label}</label><input id="f-${f}" data-f="${f}" type="${type}" ${type === 'number' ? 'step="any"' : ''} value="${esc(d[f] ?? '')}"></div>`;
  let body = '';
  if (coll === 'cards') {
    body = `<div class="grid">${CARD_FIELDS.map(([f, l, t]) => inp(f, l, t)).join('')}</div>
    <datalist id="skillNames">${[...M.skills.values()].map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
    <div id="initArea" data-key="${esc(String(d.initName ?? '').trim())}">${initAreaHtml(d)}</div>`;
  } else if (coll === 'skills') {
    const ini = toFlag(d.init) === 1;
    body =
      `<div class="grid">${inp('name', 'スキル名', 'text')}${inp('side', '攻撃or防御', 'side')}${inp('noAdd', 'スキル付与', 'flag')}${!ini && isMimic(d) ? '' : inp('coefBy', '係数の掛け方', 'coef')}${inp('muzin', '無尽(0:なし、1以上:あり)', 'number')}${ini ? '' : inp('xskill', 'Xスキル', 'flag')}${ini ? inp('noMimic', '模倣', 'flag') : inp('mimic', '模倣', 'mimic')}${ini && effsOf(d).total ? inp('tbBy', `総${sw(d)}バフの掛け方`, 'tbby') : ''}</div>
    ${coefByOf(d) === 'same' && !(!ini && isMimic(d)) ? `<div class="field"><div class="checks"><label><input type="checkbox" id="f-coefMaxTr"${toFlag(d.coefMaxTr) ? ' checked' : ''}>係数は部隊内武将のTRの最大値を参照</label></div></div>` : ''}
    ${
      ini
        ? `<div class="field"><span class="label">特殊効果にチェックを入れてください(チェックした効果の値をTR表で入力)</span><div class="checks">${EFFS.map(([k]) => `<label><input type="checkbox" data-eff="${k}"${effsOf(d)[k] ? ' checked' : ''}>${effLabel(d, k)}</label>` + (k === 'stat' && effsOf(d).stat ? `<label><input type="checkbox" data-eff2="self"${effsOf(d).self ? ' checked' : ''}>${effLabel(d, 'stat')}は本人のみ</label>` : '')).join('')}<label><input type="checkbox" data-eff2="leader"${effsOf(d).leader ? ' checked' : ''}>部隊長限定</label></div></div>`
        : `<div class="field"><span class="label">特殊効果にチェックを入れてください(チェックした効果の値をTR表で入力)</span><div class="checks"><label><input type="checkbox" data-eff="dup"${dupOn(d) ? ' checked' : ''}>重複上限</label></div></div>`
    }
    <p class="note">スキル上昇率 = 素スキル上昇率 + 係数 × (人数 / 部隊内の同じスキルの数 / 部隊内のXスキルの数)。${coefMax(d) ? '係数は、部隊内でこのスキルを持つ武将のうち、いちばん高いTRの係数を使います。' : ''}Xスキルは通常枠にしか付けられません。${ini ? `素${sw(d)}バフ〜総${sw(d)}バフは、このスキルを初期スキルに持つ武将に効く値です。兵数加算は、同じ部隊の他の武将の兵数に足します(空欄なら0)。${effsOf(d).stat ? (effsOf(d).self ? `素${sw(d)}バフは本人だけにかかります。` : `素${sw(d)}バフは、部隊のどこにいても部隊全員にかかります。`) : ''}${effsOf(d).leader ? '部隊長限定:部隊長の枠にいるときだけ、この初期スキルの効果が出ます。' : ''}` : ''}${ini && effsOf(d).total && tbByOf(d) === 'muzin' ? `総${sw(d)}バフ = 総${sw(d)}バフ + 無尽を持つ武将数(本人を含む、最大4) × 総${sw(d)}バフ係数 ÷ 100 × 無尽2倍(無尽部隊で本人が無尽を持つとき)。係数は %で、4%なら 4 と入力します。` : ''}${!ini && isMimic(d) ? `模倣スキルの値 = 素スキル上昇率 + 模倣倍率 × ${mimicOf(d) === 'self' ? '自分' : '部隊長'}の初期スキルのスキル上昇率(部隊の中で計算した値)。特殊効果は模倣しません。極限枠でも ×1.2 はかけません。${mimicOf(d) === 'leader' ? '部隊長に付けたときは効果なし。' : ''}` : ''}${skillSide(d) === '防御' ? '防御スキルの値は、攻撃部隊の計算では使いません(倍枠通常・倍枠極限は使います)。' : ''}</p>` +
      trTable(
        !ini && isMimic(d)
          ? [
              ['tr', 'TR'],
              ['base', '素スキル上昇率'],
              ['mimicRate', '模倣倍率'],
              ...(dupOn(d) ? [['dupMax', '重複上限']] : []),
            ]
          : !ini
            ? [...SKILL_TR, ...(dupOn(d) ? [['dupMax', '重複上限']] : [])]
            : ini
              ? [
                  ...SKILL_TR,
                  ...initCols(d),
                  ...(effsOf(d).total && tbByOf(d) === 'muzin' ? [['tbCoef', `総${sw(d)}バフ係数(%)`]] : []),
                ]
              : SKILL_TR,
        d.trs,
        t => skillLabel(t, d),
        'スキル上昇率',
      );
  } else if (coll === 'jbuffs') {
    const sold = [...M.soldiers].sort(bySoldierOrder),
      tg = d.targets || [],
      unknown = tg.filter(t => !sold.some(([, x]) => x.name === t));
    body = `<div class="grid">${JBUFF_FIELDS.map(([f, l, t]) => inp(f, l, t)).join('')}</div>
    <div class="field"><span class="label">対象兵種(チェックなしなら全兵種)</span><div class="checks">${sold.map(([, x]) => `<label><input type="checkbox" name="jtarget" value="${esc(x.name)}"${tg.includes(x.name) ? ' checked' : ''}>${esc(x.name)}</label>`).join('') || '<span class="note">兵種マスタが空です</span>'}</div>
    ${unknown.length ? `<p class="msg err">兵種マスタにない兵種が指定されています:${unknown.map(esc).join('、')}(このまま残ります)</p>` : ''}</div>
    <p class="note">傑バフがあると、対象兵種の攻撃力・防御力にこの値が足されます。「所属時」はこの傑カードが部隊に入っているとき、「外部」は部隊の外からかかるときの値です。</p>`;
  } else
    body = `<div class="grid">${SOLDIER_FIELDS.map(([f, l, t]) => inp(f, l, t)).join('')}</div><p class="note">攻撃力は攻撃部隊、防御力は防御部隊の計算に使います。</p>`;
  box.innerHTML = `<form class="editor" id="edform" novalidate><strong>${coll === 'skills' ? (id ? `${esc(d.name)} を編集(${toFlag(d.init) ? '初期スキル' : 'スキル'})` : (toFlag(d.init) ? '初期スキル' : 'スキル') + 'を追加') : id ? esc(d.name) + ' を編集' : LABEL[coll] + 'を追加'}</strong>${body}
    <div class="actions"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit">保存</button><button class="btn ghost" type="button" data-act="close">閉じる</button></div>
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
function trTable(cols, trs, computed, clabel, ro) {
  return `<div class="field"><span class="label">TRごとの値</span><div class="trtable"><table><thead><tr>${cols.map(c => `<th class="l">${c[1]}</th>`).join('')}${computed ? `<th>${clabel}</th>` : ''}<th></th></tr></thead><tbody>
  ${trs
    .map(
      (t, r) =>
        `<tr>${cols
          .map(([f, l]) => {
            const v = ro ? ro(f, t) : null;
            return v != null
              ? `<td class="num computed" title="スキルマスタの値">${v}</td>`
              : `<td class="l"><input class="${f === 'tr' ? 'tr' : ''}" type="number" step="any" data-t="${r}:${f}" aria-label="${l}" value="${esc(t[f] ?? '')}"></td>`;
          })
          .join(
            '',
          )}${computed ? `<td class="num computed" data-c="${r}">${computed(t)}</td>` : ''}<td><button class="btn small danger" type="button" data-act="rmtr" data-r="${r}"${trs.length < 2 ? ' disabled' : ''}>行を削除</button></td></tr>`,
    )
    .join('')}
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
function validate(coll, d) {
  if (!String(d.name || '').trim()) return '名前を入力してください';
  if (coll === 'cards') {
    if (d.no === '' || !Number.isFinite(Number(d.no))) return 'カードNoを入力してください';
    if (
      findId(M.cards, x => String(x.no) === String(d.no)) &&
      findId(M.cards, x => String(x.no) === String(d.no)) !== draft.id
    )
      return `カードNo ${d.no} はすでに登録されています`;
    if (!String(d.initName ?? '').trim()) return '初期スキル名を入力してください';
  } else if (coll === 'jbuffs') {
    if (d.no === '' || !Number.isFinite(Number(d.no))) return 'カードNoを入力してください';
    const dup = findId(M.jbuffs, x => String(x.no) === String(d.no));
    if (dup && dup !== draft.id) return `カードNo ${d.no} はすでに登録されています`;
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
  if (coll === 'cards') {
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
  if (coll === 'skills')
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
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
    /* 以前武将マスタに登録したTRの値があれば、それを最初の値にする */
    const old = trsOf(data);
    if (old.length)
      (delete draft.data.effs,
        (draft.data.trs = old.map(t => ({
          tr: N(t.tr),
          base: N(t.initSkill),
          coef: 0,
          statBuff: N(t.statBuff),
          mulNormal: N(t.mulNormal),
          mulLimit: N(t.mulLimit),
          totalBuff: N(t.totalBuff),
        }))));
    renderEditor();
    msg(
      `初期スキルを追加してください。(武将「${data.name}」は保存しました。初期スキル「${iname}」がスキルマスタにありません)`,
      true,
    );
  }
});
