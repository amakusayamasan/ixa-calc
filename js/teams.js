// 保存した部隊(部隊に名前を付けて、この端末に保存・読み込み・削除)
// 使うファイル:core.js、calc.js、calc-view.js(調べ方:node tests/deps.js)
/* 攻撃部隊・防御部隊で別々に持つ。中身は編成の記憶と同じ形(カードNo・スキル名・兵種名)。
   最大火力は保存した時点の値(マスタを直しても変わらない) */
const teamKey = () => 'ixa-teams-' + mode + '-v1';
const loadTeams = () => {
  const v = store.get(teamKey());
  return Array.isArray(v) ? v.filter(t => t && typeof t.name === 'string' && t.form) : [];
};
let teamDel = null; // 削除の確認中の部隊名(もう一度押すと削除)
function teamMsg(text, err) {
  const el = $('teamMsg');
  el.textContent = text || '';
  el.classList.toggle('err', !!err);
}
const teamTime = ms => {
  const d = new Date(ms),
    p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/* 保存した部隊の武将名(カードNoからいまの武将マスタで引く。見つからなければNo) */
const teamCards = t =>
  (t.form.slots || [])
    .map(
      s =>
        s.card &&
        (M.cards.get(findId(M.cards, d => String(d.no) === String(s.card)))?.name || 'No.' + s.card),
    )
    .filter(Boolean)
    .join('・') || '武将なし';
function renderTeams() {
  const list = loadTeams(),
    p = $('teampanel');
  $('teamBtn').textContent = `保存した${MD().st === '攻' ? '攻撃' : '防御'}部隊(${list.length})`;
  $('teamBtn').setAttribute('aria-expanded', !p.hidden);
  if (p.hidden) return;
  p.innerHTML = list.length
    ? `<div class="jblist">${list
        .map(
          (t, i) => `<div class="teamrow">
      <div class="tname"><b>${esc(t.name)}</b><span class="meta">${esc(teamCards(t))}</span><span class="meta">${teamTime(t.at)} 保存</span></div>
      <div class="ttotal"><span class="label">最大火力</span><b class="num">${fmt(t.total)}</b><span class="meta num">${jp(t.total)}</span></div>
      <div class="tbtns"><button class="btn small" type="button" data-tload="${i}">読み込む</button><button class="btn small danger${teamDel === t.name ? ' armed' : ''}" type="button" data-tdel="${i}">${teamDel === t.name ? '本当に削除' : '削除'}</button></div>
    </div>`,
        )
        .join('')}</div>`
    : '<p class="note">まだ保存した部隊はありません。部隊名を入れて「この編成を保存」を押すと、ここに並びます。</p>';
}
$('teamSave').addEventListener('click', () => {
  if (!form || !allLoaded()) return teamMsg('マスタを読み込んでから保存してください', true);
  const name = $('teamName').value.trim();
  if (!name) return teamMsg('部隊名を入力してください', true);
  const list = loadTeams(),
    over = list.some(t => t.name === name);
  const item = { name, at: Date.now(), total: calc().total, form: toKeys(form) };
  store.set(teamKey(), [item, ...list.filter(t => t.name !== name)]);
  if (!loadTeams().some(t => t.name === name && t.at === item.at))
    return teamMsg(
      '保存できませんでした(ブラウザの設定で、サイトのデータの保存が止められている可能性があります)',
      true,
    );
  teamDel = null;
  teamMsg(`「${name}」を${over ? '上書き' : '保存'}しました`);
  renderTeams();
});
$('teamName').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('teamSave').click();
});
$('teamBtn').addEventListener('click', () => {
  const p = $('teampanel');
  p.hidden = !p.hidden;
  teamDel = null;
  renderTeams();
});
$('teampanel').addEventListener('click', e => {
  const b = e.target.closest('[data-tload],[data-tdel]');
  if (!b) return;
  const list = loadTeams();
  if (b.dataset.tload != null) {
    const t = list[N(b.dataset.tload)];
    if (!t || !allLoaded()) return;
    form = fromKeys(t.form);
    $('teamName').value = t.name;
    $('teampanel').hidden = true;
    teamDel = null;
    renderCalc();
    renderTeams();
    teamMsg(`「${t.name}」を読み込みました`);
    return;
  }
  const t = list[N(b.dataset.tdel)];
  if (!t) return;
  if (teamDel !== t.name) {
    teamDel = t.name;
    renderTeams();
    return;
  }
  store.set(
    teamKey(),
    list.filter(x => x.name !== t.name),
  );
  teamDel = null;
  teamMsg(`「${t.name}」を削除しました`);
  renderTeams();
});
