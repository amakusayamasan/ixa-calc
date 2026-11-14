// まとめて追加(部隊計算画面):スキルを3つまで選んで、1人か全員の 追加スキル・追加スキル2・極限スキル にまとめて入れる
// 使うファイル:core.js、fields.js、skills.js、calc-view.js、master.js(調べ方:node tests/deps.js)
/* 選んだ順に 通常1 → 通常2 → 極限。選んだスキルをもう一度タップすると外れる(ほかの枠はそのまま、空いた枠に次のタップが入る)。
   反映するときは、選んでいない枠は今のスキルのまま。TRは選択画面で選んだTR(そのTRがないスキルはいちばん大きいTR) */
const BULK_SLOTS = [
  ['s1', '通常1'],
  ['s2', '通常2'],
  ['lim', '極限'],
];
const BULK_MARK = ['①', '②', '極'];
const bulk = { open: false, people: '', tr: 0, q: '', pick: [null, null, null], target: 'all', msg: '' };
/* 並べ替え・表示の値:今の部隊タイプ(攻撃・防御)の値で、人数・総コストの掛け方だけ数字で比べる */
function bulkValue(d, tr) {
  const t0 = trEntry(d, tr);
  if (!t0 || isMimic(d)) return null;
  const t = modeTr(d, t0),
    by = coefByOf(d);
  if (by === 'people') return skillValue(t);
  if (by === 'cost') return skillValue(t, enemyCost());
  return null;
}
function bulkItems() {
  const words = kana(bulk.q).split(/\s+/).filter(Boolean);
  const list = [...M.skills]
    .filter(([, d]) => toFlag(d.noAdd) !== 1 && !isInitSkill(d) && forMode(d))
    .filter(([, d]) => !bulk.people || (peopleSkill(d) ? 'yes' : 'no') === bulk.people)
    .filter(([, d]) => words.every(w => kana(d.name).includes(w)))
    .sort(byName)
    .map(([id, d]) => ({ id, d, v: bulkValue(d, bulk.tr) }));
  /* スキル上昇率の高い順。数字で比べられないものは一番下(名前順) */
  return list.sort((a, b) => (a.v == null || b.v == null ? (a.v == null) - (b.v == null) : b.v - a.v));
}
function renderBulk() {
  const p = $('bulkpanel');
  $('bulkBtn').setAttribute('aria-expanded', bulk.open);
  p.hidden = !bulk.open;
  if (!bulk.open) return;
  const maxTr = Math.max(5, ...[...M.skills.values()].flatMap(d => trsOf(d).map(t => N(t.tr))));
  const seg = (items, cur, attr) =>
    items
      .map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${cur === v}">${l}</button>`)
      .join('');
  const rows = bulkItems()
    .map(({ id, d, v }) => {
      const k = bulk.pick.indexOf(id),
        t = trEntry(d, bulk.tr);
      const val =
        v != null ? fmt(v, 1) : t ? skillLabel(t, d) : `TR${bulk.tr}なし(TR${fitTr(d, bulk.tr)}で反映)`;
      return `<button type="button" class="bulkrow${k >= 0 ? ' on' : ''}" data-bulk-pick="${esc(id)}" aria-pressed="${k >= 0}">
        <span class="bmark">${k >= 0 ? BULK_MARK[k] : ''}</span><span class="bname">${esc(d.name)}${isX(d) ? '<span class="note">Xスキル</span>' : ''}</span><span class="num bval">${val}</span></button>`;
    })
    .join('');
  const chosen = BULK_SLOTS.map(
    ([, l], i) =>
      `<span class="bchosen${bulk.pick[i] ? ' on' : ''}">${l}:${esc(M.skills.get(bulk.pick[i])?.name || '(そのまま)')}</span>`,
  ).join('');
  /* 反映先:枠の名前と、いまその枠にいる武将の名前 */
  const targets = [
    ...SLOT_NAMES.map((n, i) => {
      const c = M.cards.get(form?.slots[i]?.card);
      return [String(i), c ? `${n}(${esc(c.name)})` : n];
    }),
    ['all', '全武将'],
  ];
  p.innerHTML = `<div class="jbhead"><strong>スキルをまとめて追加</strong></div>
    <p class="note">タップした順に 通常1 → 通常2 → 極限 に入ります。もう一度タップすると外れます。並びは選んだTRでのスキル上昇率の高い順です(数字で比べられないスキルは下)。</p>
    <div class="bulkopts">
      <div class="field"><span class="label">絞り込み</span><div class="seg">${seg(
        [
          ['', 'すべて'],
          ['yes', '人数系'],
          ['no', '人数系以外'],
        ],
        bulk.people,
        'data-bulk-people',
      )}</div></div>
      <div class="field"><label class="label" for="bulkTr">TR</label><select id="bulkTr">${[
        ...Array(maxTr + 1).keys(),
      ]
        .map(t => `<option value="${t}"${t === bulk.tr ? ' selected' : ''}>TR${t}</option>`)
        .join('')}</select></div>
      <div class="field"><label class="label" for="bulkQ">名前</label><input id="bulkQ" type="text" autocomplete="off" placeholder="スキル名で絞り込み" value="${esc(bulk.q)}"></div>
    </div>
    <div class="jblist bulklist">${rows || '<p class="note">該当するスキルがありません。</p>'}</div>
    <div class="bulkchosen">${chosen}</div>
    <div class="field"><span class="label">反映先</span><div class="seg">${seg(targets, bulk.target, 'data-bulk-target')}</div></div>
    <div class="bulkfoot">${button('反映する', `id="bulkApply"${bulk.pick.some(Boolean) ? '' : ' disabled'}`)}${button('閉じる', 'id="bulkClose"', 'btn ghost')}<span class="note" id="bulkMsg" aria-live="polite">${esc(bulk.msg)}</span></div>`;
}
/* 反映:対象の武将の 通常1・通常2・極限 に選んだスキルを入れる。入れられないとき(傑、初期スキルと同じ、
   Xスキルを極限に、同じ武将のほかの枠で使用中)はその枠を飛ばして知らせる */
