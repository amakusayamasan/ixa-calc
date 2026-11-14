// 画面操作のテスト(マスタの編集画面・一覧の絞り込みと並べ替え・保存した部隊・一括スキル追加)。期待どおりでなければ失敗する。
// 使い方:リポジトリのフォルダで `python3 -m http.server 8765` を起動してから  node tests/ui.js
const { chromium } = require('playwright');
const path = require('path');
const dir = __dirname;
const URL = 'http://127.0.0.1:' + (process.env.PORT || 8765) + '/index.html';
let ng = 0;
const ok = (name, got, want) => {
  const g = JSON.stringify(got),
    w = JSON.stringify(want);
  if (g !== w) {
    ng++;
    console.log('NG', name, '期待', w, '結果', g);
  }
};
/* b はブラウザか、同じ保存領域を使い回すときはブラウザのコンテキスト */
async function open(b, q = '', hash = '') {
  const p = await b.newPage({ viewport: { width: 1150, height: 1000 } });
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  await p.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, r =>
    r.fulfill({ path: path.join(dir, 'stub.js'), contentType: 'text/javascript' }),
  );
  await p.route(/gstatic\.com\/firebasejs\/.*(auth|firestore)-compat\.js/, r =>
    r.fulfill({ body: '', contentType: 'text/javascript' }),
  );
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto(URL + q + hash);
  await p.waitForTimeout(500);
  if (q.includes('admin')) {
    await p.click('#login').catch(() => {});
    await p.waitForTimeout(300);
  }
  /* 共通のテスト用マスタ */
  await p.evaluate(() => {
    const sb = document.getElementById('seedbox');
    if (sb) sb.innerHTML = '';
    config.people = 280;
    config.avgCost = 5;
    const tr = f => [0, 1, 2, 3, 4, 5].map(t => ({ tr: t, ...f(t) }));
    [
      ['槍兵科', '武士'],
      ['兵器兵科', '鉄砲足軽'],
      ['兵器兵科', '焙烙火矢'],
    ].forEach(([b, n], i) => M.soldiers.set('s' + i, { name: n, branch: b, atk: 30, def: 30, order: i }));
    const S = (id, o) => M.skills.set(id, { coefBy: 'people', init: 0, side: '攻撃', ...o });
    S('a', { name: '勇猛果敢', trs: tr(t => ({ base: 0, coef: 10 + t })) });
    S('b', { name: '剛勇無双', trs: tr(() => ({ base: 500, coef: 5 })) });
    S('c', { name: '百戦錬磨', trs: tr(t => ({ base: 3000 + t * 100, coef: 0 })) });
    S('x', { name: 'Xの技', coefBy: 'x', xskill: 1, trs: [{ tr: 0, base: 0, coef: 700 }] });
    S('m', { name: '模倣の技', side: '攻撃・防御', mimic: 'self', trs: [{ tr: 0, mimicRate: 1.15 }] });
    S('d', { name: '防御技', side: '防御', trs: tr(() => ({ base: 0, coef: 20 })) });
    S('old', { name: '古い重複', effs: { dup: true }, trs: [{ tr: 0, base: 1, coef: 0, dupMax: 2 }] });
    M.skills.set('i', { name: '初A', init: 1, noAdd: 1, side: '攻撃', coefBy: 'people', trs: tr(() => ({ base: 1000, coef: 0 })) });
    ['真田', '島津', '本多'].forEach((n, i) =>
      M.cards.set('c' + i, { no: 1000 + i, rarity: '天', side: '攻撃', name: n, initName: '初A', troops: 8000, baseStat: 5000, growth: 100 }),
    );
    M.cards.set('cj', { no: 20001, rarity: '傑', side: '攻撃', name: '傑信長', initName: '初A', troops: 24000, baseStat: 5000, growth: 0 });
  });
  return p;
}
const checked = (p, sel) => p.$eval(sel, e => e.checked).catch(() => 'なし');
const legends = p => p.$$eval('.subbox legend', e => e.map(x => x.textContent));

