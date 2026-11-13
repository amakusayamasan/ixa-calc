// 部隊計算画面(編成の保存、武将・スキルの候補、画面の描画、傑バフの選択)
/* 端末への記憶はIDではなく「カードNo・スキル名・兵種名」で持つ */
function toKeys(f) {
  return {
    jin: f.jin,
    jb: (f.jb || []).map(String),
    slots: f.slots.map(s => ({
      card: String(M.cards.get(s.card)?.no ?? ''),
      tr: s.tr,
      alloc: s.alloc === 'hei' ? 'hei' : 'atk',
      soldier: M.soldiers.get(s.soldier)?.name || '',
      s1: [M.skills.get(s.s1.id)?.name || '', s.s1.tr],
      s2: [M.skills.get(s.s2.id)?.name || '', s.s2.tr],
      lim: [M.skills.get(s.lim.id)?.name || '', s.lim.tr],
    })),
  };
}
function fromKeys(f) {
  if (!f || typeof f !== 'object') f = SAMPLE;
  if (!Array.isArray(f.slots) || f.slots.length !== 4) f = { ...f, slots: SAMPLE.slots };
  const sk = v => {
    const [n, tr] = Array.isArray(v) ? v : ['', 0];
    return { id: n ? findId(M.skills, d => d.name === n) : '', tr: N(tr) };
  };
  return {
    jin: f.jin ?? 1.05,
    jb: Array.isArray(f.jb)
      ? [
          ...new Set(
            f.jb
              .filter(x => typeof x !== 'object' || x.mode !== 'in')
              .map(x => String(typeof x === 'object' ? x.no : x)),
          ),
        ]
      : [],
    slots: f.slots.map(s => ({
      card: findId(M.cards, d => String(d.no) === String(s.card)),
      tr: N(s.tr),
      alloc: s.alloc === 'hei' ? 'hei' : 'atk',
      soldier: findId(M.soldiers, d => d.name === s.soldier),
      s1: sk(s.s1),
      s2: sk(s.s2),
      lim: sk(s.lim),
    })),
  };
}
const byName = (a, b) =>
  String(a[1].name).localeCompare(String(b[1].name), 'ja', { numeric: true }) || N(a[1].no) - N(b[1].no);
/* 武将検索。同じ武将(カード名が同じもの。パラレルも含む)は他の枠で選べない */
const kana = s =>
  String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
function cardItems(i, q) {
  const taken = new Set(
    form.slots
      .filter((_, j) => j !== i)
      .map(s => M.cards.get(s.card)?.name)
      .filter(Boolean),
  );
  const words = kana(q).split(/\s+/).filter(Boolean),
    sel = form.slots[i].card;
  return [...M.cards]
    .filter(([, d]) => d.side !== '防御')
    .sort(byName)
    .filter(([, d]) => {
      const hay = kana(`${d.name} ${d.rarity} No.${d.no} ${d.no}`);
      return words.every(w => hay.includes(w));
    })
    .map(([id, d]) => ({ id, d, off: id !== sel && taken.has(d.name) }));
}
/* スキル検索。同じスキルは複数の枠で使える */
function soldierItems(q) {
  const words = kana(q).split(/\s+/).filter(Boolean);
  return [...M.soldiers]
    .sort(byName)
    .filter(([, d]) => words.every(w => kana(d.name).includes(w)))
    .map(([id, d]) => ({ id, d, off: false }));
}
/* 同じ武将の中では、同じスキルを2つ以上の欄に入れられない(他の武将とは重なってよい) */
const SKILL_KEYS = ['s1', 's2', 'lim'];
/* 初期スキル名(武将マスタ)。同じ名前のスキルは、その武将の追加スキル・極限スキルに付けられない */
const initNameOf = id => String(M.cards.get(id)?.initName ?? '').trim();
function skillItems(i, k, q) {
  const words = kana(q).split(/\s+/).filter(Boolean);
  const taken = new Set(
      SKILL_KEYS.filter(x => x !== k)
        .map(x => form.slots[i][x].id)
        .filter(Boolean),
    ),
    init = initNameOf(form.slots[i].card);
  /* 付与できないスキルと、防御スキル(攻撃部隊では効果なし)は候補に出さない */
  return [...M.skills]
    .sort(byName)
    .filter(([, d]) => toFlag(d.noAdd) !== 1 && forAtk(d))
    .filter(([, d]) => words.every(w => kana(d.name).includes(w)))
    .map(([id, d]) => {
      const xl = k === 'lim' && isX(d),
        il = !!init && String(d.name).trim() === init,
        na = toFlag(d.noAdd) === 1;
      return {
        id,
        d,
        off: taken.has(id) || xl || il || na,
        why: na
          ? '付与できないスキル'
          : il
            ? 'この武将の初期スキル'
            : xl
              ? 'Xスキルは極限枠に付けられません'
              : 'この武将で使用中',
      };
    });
}
/* 検索欄は「枠番号 i」と「種類 k(card / s1 / s2 / lim)」で区別する */
const KIND = { card: '武将', soldier: '兵種', s1: '追加スキル', s2: '追加スキル2', lim: '極限スキル' };
const inputId = (i, k) => `${k}-${i}`,
  listId = (i, k) => `list-${k}-${i}`,
  trId = (i, k) => (k === 'card' ? `cardtr-${i}` : k === 'soldier' ? '' : `${k}tr-${i}`);
