// 画面の切り替えと起動(Firebase への接続・マスタの読み込み)
// 使うファイル:core.js、calc.js、calc-view.js、master.js、excel.js、admin.js(調べ方:node tests/deps.js)
/* ---------- 画面切替・起動 ---------- */
$('mtabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  mtab = b.dataset.m;
  draft = null;
  cfgMsg = null;
  importPlan = null;
  [...$('mtabs').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  renderEditor();
  renderImport();
  renderMaster();
});
$('msearch').addEventListener('input', renderMaster);
$('madd').addEventListener('click', () => {
  importPlan = null;
  renderImport();
  openEditor(mtab, null);
});
$('maddSkill').addEventListener('click', () => {
  importPlan = null;
  renderImport();
  openEditor('skills', null, 'skill');
});
$('maddInit').addEventListener('click', () => {
  importPlan = null;
  renderImport();
  openEditor('skills', null, 'init');
});
$('mtable').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr || !isOwner) return;
  importPlan = null;
  renderImport();
  openEditor(mtab, tr.dataset.id);
});
$('people').addEventListener('click', async e => {
  /* 人数・平均コストの保存(全員共通の設定) */
  const k = e.target.dataset.cfg;
  if (!k) return;
  const label = k === 'people' ? '人数' : '平均コスト',
    v = Number($(k === 'people' ? 'peopleIn' : 'avgCostIn').value),
    say = (cls, text) => {
      cfgMsg = { cls, text };
      const m = $('peopleMsg');
      m.className = 'msg ' + cls;
      m.textContent = text;
    };
  if (!Number.isFinite(v) || v <= 0) {
    say('err', label + 'は正の数で入力してください');
    return;
  }
  if (needName()) return;
  try {
    await writeWithLog('更新', 'config', 'main', { ...plain(config), [k]: v });
    say('ok', label + 'を保存しました');
  } catch (err) {
    say('err', '保存できませんでした(' + logErr(err) + ')');
  }
});
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) show(b.dataset.view);
});
function show(v) {
  for (const b of document.querySelectorAll('.tabs button'))
    b.setAttribute('aria-selected', b.dataset.view === v);
  $('view-calc').hidden = v !== 'calc';
  $('view-master').hidden = v !== 'master';
  try {
    history.replaceState(null, '', location.pathname + location.search + '#' + v);
  } catch (e) {}
  if (v === 'master') renderMaster();
}
window.addEventListener('hashchange', () => show(location.hash === '#master' ? 'master' : 'calc'));
show(location.hash === '#master' ? 'master' : 'calc');
renderCalc();

(() => {
  const cfg = window.FIREBASE_CONFIG;
  if (!window.firebase || !cfg || !cfg.apiKey || /^YOUR/.test(cfg.apiKey)) {
    status(
      'Firebase の設定がまだです。firebase-config.js に設定を書き込んでください(README の手順2)。',
      true,
    );
    for (const k in loaded) loaded[k] = true;
    renderCalc();
    renderMaster();
    return;
  }
  firebase.initializeApp(cfg);
  db = firebase.firestore();
  const auth = firebase.auth();
  $('login').hidden = false;
  $('login').addEventListener('click', async () => {
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request')
        status('ログインできませんでした(' + (e.code || e.message) + ')。', true);
    }
  });
  $('logout').addEventListener('click', () => auth.signOut());
  auth.onAuthStateChanged(async user => {
    isOwner = false;
    adminName = '';
    if (user) {
      try {
        const a = await db.doc('admins/' + user.uid).get();
        isOwner = a.exists;
        adminName = isOwner ? String(a.data()?.name ?? '').trim() : '';
      } catch (e) {
        isOwner = false;
      }
    }
    setRole(user);
  });
  const timer = setTimeout(
    () => status('マスタの読み込みに時間がかかっています。通信状態を確認してください。', true),
    10000,
  );
  const fail = err => {
    clearTimeout(timer);
    for (const k in loaded) loaded[k] = true;
    status(
      'マスタを読み込めませんでした(' +
        (err.code || err.message) +
        ')。Firestore のルール設定を確認してください。',
      true,
    );
    renderCalc();
    renderMaster();
  };
  const settle = () => {
    if (Object.values(loaded).every(Boolean)) {
      clearTimeout(timer);
      if ($('status').classList.contains('warn')) status('');
    }
  };
  for (const coll of ['cards', 'skills', 'soldiers']) {
    db.collection(`${BASE}/${coll}`).onSnapshot(snap => {
      const wasLoaded = allLoaded(),
        wasEmpty = !M[coll].size;
      M[coll] = new Map(snap.docs.map(d => [d.id, d.data()]));
      if (!snap.metadata.fromCache || snap.docs.length) loaded[coll] = true;
      settle();
      /* 最初の読み込み完了時と、空だったマスタにデータが入ったとき(初期データ投入など)は編成を作り直す */
      if ((!wasLoaded && allLoaded()) || (wasLoaded && wasEmpty && M[coll].size))
        form = forms.atk = forms.def = null;
      renderCalc();
      if (!$('view-master').hidden) renderMaster();
      renderSeed();
    }, fail);
  }
  db.collection(`${BASE}/jbuffs`).onSnapshot(
    snap => {
      M.jbuffs = new Map(snap.docs.map(d => [d.id, d.data()]));
      loaded.jbuffs = true;
      settle();
      if (form) {
        renderJb();
        updateResults();
      }
      if (!$('view-master').hidden) renderMaster();
    },
    err => {
      loaded.jbuffs = true;
      settle();
      status(
        'バフマスタを読み込めませんでした(' +
          (err.code || err.message) +
          ')。Firestore のルールを最新の firestore.rules に更新してください。',
        true,
      );
    },
  );
  db.doc(`${BASE}/config/main`).onSnapshot(snap => {
    if (snap.exists) config = { ...CONFIG_DEFAULT, ...snap.data() };
    loaded.config = true;
    settle();
    updateResults();
    if (!$('view-master').hidden) renderMaster();
  }, fail);
})();