(async () => {
  const b = await chromium.launch();

  /* ---------- 1. 初期スキルの編集画面:特殊効果のチェックで設定の枠が出る ---------- */
  {
    const p = await open(b, '?mode=admin', '#master');
    await p.click('[data-m=skills]');
    ok('古い形式の知らせ', await p.$eval('#mlegacy', e => !e.hidden && e.textContent.includes('古い重複')), true);
    await p.click('#maddInit');
    await p.waitForTimeout(100);
    ok('初期スキルは模倣できないが初期値', await p.inputValue('#f-noMimic'), '1');
    await p.fill('#f-name', 'UIテスト初期');
    for (const k of ['stat', 'mul', 'total', 'troop', 'dup']) {
      await p.check(`[data-eff=${k}]`);
      await p.waitForTimeout(80);
    }
    ok('設定の枠(チェックの並び順)', await legends(p), ['倍枠の設定', '素攻バフの設定', '総攻バフの設定', '兵数加算の設定', '重複上限の設定']);
    ok('チェックしても値は自動で入らない', await p.inputValue('[data-t="0:statBuff"]'), '');
    await p.selectOption('#f-tbBy', 'hime');
    await p.waitForTimeout(80);
    ok('総バフの自身をカウントするは最初からチェック', await checked(p, '#f-tbSelf'), true);
    await p.selectOption('#f-tbBy', 'branch');
    await p.waitForTimeout(80);
    ok('対象兵科の候補', await p.$$eval('[name=tbbranch]', e => e.map(x => x.value)), ['槍兵科', '兵器兵科']);
    await p.selectOption('#f-mulBy', 'kengou');
    await p.waitForTimeout(80);
    ok('倍枠係数の列', await p.$$eval('#editor th', e => e.map(x => x.textContent).filter(t => t.startsWith('倍枠係数'))), [
      '倍枠係数(通常)',
      '倍枠係数(極限)',
    ]);
    ok('兵数加算の対象は「すべて」が最初', await p.$$eval('[name=troopto]', e => e.filter(x => x.checked).map(x => x.value)), ['all']);
    await p.check('[name=troopto][value=hime]');
    ok('姫を選ぶと「すべて」が外れる', await p.$$eval('[name=troopto]', e => e.filter(x => x.checked).map(x => x.value)), ['hime']);
    ok('自身の兵数も増やすは最初はなし', await checked(p, '[data-eff2=troopSelf]'), false);
    /* 必須チェック:値の入れ忘れ → 対象兵科の選び忘れ → 保存 */
    const save = async () => {
      await p.click('#editor button[type=submit]');
      await p.waitForTimeout(250);
      return p.textContent('#edmsg');
    };
    ok('対象兵科の選び忘れ', await save(), '対象兵科か対象兵種を1つ以上選んでください');
    await p.check('#f-tbOwn');
    ok('重複上限の入れ忘れ', await save(), '重複上限を入力してください(1以上)');
    await p.fill('#f-dupMax', '2');
    ok('TR表の値の入れ忘れ', (await save()).startsWith('TR0の「'), true);
    for (const f of ['statBuff', 'mulNormal', 'mulLimit', 'mulNormalCoef', 'mulLimitCoef', 'totalBuff', 'tbCoef', 'troopAdd'])
      await p.fill(`[data-t="0:${f}"]`, '1');
    ok('保存できる', await save(), '保存しました');
    const d = await p.evaluate(() => {
      const d = [...M.skills.values()].find(x => x.name === 'UIテスト初期');
      return { tbBy: d.tbBy, tbOwn: d.tbOwn, mulBy: d.mulBy, troopTo: d.troopTo, dupMax: d.dupMax, noMimic: d.noMimic };
    });
    ok('保存した中身', d, { tbBy: 'branch', tbOwn: 1, mulBy: 'kengou', troopTo: ['hime'], dupMax: 2, noMimic: 1 });
    ok('ページのエラー(1)', p.errs, []);
    await p.close();
  }

  /* ---------- 2. スキルマスタの一覧:絞り込みと見出しの並べ替え ---------- */
  {
    const p = await open(b, '?mode=admin', '#master');
    await p.click('[data-m=skills]');
    await p.waitForTimeout(100);
    const names = () => p.$$eval('#mtable tbody tr td:first-child', e => e.map(x => x.innerText.split('\n')[0]));
    await p.click('[data-fk=kind][data-fv=mimic]');
    ok('種類:模倣スキル', await names(), ['模倣の技']);
    await p.click('[data-fk=kind][data-fv=""]');
    await p.click('[data-fk=people][data-fv=yes]');
    ok('人数系(係数0の百戦錬磨は入らない)', (await names()).sort(), ['剛勇無双', '勇猛果敢', '防御技'].sort());
    await p.click('[data-fk=people][data-fv=""]');
    const tr5 = await p.$eval('#mtable th:has-text("TR5")', e => e.dataset.sort);
    await p.click(`#mtable th[data-sort="${tr5}"]`);
    const desc = await names();
    ok('TR5を大きい順(先頭)', desc.slice(0, 3), ['防御技', '勇猛果敢', '百戦錬磨']);
    ok('見出しに▼', (await p.textContent(`#mtable th[data-sort="${tr5}"]`)).includes('▼'), true);
    await p.click(`#mtable th[data-sort="${tr5}"]`);
    ok('2回目は小さい順の▲', (await p.textContent(`#mtable th[data-sort="${tr5}"]`)).includes('▲'), true);
    await p.click(`#mtable th[data-sort="${tr5}"]`);
    ok('3回目で元の並び', (await p.$$eval('#mtable th.sorted', e => e.length)), 0);
    await p.click('#mtable th[data-sort="0"]');
    ok('文字の列は昇順から', (await p.textContent('#mtable th[data-sort="0"]')).includes('▲'), true);
    ok('ページのエラー(2)', p.errs, []);
    await p.close();
  }

  /* ---------- 3. 部隊計算:保存した部隊と一括スキル追加(開き直しを確かめるため、同じ保存領域を使う) ---------- */
  {
    const ctx = await b.newContext();
    const p = await open(ctx);
    await p.evaluate(() => {
      form = fromKeys({
        jin: 1,
        jb: [],
        slots: ['1000', '1001', '1002', '20001'].map(c => ({ card: c, tr: 0, soldier: '武士', alloc: 'atk', s1: ['', 0], s2: ['', 0], lim: ['', 0] })),
      });
      renderCalc();
    });
    /* 保存した部隊 */
    await p.fill('#teamName', 'UI部隊');
    await p.click('#teamSave');
    ok('部隊の保存', await p.textContent('#teamMsg'), '「UI部隊」を保存しました');
    await p.click('#teamBtn');
    ok('保存一覧', await p.$$eval('.teamrow .tname b', e => e.map(x => x.textContent)), ['UI部隊']);
    await p.click('#teamBtn');
    /* 一括スキル追加 */
    await p.click('#bulkBtn');
    await p.waitForTimeout(100);
    ok('一括スキル追加の見出し', await p.textContent('#bulkpanel .jbhead strong'), '一括スキル追加');
    ok('候補(防御技・付与不可の初期スキルは出ない)', await p.$$eval('.bulkrow .bname', e => e.map(x => x.childNodes[0].textContent)), [
      '百戦錬磨',
      '勇猛果敢',
      '剛勇無双',
      '古い重複',
      'Xの技',
      '模倣の技',
    ]);
    await p.selectOption('#bulkTr', '5');
    await p.click('[data-bulk-people="x"]');
    ok('Xスキルで絞る', await p.$$eval('.bulkrow .bname', e => e.map(x => x.childNodes[0].textContent)), ['Xの技']);
    await p.click('[data-bulk-people=""]');
    await p.click('[data-bulk-pick="a"]');
    await p.click('[data-bulk-pick="b"]');
    await p.click('[data-bulk-pick="x"]');
    await p.click('[data-bulk-pick="a"]');
    await p.click('[data-bulk-pick="c"]');
    ok('選んだ順(外した通常1に次が入る)', await p.textContent('.bulkchosen'), '通常1:百戦錬磨通常2:剛勇無双極限:Xの技');
    await p.click('#bulkApply');
    await p.waitForTimeout(150);
    ok(
      '反映の知らせ(Xスキルは極限に入らない・傑は飛ばす)',
      await p.textContent('#bulkMsg'),
      '6か所に反映しました。入れられなかった枠:部隊長の極限(Xスキルは極限に付けられない)、小隊長1の極限(Xスキルは極限に付けられない)、小隊長2の極限(Xスキルは極限に付けられない)、小隊長3(傑は付与不可)',
    );
    ok(
      '反映されたスキルとTR',
      await p.evaluate(() => form.slots.map(s => ['s1', 's2'].map(k => (M.skills.get(s[k].id)?.name || '-') + '@' + s[k].tr).join(' '))),
      ['百戦錬磨@5 剛勇無双@5', '百戦錬磨@5 剛勇無双@5', '百戦錬磨@5 剛勇無双@5', '-@0 -@0'],
    );
    ok('ページのエラー(3)', p.errs, []);
    await p.close();
    /* 開き直しても一括スキル追加のTRと保存した部隊は残る */
    const q = await open(ctx);
    await q.click('#bulkBtn');
    ok('一括スキル追加のTRを覚えている', await q.inputValue('#bulkTr'), '5');
    ok('保存した部隊が残っている', await q.evaluate(() => loadTeams().map(t => t.name)), ['UI部隊']);
    await q.close();
    await ctx.close();
  }

  await b.close();
  console.log(ng ? `失敗 ${ng}件` : 'すべてOK');
  process.exit(ng ? 1 : 0);
})();