const selOf = (i, k) =>
  k === 'card' ? form.slots[i].card : k === 'soldier' ? form.slots[i].soldier : form.slots[i][k].id;
const mapOf = k => (k === 'card' ? M.cards : k === 'soldier' ? M.soldiers : M.skills);
const nameOf = (i, k) => mapOf(k).get(selOf(i, k))?.name || '';
const rarClass = r => {
  const v = String(r || '');
  return v === '傑' ? 'rar-ketsu' : v === '極' ? 'rar-goku' : 'rar-ten';
};
function metaOf(k, x) {
  if (k === 'soldier') return `兵士攻撃力 ${fmt(N(x.d.atk), 2)}`;
  if (k === 'card')
    return `${esc(x.d.rarity || '')} No.${esc(x.d.no)} ・ ${trRange(cardV(x.d))}${x.off ? ' ・ 他の枠で使用中' : ''}`;
  const t = trsOf(x.d),
    last = t[t.length - 1];
  return `${isX(x.d) ? 'Xスキル ・ ' : ''}${trRange(x.d)}${last ? ` ・ TR${N(last.tr)}で ${skillLabel(last, x.d)}` : ''}${x.off ? ' ・ ' + x.why : ''}`;
}
let combo = null;
function openCombo(i, k, q) {
  const input = $(inputId(i, k)),
    list = $(listId(i, k));
  if (!input || !list) return;
  if (combo && (combo.i !== i || combo.k !== k)) closeCombo(true);
  const items = k === 'card' ? cardItems(i, q) : k === 'soldier' ? soldierItems(q) : skillItems(i, k, q);
  const cur = items.findIndex(x => x.id === selOf(i, k));
  combo = { i, k, items, active: !q && cur >= 0 ? cur : items.findIndex(x => !x.off) };
  drawCombo();
}
function drawCombo() {
  if (!combo) return;
  const { i, k, items, active } = combo,
    list = $(listId(i, k)),
    input = $(inputId(i, k));
  if (!list) return;
  const sel = selOf(i, k),
    clear = sel
      ? `<li role="option" class="clear" data-pick="">${['s1', 's2', 'lim'].includes(k) ? 'なしにする' : '選択を外す'}</li>`
      : '';
  list.innerHTML =
    clear +
    (items.length
      ? items
          .map(
            (
              x,
              n,
            ) => `<li role="option" id="opt-${k}-${i}-${n}" data-pick="${esc(x.id)}" class="${x.off ? 'off' : ''}${n === active ? ' active' : ''}${k === 'card' ? ' rar ' + rarClass(x.d.rarity) : ''}" aria-selected="${x.id === sel}" aria-disabled="${x.off}">
    <span>${esc(x.d.name)}</span><span class="meta">${metaOf(k, x)}</span></li>`,
          )
          .join('')
      : '<li class="none">見つかりません</li>');
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  if (active >= 0) {
    input.setAttribute('aria-activedescendant', `opt-${k}-${i}-${active}`);
    $(`opt-${k}-${i}-${active}`)?.scrollIntoView({ block: 'nearest' });
  } else input.removeAttribute('aria-activedescendant');
}
function closeCombo(restore) {
  if (!combo) return;
  const { i, k } = combo,
    list = $(listId(i, k)),
    input = $(inputId(i, k));
  combo = null;
  if (list) list.hidden = true;
  if (input) {
    input.setAttribute('aria-expanded', 'false');
    if (restore) input.value = nameOf(i, k);
  }
}
function pick(i, k, id) {
  closeCombo(false);
  const s = form.slots[i];
  if (k === 'card') {
    s.card = id;
    s.tr = fitTr(cardV(M.cards.get(id)), s.tr);
  } else if (k === 'soldier') {
    s.soldier = id;
  } else {
    s[k].id = id;
    s[k].tr = fitTr(M.skills.get(id), s[k].tr);
  }
  renderCalc();
  const next = id ? trId(i, k) && $(trId(i, k)) : $(inputId(i, k));
  next && next.focus();
}
function moveActive(step) {
  const { items } = combo;
  if (!items.length) return;
  let n = combo.active;
  for (let c = 0; c < items.length; c++) {
    n = (n + step + items.length) % items.length;
    if (!items[n].off) break;
  }
  combo.active = n;
  drawCombo();
}
const comboOf = t =>
  t.classList && t.classList.contains('combo-in') ? { i: +t.dataset.i, k: t.dataset.c } : null;