function bulkApply() {
  if (!form) return;
  const idx = bulk.target === 'all' ? [0, 1, 2, 3] : [N(bulk.target)];
  const skipped = [];
  let n = 0;
  for (const i of idx) {
    const s = form.slots[i],
      who = SLOT_NAMES[i];
    if (!s.card) continue;
    if (isJCard(s.card)) {
      skipped.push(`${who}(傑は付与不可)`);
      continue;
    }
    const init = initNameOf(s.card);
    BULK_SLOTS.forEach(([k, l], j) => {
      const id = bulk.pick[j];
      if (!id) return;
      const d = M.skills.get(id);
      const other = BULK_SLOTS.filter(([x], m) => x !== k && !bulk.pick[m]).map(([x]) => s[x].id);
      const why =
        init && String(d.name).trim() === init
          ? '初期スキルと同じ'
          : k === 'lim' && isX(d)
            ? 'Xスキルは極限に付けられない'
            : other.includes(id)
              ? 'ほかの枠で使用中'
              : '';
      if (why) return skipped.push(`${who}の${l}(${why})`);
      s[k] = { id, tr: fitTr(d, bulk.tr) };
      n++;
    });
  }
  renderCalc();
  bulk.msg = `${n}か所に反映しました${skipped.length ? '。入れられなかった枠:' + skipped.join('、') : ''}`;
  renderBulk();
}
$('bulkBtn').addEventListener('click', () => {
  bulk.open = !bulk.open;
  bulk.msg = '';
  renderBulk();
});
$('bulkpanel').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.bulkPick != null) {
    const id = b.dataset.bulkPick,
      k = bulk.pick.indexOf(id);
    if (k >= 0) bulk.pick[k] = null;
    else {
      const free = bulk.pick.indexOf(null);
      if (free < 0) {
        bulk.msg = '3つまで選べます。外したいスキルをもう一度タップしてください';
        return renderBulk();
      }
      bulk.pick[free] = id;
    }
    bulk.msg = '';
  } else if (b.dataset.bulkPeople != null) bulk.people = b.dataset.bulkPeople;
  else if (b.dataset.bulkTarget != null) bulk.target = b.dataset.bulkTarget;
  else if (b.id === 'bulkApply') return bulkApply();
  else if (b.id === 'bulkClose') bulk.open = false;
  else return;
  renderBulk();
});
$('bulkpanel').addEventListener('change', e => {
  if (e.target.id === 'bulkTr') {
    bulk.tr = N(e.target.value);
    renderBulk();
  }
});
$('bulkpanel').addEventListener('input', e => {
  if (e.target.id !== 'bulkQ') return;
  bulk.q = e.target.value;
  const pos = e.target.selectionStart;
  renderBulk();
  const q = $('bulkQ');
  q.focus();
  q.setSelectionRange(pos, pos);
});
