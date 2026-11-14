// 管理者の書き込み(最終更新者・変更履歴)、初期データ投入、ログイン表示
// 使うファイル:core.js、master.js、excel.js(調べ方:node tests/deps.js)
/* 変更履歴:保存・削除のたびに logs/{id} へ追記する(ルールで追記のみ・書き換え不可)。マスタの書き込みと同じバッチで書くので、
   履歴が書けないときはマスタも書き換わらない */
const COLL_JA = { cards: '武将', skills: 'スキル', soldiers: '兵種', jbuffs: '傑バフ', config: '設定' };
const plain = v =>
  v == null
    ? null
    : JSON.parse(
        JSON.stringify(v, (k, x) =>
          ['updatedAt', 'updatedBy', 'updatedName', 'logId'].includes(k) ? undefined : x,
        ),
      );
/* ルールで、マスタの書き込みには同じバッチの履歴が必須:
   ・保存:マスタの logId と同じIDの履歴  ・削除:del_{区分}_{ID}_{消すデータの logId(なければ noid)} の履歴 */
const newLogId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
function addLog(batch, action, coll, docId, before, after, logId) {
  const ts = window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date();
  batch.set(db.doc(`logs/${logId}`), {
    at: ts,
    by: me?.uid || '',
    name: myName(),
    action,
    coll: COLL_JA[coll] || coll,
    docId,
    label: String((after || before)?.name ?? (coll === 'config' ? '人数' : docId)),
    before: plain(before),
    after: plain(after),
  });
}
/* マスタ1件を書く(after=null なら削除)。履歴と同じバッチに入れる */
function putWithLog(batch, action, coll, docId, after, before) {
  const path = `${BASE}/${coll}/${docId}`;
  if (before === undefined) before = coll === 'config' ? config : M[coll]?.get(docId) || null;
  if (after) {
    const id = newLogId();
    batch.set(db.doc(path), { ...after, ...nowStamp(), logId: id });
    addLog(batch, action, coll, docId, before, after, id);
  } else {
    batch.delete(db.doc(path));
    addLog(batch, action, coll, docId, before, null, `del_${coll}_${docId}_${before?.logId || 'noid'}`);
  }
}
async function writeWithLog(action, coll, docId, after) {
  const batch = db.batch();
  putWithLog(batch, action, coll, docId, after);
  await batch.commit();
}
const logErr = err =>
  err?.code === 'permission-denied'
    ? '権限がありません。Firebase のルールに変更履歴(logs)の設定が入っているか確認してください'
    : err?.code || err?.message;
/* 表示名が未登録なら保存させない */
function needName() {
  if (myName()) return false;
  msgAny(
    `表示名が登録されていないため保存できません。Firebase コンソールの admins コレクションで、ドキュメント「${me?.uid || ''}」に、フィールド name(文字列)で表示名を追加してから、サイトを読み込み直してください。`,
  );
  return true;
}
const msgAny = t => {
  const el = $('edmsg') || $('impmsg') || $('peopleMsg');
  if (el) {
    el.className = 'msg err';
    el.textContent = t;
  } else status(t, true);
};

/* ---------- 初期データ投入(マスタが空のときだけ、管理者に表示) ---------- */
function renderSeed() {
  const box = $('seedbox');
  const empty = allLoaded() && !M.cards.size && !M.skills.size && !M.soldiers.size;
  if (!isOwner || !empty || !db) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="seed"><strong>マスタがまだ空です</strong><p class="note">Claude版で登録していた武将・スキル・兵種・人数を、まとめて登録します(seed/master.json)。</p>
    <button id="seedRun" class="btn" type="button">初期データを投入</button><p class="msg" id="seedMsg"></p></div>`;
}
$('seedbox').addEventListener('click', async e => {
  if (e.target.id !== 'seedRun') return;
  const b = e.target,
    m = $('seedMsg');
  b.disabled = true;
  m.className = 'msg';
  m.textContent = '投入しています…';
  try {
    const r = await fetch('seed/master.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('seed/master.json を読み込めません');
    const d = await r.json();
    const batch = db.batch();
    let n = 0;
    if (needName()) {
      b.disabled = false;
      return;
    }
    for (const coll of ['cards', 'skills', 'soldiers'])
      for (const [id, v] of Object.entries(d[coll] || {})) {
        putWithLog(batch, '初期データ投入', coll, id, v, null);
        n++;
      }
    if (d.config && d.config.main) {
      putWithLog(batch, '初期データ投入', 'config', 'main', d.config.main, null);
      n++;
    }
    await batch.commit();
    status(`初期データ ${n} 件を登録しました。`);
    setTimeout(() => status(''), 5000);
  } catch (err) {
    b.disabled = false;
    m.className = 'msg err';
    m.textContent = '投入できませんでした(' + logErr(err) + ')';
  }
});

/* ---------- Firebase:管理者ログインとデータの読み込み ---------- */
function setRole(user) {
  $('role').textContent = isOwner ? '管理者' : '閲覧のみ';
  $('role').className = 'role' + (isOwner ? ' admin' : '');
  me = user || null;
  $('login').hidden = !!user;
  $('logout').hidden = !user;
  /* 名前には「さん」を付ける(名前がなくメールアドレスを出すときは付けない) */
  const nm = user ? (isOwner && myName()) || user.displayName || '' : '';
  $('userName').textContent = nm ? nm + ' さん' : user?.email || '';
  const n = $('uidnote');
  if (user && !isOwner) {
    n.hidden = false;
    n.innerHTML = `ログインしていますが、管理者として登録されていません。管理者にするには、Firestore の <b>admins</b> コレクションに、次のユーザーIDを「ドキュメントID」として追加してください。<br><code id="uidcode">${esc(user.uid)}</code> <button id="uidcopy" class="btn small ghost" type="button">コピー</button>`;
  } else {
    n.hidden = true;
    n.innerHTML = '';
  }
  draft = null;
  importPlan = null;
  renderEditor();
  renderImport();
  renderMaster();
  renderSeed();
}
$('uidnote').addEventListener('click', async e => {
  if (e.target.id !== 'uidcopy') return;
  const t = $('uidcode').textContent;
  try {
    await navigator.clipboard.writeText(t);
    e.target.textContent = 'コピーしました';
  } catch (err) {
    const r = document.createRange();
    r.selectNodeContents($('uidcode'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    e.target.textContent = '選択しました(Ctrl+Cでコピー)';
  }
});