$('slots').addEventListener('focusin', e => {
  const c = comboOf(e.target);
  if (!c) return;
  e.target.select();
  openCombo(c.i, c.k, '');
});
$('slots').addEventListener('input', e => {
  const c = comboOf(e.target);
  if (c) openCombo(c.i, c.k, e.target.value);
});
$('slots').addEventListener('keydown', e => {
  const c = comboOf(e.target);
  if (!c) return;
  if (!combo) {
    if (e.key === 'ArrowDown') {
      openCombo(c.i, c.k, '');
      e.preventDefault();
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    moveActive(1);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    moveActive(-1);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    const x = combo.items[combo.active];
    e.preventDefault();
    if (x && !x.off) pick(c.i, c.k, x.id);
  } else if (e.key === 'Escape') {
    closeCombo(true);
    e.preventDefault();
  }
});
$('slots').addEventListener('mousedown', e => {
  const li = e.target.closest('li[data-pick]');
  if (!li) return;
  e.preventDefault();
  if (li.classList.contains('off')) return;
  const box = li.closest('.combo');
  pick(+box.dataset.i, box.dataset.c, li.dataset.pick);
});
$('slots').addEventListener('focusout', e => {
  const c = comboOf(e.target);
  if (c && combo && combo.i === c.i && combo.k === c.k) closeCombo(true);
});
const isJCard = id => M.cards.get(id)?.rarity === '傑';
const comboBox = (
  i,
  k,
  value,
  ph,
  off,
) => `<div class="combo${k === 'soldier' ? ' solo' : ''}" data-i="${i}" data-c="${k}"><input id="${inputId(i, k)}" class="combo-in" data-i="${i}" data-c="${k}"${off ? ' disabled' : ''} type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listId(i, k)}" autocomplete="off" placeholder="${ph}" value="${esc(value)}">
  <ul id="${listId(i, k)}" class="combo-list" role="listbox" aria-label="${KIND[k]}の候補" hidden></ul></div>`;
function soldierOpts(sel) {
  return (
    '<option value="">— 兵種 —</option>' +
    [...M.soldiers]
      .sort(bySoldierOrder)
      .map(
        ([id, d]) =>
          `<option value="${esc(id)}"${id === sel ? ' selected' : ''}>${esc(d.name)}(攻${fmt(N(d.atk))})</option>`,
      )
      .join('')
  );
}
function trOpts(d, sel) {
  const t = trsOf(d);
  if (!t.length) return '<option value="">—</option>';
  return t
    .map(x => `<option value="${N(x.tr)}"${N(x.tr) === N(sel) ? ' selected' : ''}>TR${N(x.tr)}</option>`)
    .join('');
}
function renderCalc() {
  const box = $('slots');
  combo = null;
  if (!allLoaded()) {
    box.innerHTML = '<p class="note">マスタを読み込んでいます…</p>';
    return;
  }
  if (!M.cards.size) {
    box.innerHTML =
      '<p class="note">武将マスタがまだ登録されていません。「マスタ管理」から登録すると、ここで部隊を組めます。</p>';
    return;
  }
  if (!form) form = fromKeys(store.get('ixa-form-v2') || SAMPLE);
  $('jin').value = form.jin;
  if (!form.jb) form.jb = [];
  renderJb();
  {
    const seen = new Set();
    for (const s of form.slots) {
      const n = M.cards.get(s.card)?.name;
      if (!n) continue;
      if (seen.has(n)) s.card = '';
      else seen.add(n);
    }
  }
  /* 傑カードは通常枠・極限枠にスキルを付けられない */
  for (const s of form.slots) if (isJCard(s.card)) for (const k of SKILL_KEYS) s[k] = { id: '', tr: 0 };
  for (const s of form.slots) if (s.lim.id && isX(M.skills.get(s.lim.id))) s.lim = { id: '', tr: 0 };
  for (const s of form.slots)
    for (const k of SKILL_KEYS) if (s[k].id && toFlag(M.skills.get(s[k].id)?.noAdd)) s[k] = { id: '', tr: 0 };
  for (const s of form.slots) {
    const init = initNameOf(s.card);
    if (init)
      for (const k of SKILL_KEYS)
        if (s[k].id && String(M.skills.get(s[k].id)?.name ?? '').trim() === init) s[k] = { id: '', tr: 0 };
  }
  for (const s of form.slots) {
    const used = new Set();
    for (const k of SKILL_KEYS) {
      const id = s[k].id;
      if (!id) continue;
      if (used.has(id)) s[k].id = '';
      else used.add(id);
    }
  }
  const skillRow = (
    i,
    k,
    label,
    s,
    off,
  ) => `<div class="field"><label class="label" for="${k}-${i}">${label}</label><div class="pair">
    ${comboBox(i, k, M.skills.get(s.id)?.name || '', off ? '傑は付与不可' : 'なし', off)}
    <select id="${k}tr-${i}" data-i="${i}" data-k="${k}tr" aria-label="${label}のTR"${s.id && !off ? '' : ' disabled'}>${trOpts(M.skills.get(s.id), s.tr)}</select></div><p class="eff" id="eff-${k}-${i}" aria-live="polite"></p></div>`;
  box.innerHTML = form.slots
    .map(
      (s, i) => `<div class="slot${i === 0 ? ' leader' : ''}">
    <h3><span>${SLOT_NAMES[i]}</span></h3>
    <div class="field"><label class="label" for="card-${i}">武将</label><div class="pair">
      ${comboBox(i, 'card', M.cards.get(s.card)?.name || '', '武将名・カードNoで検索')}
      <select id="cardtr-${i}" data-i="${i}" data-k="tr" aria-label="武将のTR"${s.card ? '' : ' disabled'}>${trOpts(cardV(M.cards.get(s.card)), s.tr)}</select></div>${s.card ? `<span class="note" id="cardmeta-${i}">${esc(M.cards.get(s.card)?.rarity || '')} No.${esc(M.cards.get(s.card)?.no)}${initNameOf(s.card) ? ` ・ 初期:${esc(initNameOf(s.card))}` : ''}</span>` : ''}
      <div class="alloc"><span class="label">ステ振り</span><div class="seg" role="group" aria-label="ステ振り">
        <button type="button" data-alloc="atk" data-i="${i}" aria-pressed="${s.alloc !== 'hei'}">攻撃</button><button type="button" data-alloc="hei" data-i="${i}" aria-pressed="${s.alloc === 'hei'}">兵法</button></div></div></div>
    <div class="field"><label class="label" for="soldier-${i}">兵種</label><select id="soldier-${i}" data-i="${i}" data-k="soldier">${soldierOpts(s.soldier)}</select></div>
    ${skillRow(i, 's1', '追加スキル', s.s1, isJCard(s.card))}${skillRow(i, 's2', '追加スキル2', s.s2, isJCard(s.card))}${skillRow(i, 'lim', '極限スキル', s.lim, isJCard(s.card))}
    <div class="calc" id="calc-${i}"></div></div>`,
    )
    .join('');
  updateResults();
}
/* TRが無いときは、いちばん高いTRに合わせる */
const fitTr = (d, tr) => {
  const t = trsOf(d);
  if (!t.length) return 0;
  return trEntry(d, tr) ? N(tr) : N(t[t.length - 1].tr);
};
$('slots').addEventListener('click', e => {
  const b = e.target.closest('[data-alloc]');
  if (!b || !form) return;
  const s = form.slots[+b.dataset.i];
  s.alloc = b.dataset.alloc;
  for (const x of b.parentElement.children) x.setAttribute('aria-pressed', String(x === b));
  updateResults();
});
$('slots').addEventListener('change', e => {
  const t = e.target,
    k = t.dataset.k;
  if (!k) return;
  const s = form.slots[+t.dataset.i];
  if (k === 'tr') {
    s.tr = N(t.value);
  } else if (k === 'soldier') {
    s.soldier = t.value;
  } else if (k.endsWith('tr')) {
    s[k.slice(0, -2)].tr = N(t.value);
  }
  updateResults();
});
$('jin').addEventListener('input', e => {
  if (form) {
    form.jin = parseFloat(e.target.value);
    updateResults();
  }
});
$('resetForm').addEventListener('click', () => {
  form = fromKeys(SAMPLE);
  renderCalc();
});
function renderJb() {
  const btn = $('jbBtn'),
    panel = $('jbpanel');
  const out = form ? jbOuter() : [],
    inn = form ? jbInUnit() : [];
  const parts = [];
  if (out.length) parts.push(`外部${out.length}件`);
  if (inn.length) parts.push(`所属${inn.length}件`);
  btn.textContent = parts.length ? `傑バフ:${parts.join('・')}` : '傑バフ:なし';
  btn.classList.toggle('on', parts.length > 0);
  btn.setAttribute('aria-expanded', String(!panel.hidden));
  if (panel.hidden || !form) return;
  const list = [...M.jbuffs].filter(([, d]) => jbHasOuter(d)).sort(byNo),
    sel = new Set(jbOuter().map(d => String(d.no))),
    innNos = new Set(inn.map(d => String(d.no)));
  panel.innerHTML = `<div class="jbhead"><strong>外部からかける傑バフを選ぶ</strong><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" type="button" data-jb-act="all"${list.length && list.some(([, d]) => !sel.has(String(d.no))) ? '' : ' disabled'}>傑バフすべてOn</button><button class="btn small ghost" type="button" data-jb-act="clear"${sel.size ? '' : ' disabled'}>傑バフすべてOff</button><button class="btn small" type="button" data-jb-act="close">閉じる</button></div></div>
    <p class="note">チェックした傑バフの「外部」の攻撃力が、対象兵種の兵士攻撃力に足されます。その傑カードが部隊長・小隊長の枠にいる場合は「所属時」の攻撃力が自動で足され、外部にもチェックがあれば両方を合計します。防御力は防御部隊の計算で使います。</p>
    <div class="jblist">${
      list.length
        ? list
            .map(([id, d]) => {
              const no = String(d.no),
                on = sel.has(no),
                inU = innNos.has(no);
              return `<div class="jbrow${on || inU ? ' on' : ''}"><label><input type="checkbox" data-jb="${esc(no)}"${on ? ' checked' : ''}><span><b>${esc(d.name)}</b><br><span class="meta">No.${esc(no)} ・ 対象:${esc(targetsLabel(d))}</span></span></label>
      <div class="jbvals"><span class="${on ? 'jbon' : ''}">外部 攻+${fmt(jv(d, 'atkOut'), 2)}</span><span class="${inU ? 'jbon' : ''}">${inU ? '部隊に所属中:' : ''}所属時 攻+${fmt(jv(d, 'atkIn'), 2)}</span></div></div>`;
            })
            .join('')
        : '<p class="note">外部攻撃力が登録された傑バフがありません。マスタ管理の「傑バフ」タブで、外部攻撃力を登録してください。</p>'
    }</div>`;
}
$('jbBtn').addEventListener('click', () => {
  const p = $('jbpanel');
  p.hidden = !p.hidden;
  renderJb();
});
$('jbpanel').addEventListener('click', e => {
  if (!form) return;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.jbAct === 'close') {
    $('jbpanel').hidden = true;
    renderJb();
    $('jbBtn').focus();
    return;
  }
  if (b.dataset.jbAct === 'clear') {
    form.jb = [];
    renderJb();
    updateResults();
  }
  if (b.dataset.jbAct === 'all') {
    form.jb = [...M.jbuffs.values()]
      .filter(jbHasOuter)
      .sort((a, b) => N(a.no) - N(b.no))
      .map(d => String(d.no));
    renderJb();
    updateResults();
  }
});
$('jbpanel').addEventListener('change', e => {
  if (!form) return;
  const c = e.target.closest('[data-jb]');
  if (!c) return;
  const no = c.dataset.jb;
  form.jb = (form.jb || []).map(String).filter(x => x !== no);
  if (c.checked) form.jb.push(no);
  renderJb();
  updateResults();
});
