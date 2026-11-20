// 火力の計算
// 使うファイル:core.js、skills.js、cards.js、unit.js、calc-view.js(調べ方:node tests/deps.js)
/* ステ振り:攻撃振りは 攻撃 = 素攻撃力 + 攻撃上昇率×690、兵法振りは 攻撃 = 素攻撃力 */
function calc() {
  const sl = form.slots.map((s, i) => ({ ...s, ...slotEff(i) }));
  const rei = spCount(SP.rei),
    hi = spCount(SP.hi),
    drop = dupDropped(),
    dv = (sel, i, k) => (drop.has(i + ':' + k) ? 0 : skillVal(sel, i));
  /* 初期スキルが重複上限で外れた武将は、初期スキルの特殊効果(バフ・倍枠・兵数加算など)もすべて出ない */
  sl.forEach((s, i) => {
    if (s.t && drop.has(i + ':init'))
      s.t = { ...s.t, statBuff: 1, totalBuff: 1, mulNormal: 1, mulLimit: 1, loOff: true };
  });
  /* 素攻バフ:どの枠の武将の素攻バフも部隊全員に。「本人のみ」の素攻バフは本人だけに。
     いくつもかかるときは掛け算。部隊長限定の武将は部隊長の枠でだけ効く */
  const sbv = s => (s.t ? N(s.t.statBuff) || 1 : 1);
  const lb = sl.reduce((a, s) => a * (s.raw?.selfStat ? 1 : sbv(s)), 1);
  const sbOf = s => lb * (s.raw?.selfStat ? sbv(s) : 1);
  let base = 0,
    skill = 0,
    /* 対象を限ったスキル(姫・剣豪・覇だけ)のスキル上昇率と、その対象の武将の素攻 */
    only = Object.fromEntries(Object.keys(ONLY_SHORT).map(k => [k, { skill: 0, base: 0 }]));
  /* スキル上昇率を姫の武将だけに掛けるスキルか */
  const ho = sel => onlyToOf(M.skills.get(sel?.id));
  const rows = sl.map((s, i) => {
    if (!s.c || !s.t) return null;
    /* 黎天列光:1つにつき部隊の全武将の兵数 +2000(部隊で2つまで) */
    /* 他の武将の初期スキルの兵数加算(無尽部隊で無尽を持たない武将でも効く。スキル上昇率だけが無効)。
       対象(すべて・姫・剣豪)に当てはまるほかの武将に足す。「自身の兵数も増やす」なら持ち主本人にも足す */
    const troopHit = to =>
      !to ||
      to.includes('all') ||
      (to.includes('hime') && !!toFlag(s.c.hime)) ||
      (to.includes('kengou') && !!toFlag(s.c.kengou));
    const tadd = sl.reduce(
      (a, o, j) =>
        (j === i ? o.raw?.troopSelf : troopHit(o.raw?.troopTo)) && o.c && o.raw && !o.t?.loOff
          ? a + N(o.raw.troopAdd)
          : a,
      0,
    );
    const rt = rarityTroops(s.c),
      cu = s.costUp ? COSTUP.troops : 0,
      tbs = troopBuffsFor(form, s.c),
      yk = tbs.reduce((a, b) => a + b.troops, 0),
      troops0 = N(s.c.troops) + rt + rei * REI_TROOPS + tadd + cu + yk,
      /* 本丸防御陣形:兵数を陣形内の最大兵数に揃える(防御部隊だけ。少ないときだけ上げる) */
      tmaxTo = mode === 'def' && slotTroopMax(i, drop) ? formationMax() : 0,
      troops = Math.max(troops0, tmaxTo),
      atk = MD().statOf(s.c, s.alloc === 'hei');
    const sname = M.soldiers.get(s.soldier)?.name,
      jb = jbBonus(sname),
      sadd = soldierAdd(i, drop),
      satk = N(M.soldiers.get(s.soldier)?.[MD().soldierF]) + jb + sadd;
    const sb = sbOf(s),
      b = satk * troops * 1.4 + atk * 1.4 * sb;
    const initDrop = drop.has(i + ':init'),
      init = initDrop ? 0 : initEff(s.c, s.t, i);
    const ml = slotMul(i, s.t, s.raw);
    const parts = [
      [init, onlyToOf(skillByName(s.c.initName)?.d)],
      [dv(s.s1, i, 's1') * muzinMul(s.s1, 's1') * ml.n, ho(s.s1)],
      [dv(s.s2, i, 's2') * muzinMul(s.s2, 's2') * ml.n, ho(s.s2)],
      [dv(s.lim, i, 'lim') * muzinMul(s.lim, 'lim') * ml.l * limX(s.lim), ho(s.lim)],
    ];
    const sk = parts.reduce((a, [v]) => a + v, 0),
      skO = {};
    for (const [v, to] of parts) if (to !== 'all' && v) skO[to] = (skO[to] || 0) + v;
    const skH = Object.values(skO).reduce((a, v) => a + v, 0);
    base += b;
    skill += sk - skH;
    for (const [to, v] of Object.entries(skO)) only[to].skill += v;
    for (const to of Object.keys(only)) if (cardIsOnly(s.c, to)) only[to].base += b;
    return {
      sb,
      initDrop,
      lo: !!s.t?.loOff && !initDrop,
      tadd,
      cu,
      yk,
      tbs,
      tmaxTo,
      troops,
      rt,
      rtKengou: !!toFlag(s.c.kengou) && s.c.rarity !== '傑',
      atk,
      satk,
      jb,
      sadd,
      b,
      sk,
      skH,
      skO,
      init,
      initRaw: initBase(s.c, s.t, i),
      ml,
    };
  });
  /* 無尽を持つ武将の数(武将の無尽、初期スキル・追加スキル・極限スキルのどれかが無尽なら1人。本人も含む) */
  const mz = x => skillMuzin(M.skills.get(x?.id), x?.tr) > 0;
  const mc = Math.min(
    4,
    sl.filter(s => s.c && (cardMuzin(s.c, s.tr) > 0 || mz(s.s1) || mz(s.s2) || mz(s.lim))).length,
  );
  /* 無尽部隊では、無尽を持つ武将(傑以外)の上乗せ分は2倍 */
  const tbMul = s => (muzinOn() && s.c?.rarity !== '傑' && cardMuzin(s.c, s.tr) > 0 ? muzinX() : 1);
  /* 部隊内の姫・剣豪・対象兵科・兵種の数(数え方は unit.js の unitCount) */
  const countN = i => {
    const r = sl[i].raw;
    return unitCount(i, {
      by: r.tbBy,
      self: r.tbSelf,
      branches: r.tbBranches,
      soldiers: r.tbSoldiers,
      own: r.tbOwn,
    });
  };
  /* 総バフの「係数 × 数」の数(無尽を持つ武将数 か 部隊内の姫の数)。固定なら null */
  const tbN = i => {
    const s = sl[i];
    if (s.t !== s.raw || s.raw?.tbCoef == null) return null;
    return s.raw.tbBy === 'muzin' ? mc : countN(i);
  };
  /* 無尽の2倍は「無尽を持つ武将数」の掛け方だけ */
  const tbX = i => (sl[i].raw?.tbBy === 'muzin' ? tbMul(sl[i]) : 1);
  const tbOf = (s, i) => {
    if (!s.t) return 1;
    const v = N(s.t.totalBuff) || 1,
      n = tbN(i);
    return n != null ? v + ((n * N(s.raw.tbCoef)) / 100) * tbX(i) : v;
  };
  /* 総攻バフは全枠の武将から集めて足し算(1+各(バフ-1)の和)。火焔武闘は最後に+0.2ずつ */
  const buffs = sl.map(tbOf).filter((v, i) => sl[i].t);
  const combined = 1 + buffs.reduce((a, b) => a + (b - 1), 0);
  const buff = combined + hi * 0.2,
    jin = N(form.jin);
  rows.forEach((r, i) => {
    if (r) {
      r.tb = tbOf(sl[i], i);
      r.tbMc = tbN(i);
      r.tbKind = { hime: '姫', kengou: '剣豪', branch: '対象' }[sl[i].raw?.tbBy] || '無尽';
      r.tbMul = tbX(i);
      r.void = muzinVoid(sl[i].c, sl[i].tr);
    }
  });
  /* 防御部隊:敵火力加算の初期スキルを持つ武将1人につき、敵の推定火力 ÷ 敵の武将数 を足す
     (部隊長限定で小隊長にいるとき、無尽部隊で初期スキルが無効のときは足さない) */
  const enemyN =
    mode === 'def'
      ? sl.filter(s => s.c && s.raw?.enemyAdd && !s.t?.loOff && !muzinVoid(s.c, s.tr)).length
      : 0;
  const enemyAdd = enemyN && N(form.enemyCount) > 0 ? (enemyN * N(form.enemyFire)) / N(form.enemyCount) : 0;
  return {
    rows,
    base,
    skill,
    only,
    buff,
    lb,
    rei,
    hi,
    enemyN,
    enemyAdd,
    muzin: muzinOn(),
    /* 姫だけのスキル上昇率は、姫の武将の素攻にだけ掛ける */
    total:
      ((base * skill + Object.values(only).reduce((a, o) => a + o.base * o.skill, 0)) / 100 + base) *
        jin *
        buff +
      enemyAdd,
  };
}
/* スキル欄の下に出す効果。スキル上昇率 × 倍枠(極限は×1.2)= この枠で加算される値 */
const SPECIAL_EFFECT = {
  黎天列光: () => '全武将の兵数 +2,000(重複上限まで)',
  黎天烈光: () => '全武将の兵数 +2,000(重複上限まで)',
  火焔武闘: () => `総${MD().st}バフ +0.2(重複上限まで)`,
};
function skillEffect(i, k) {
  const sel = form.slots[i][k],
    sk = M.skills.get(sel.id);
  if (!sk) return '';
  const t = trEntry(sk, sel.tr);
  if (!t) return 'このTRの値が登録されていません';
  if (!forMode(sk)) return `${MD().opp}スキルのため、${MD().label}では効果なし`;
  if (dupDropped().has(i + ':' + k)) return `効果 <b>0</b> <span class="mz cn">重複上限のため効果なし</span>`;
  const mm = isMimic(sk),
    cn = mm ? null : coefN(sk, sel.id, i),
    cc = M.cards.get(form.slots[i].card),
    v = skillVal(sel, i),
    { t: ct, raw: cr } = slotEff(i);
  const mtag = mm
    ? mimicSrc(sk, i) == null
      ? ' <span class="mz cn">部隊長には無効</span>'
      : mimicBlocked(mimicSrc(sk, i))
        ? ' <span class="mz cn">模倣できない初期スキル</span>'
        : ` <span class="mz cn">${N(t.base) ? '素' + fmt(N(t.base), 1) + ' + ' : ''}${mimicOf(sk) === 'self' ? '自分' : '部隊長'}の初期${fmt(slotInit(mimicSrc(sk, i)), 1)}×${fmt(N(t.mimicRate), 2)}</span>`
    : '';
  const mz = muzinMul(sel, k),
    tag =
      (mz > 1 ? ` <span class="mz">無尽×${fmt(mz, 2)}</span>` : '') +
      (cn != null
        ? ` <span class="mz cn">${COEF_SHORT[coefByOf(sk)]}${coefByOf(sk) === 'speed' ? fmt(cn, 2) : cn}${coefMax(sk) ? `・係数TR${maxTrOf(sel.id)}` : ''}</span>`
        : '') +
      mtag,
    sp = SPECIAL_EFFECT[sk.name] ? `<br><span class="sub">${esc(SPECIAL_EFFECT[sk.name]())}</span>` : '';
  if (!ct) return `効果 <b>${fmt(v * mz, 1)}</b>${tag}${sp}`;
  /* 倍枠は部隊内の数で増える分も含める(スキル小計と同じ slotMul) */
  const ml = slotMul(i, ct, cr),
    mul = k === 'lim' ? ml.l * limX(sel) : ml.n;
  return `効果 <b>${fmt(v * mz * mul, 1)}</b>${tag}${sp}`;
}
/* 武将ごとの内訳。各行は [見出し, 値, 補足(なければ空)] */
function breakdownHtml(x, r) {
  const m = MD();
  const initNote = x.lo
    ? '部隊長限定のため無効'
    : x.initDrop
      ? '重複上限のため無効'
      : r.muzin && x.initRaw && x.init !== x.initRaw
        ? x.init
          ? `無尽×${fmt(muzinX(), 2)}`
          : '無尽なしで無効'
        : '';
  const lines = [
    [
      '兵数',
      fmt(x.troops),
      [
        x.rt ? `${x.rtKengou ? '剣豪' : 'ランクアップ'}+${fmt(x.rt)}` : '',
        x.tadd ? `兵数加算+${fmt(x.tadd)}` : '',
        x.cu ? `コストアップ+${fmt(x.cu)}` : '',
        ...x.tbs.map(b => `${b.name}+${fmt(b.troops)}`),
        x.tmaxTo && x.troops === x.tmaxTo ? '陣形内の最大に揃える' : '',
      ]
        .filter(Boolean)
        .join('・'),
    ],
    [m.stat, fmt(x.atk), ''],
    [
      `兵士${m.stat}力`,
      fmt(x.satk, 2),
      [
        x.jb ? `兵科バフ${x.jb < 0 ? '' : '+'}${fmt(x.jb, 2)}` : '',
        x.sadd ? `初期スキル+${fmt(x.sadd, 2)}(コスト減${fmt(costCut().cut, 2)})` : '',
      ]
        .filter(Boolean)
        .join('・'),
    ],
    [`素${m.st}`, fmt(x.b, 1), x.sb !== 1 ? `素${m.st}バフ×${fmt(x.sb, 2)}` : ''],
    ['初期スキル', fmt(x.init, 1), initNote],
    [
      'スキル小計',
      fmt(x.sk, 1),
      [
        ...Object.entries(x.skO || {}).map(([to, v]) => `うち${ONLY_SHORT[to]}のみ${fmt(v, 1)}`),
        x.ml?.h4 != null ? `倍枠 通常×${fmt(x.ml.n, 2)}・極限×${fmt(x.ml.l, 2)}(姫${x.ml.h4}人)` : '',
      ]
        .filter(Boolean)
        .join('・') ||
        (x.ml?.lv != null
          ? `倍枠 極限×${fmt(x.ml.l, 2)}(初期スキルLV合計${x.ml.lv})`
          : x.ml?.cnt != null
            ? `倍枠 通常×${fmt(x.ml.n, 2)}・極限×${fmt(x.ml.l, 2)}(${{ hime: '姫', kengou: '剣豪', branch: '対象' }[x.ml.by]}${x.ml.cnt}人)`
            : ''),
    ],
    [
      `総${m.st}バフ`,
      '×' + fmt(x.tb, 2),
      x.tbMc != null ? `${x.tbKind}${x.tbMc}人${x.tbMul > 1 ? `・無尽×${fmt(x.tbMul, 2)}` : ''}` : '',
    ],
  ];
  return lines
    .map(
      ([h, v, note]) =>
        `<span>${h}</span><span class="num">${v}${note ? `<span class="plus">(${note})</span>` : ''}</span>`,
    )
    .join('');
}
function updateResults() {
  if (!form) return;
  const r = calc();
  $('r-total').textContent = fmt(r.total);
  $('r-total-jp').textContent = jp(r.total);
  $('r-base').textContent = fmt(r.base, 1);
  $('r-skill').textContent = fmt(r.skill, 1);
  const on = Object.entries(r.only).filter(([, o]) => o.skill);
  $('r-hime-box').hidden = !on.length;
  $('r-hime').textContent = on
    .map(([to, o]) => `${ONLY_SHORT[to]} ${fmt(o.skill, 1)}(素${MD().st} ${fmt(o.base, 1)})`)
    .join(' / ');
  $('r-buff').textContent = fmt(r.buff, 2);
  $('r-special').textContent = r.rei + ' / ' + r.hi;
  $('r-enemy').textContent = r.enemyN ? `${fmt(r.enemyAdd)}(${r.enemyN}人)` : '0';
  r.rows.forEach((x, i) => {
    const el = $('calc-' + i);
    if (!el) return;
    el.innerHTML = x ? breakdownHtml(x, r) : '<span>武将とTRを選んでください</span><span></span>';
  });
  form.slots.forEach((_, i) =>
    ['s1', 's2', 'lim'].forEach(k => {
      const el = $(`eff-${k}-${i}`);
      if (el) el.innerHTML = skillEffect(i, k);
    }),
  );
  if (M.cards.size && M.skills.size && M.soldiers.size) store.set(MD().storeKey, toKeys(form));
}
