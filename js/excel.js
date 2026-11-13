// Excelの取り込み・ダウンロード
/* ---------- Excel取り込み ---------- */
let xlsxPromise = null;
function loadXLSX() {
  return (
    xlsxPromise ||
    (xlsxPromise = new Promise((ok, ng) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => ok(window.XLSX);
      s.onerror = () => {
        xlsxPromise = null;
        ng(new Error('読み込み失敗'));
      };
      document.head.appendChild(s);
    }))
  );
}
function renderImport() {
  const box = $('importbox');
  if (!importPlan) {
    box.innerHTML = '';
    return;
  }
  if (importPlan === 'pick') {
    box.innerHTML = `<div class="import"><strong>Excelから取り込み</strong>
    <p class="note">「武将データ」「スキルデータ」「兵種データ」「傑バフデータ」シートを読み込みます(列はフォーマットのとおり)(あるシートだけで構いません)。武将と傑バフはカードNo、スキルはスキル名、兵種は兵種名が同じものを上書きし、それ以外はそのまま残します。素攻とスキル上昇率は取り込まず、この画面で計算し直します。</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" type="button" data-imp="fmt">フォーマットをダウンロード(空)</button><button class="btn small ghost" type="button" data-imp="dump">今のマスタをダウンロード</button></div>
    <p class="note">「今のマスタ」は、登録済みのデータが入った取り込み用のExcelです。直してそのまま取り込めます。</p>
    <input id="xfile" type="file" accept=".xlsx,.xlsm,.xls"><div style="display:flex;gap:8px"><button class="btn ghost" type="button" data-imp="cancel">やめる</button></div><p class="msg" id="impmsg"></p></div>`;
    return;
  }
  const p = importPlan;
  box.innerHTML = `<div class="import"><strong>取り込み内容の確認</strong><ul>
    <li>武将:${p.cards.length}枚 うち新規 ${p.cards.filter(c => !c.id).length}枚</li>
    <li>スキル:${p.skills.length}件 うち新規 ${p.skills.filter(c => !c.id).length}件</li>
    <li>兵種:${p.soldiers.length}件 うち新規 ${p.soldiers.filter(c => !c.id).length}件</li>
    <li>傑バフ:${p.jbuffs.length}件 うち新規 ${p.jbuffs.filter(c => !c.id).length}件</li>
    ${p.people != null ? `<li>人数:${p.people}</li>` : ''}${p.warn.map(w => `<li style="color:var(--danger)">${esc(w)}</li>`).join('')}</ul>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-imp="run">取り込む</button><button class="btn ghost" type="button" data-imp="cancel">やめる</button></div><p class="msg" id="impmsg"></p></div>`;
}
/* 取り込み用のExcelを作る(列名は取り込みと同じ)。withData=false なら見出しだけ */
const X_CARD = [
  'カードNo',
  'カード名',
  'レアリティ',
  '武将コスト',
  '攻撃or防御',
  '初期スキル名',
  '兵数',
  '素攻撃力',
  '素防御力',
  '攻撃上昇率',
  '防御上昇率',
  '姫',
  '剣豪',
];
const X_SKILL = [
  'スキル名',
  '種類',
  '攻撃or防御',
  'スキル付与',
  '係数の掛け方',
  '係数最大TR参照',
  '無尽',
  'Xスキル',
  '総攻・防バフの掛け方',
  '模倣',
  '模倣可否',
  'TR',
  '素スキル上昇率',
  '係数',
  '模倣倍率',
  '重複上限',
  '素攻・防バフ',
  '素攻バフ本人のみ',
  '部隊長限定',
  '倍枠通常',
  '倍枠極限',
  '総攻・防バフ',
  '総攻・防バフ係数',
  '兵数加算',
];
const X_SOLDIER = ['兵科', '兵種', '攻撃力', '防禦力', '破壊', '速度'];
const X_JBUFF = [
  'カードNo',
  '武将名',
  '対象兵種',
  '所属時攻撃力',
  '所属時防御力',
  '外部攻撃力',
  '外部防御力',
];
async function downloadXlsx(withData) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const cards = withData
    ? [...M.cards.values()]
        .sort((a, b) => N(a.no) - N(b.no))
        .map(c => [
          N(c.no),
          c.name,
          c.rarity || '',
          N(c.cost),
          c.side || '',
          c.initName || '',
          N(c.troops),
          N(c.baseStat),
          N(c.baseDef),
          N(c.growth),
          N(c.growthDef),
          toFlag(c.hime),
          toFlag(c.kengou),
        ])
    : [];
  const skills = [];
  if (withData)
    for (const [, d] of [...M.skills].sort(byName)) {
      const ini = isInitSkill(d),
        tb = ini && tbByOf(d) === 'muzin';
      for (const t of trsOf(d))
        skills.push([
          d.name,
          ini ? '初期スキル' : 'スキル',
          skillSide(d),
          toFlag(d.noAdd) ? '付与できない' : '付与できる',
          COEF_BY[coefByOf(d)],
          coefMax(d) ? 1 : 0,
          N(d.muzin),
          isX(d) ? 1 : 0,
          ini ? TB_BY[tbByOf(d)] : '',
          ini ? '' : MIMIC[mimicOf(d)],
          ini ? (toFlag(d.noMimic) ? '模倣できない' : '模倣できる') : '',
          N(t.tr),
          N(t.base),
          N(t.coef),
          isMimic(d) ? N(t.mimicRate) : '',
          !ini && dupOn(d) && hasV(t.dupMax) ? N(t.dupMax) : '',
          ...(ini
            ? [
                t.statBuff ?? '',
                effsOf(d).self ? 1 : 0,
                effsOf(d).leader ? 1 : 0,
                t.mulNormal ?? '',
                t.mulLimit ?? '',
                t.totalBuff ?? '',
                tb ? (t.tbCoef ?? '') : '',
                t.troopAdd ?? '',
              ]
            : ['', '', '', '', '', '', '', '']),
        ]);
    }
  const sold = withData
    ? [...M.soldiers]
        .sort(bySoldierOrder)
        .map(([, o]) => [o.branch || '', o.name, N(o.atk), N(o.def), N(o.destroy), N(o.speed)])
    : [];
  const jb = withData
    ? [...M.jbuffs]
        .sort(byNo)
        .map(([, j]) => [N(j.no), j.name, (j.targets || []).join('、'), ...JBUFF_VALS.map(f => jv(j, f))])
    : [];
  const add = (name, head, rows, extra) => {
    const ws = XLSX.utils.aoa_to_sheet([extra ? [...head, '', ...extra] : head, ...rows]);
    ws['!cols'] = head.map(h => ({ wch: Math.max(8, h.length * 2 + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('武将データ', X_CARD, cards);
  add('スキルデータ', X_SKILL, skills, ['人数', N(config.people)]);
  add('兵種データ', X_SOLDIER, sold);
  add('傑バフデータ', X_JBUFF, jb);
  XLSX.writeFile(
    wb,
    withData
      ? `IXAマスタ_${new Date().toISOString().slice(0, 10)}.xlsx`
      : 'IXAマスタ_取り込みフォーマット.xlsx',
  );
}
function readSheet(XLSX, wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}
function planFrom(XLSX, wb) {
  const warn = [],
    plan = { cards: [], skills: [], soldiers: [], jbuffs: [], people: null, warn };
  const cr = readSheet(XLSX, wb, '武将データ'),
    sr = readSheet(XLSX, wb, 'スキルデータ'),
    or = readSheet(XLSX, wb, '兵種データ'),
    jr = readSheet(XLSX, wb, '傑バフデータ');
  if (!cr && !sr && !or && !jr)
    throw new Error(
      '「武将データ」「スキルデータ」「兵種データ」「傑バフデータ」のどのシートも見つかりません',
    );
  if (cr) {
    const h = cr[0].map(x => String(x ?? '').trim()),
      ix = n => {
        if (Array.isArray(n)) {
          for (const x of n) {
            const k = h.indexOf(x);
            if (k >= 0) return k;
          }
          return -1;
        }
        return h.indexOf(n);
      };
    const need = ['カードNo', 'カード名'];
    for (const n of need) if (ix(n) < 0) throw new Error(`武将データに「${n}」列がありません`);
    const col = {
      no: 'カードNo',
      rarity: 'レアリティ',
      cost: '武将コスト',
      side: '攻撃or防御',
      name: 'カード名',
      initName: '初期スキル名',
      troops: '兵数',
      baseStat: ['素攻撃力', '素攻撃力・素防御力'],
      baseDef: ['素防御力'],
      growth: ['攻撃上昇率', '攻撃・防御上昇率', '上昇率'],
      growthDef: ['防御上昇率'],
      hime: '姫',
      kengou: '剣豪',
      tr: 'TR',
      initSkill: '初期スキル',
      statBuff: '素攻・防バフ',
      mulNormal: '倍枠通常',
      mulLimit: '倍枠極限',
      totalBuff: '総攻・防バフ',
    };
    const g = new Map();
    for (const row of cr.slice(1)) {
      const v = k => (ix(col[k]) < 0 ? null : row[ix(col[k])]);
      if (v('no') == null || v('name') == null) continue;
      if (
        v('rarity') != null &&
        String(v('rarity')).trim() !== '' &&
        !RARITIES.includes(String(v('rarity')).trim())
      )
        warn.push(
          `カードNo ${String(v('no')).trim()} のレアリティ「${String(v('rarity')).trim()}」は選択肢にありません(そのまま登録します)`,
        );
      /* 1枚1行。TRと初期スキルの値はスキルマスタで持つので、TRの列があっても読まない(同じカードNoの2行目以降は無視) */
      const no = String(v('no')).trim();
      if (g.has(no)) continue;
      const c = {};
      for (const [f, , t] of CARD_FIELDS)
        c[f] =
          t === 'flag' || t === 'check' ? toFlag(v(f)) : t === 'number' ? N(v(f)) : String(v(f) ?? '').trim();
      g.set(no, c);
    }
    /* シートに無い列(無尽・姫など)は、登録済みの値をそのまま残す */
    const missing = CARD_FIELDS.map(([f]) => f).filter(f => ix(col[f]) < 0);
    for (const [no, c] of g) {
      const id = findId(M.cards, d => String(d.no) === no);
      if (id) {
        const old = M.cards.get(id);
        for (const f of missing) if (old[f] != null) c[f] = old[f];
        /* 初期スキルがスキルマスタにない武将の、以前のTRの値と無尽は残す */ for (const f of ['trs', 'muzin'])
          if (old[f] !== undefined) c[f] = old[f];
      }
      plan.cards.push({ id, data: c });
    }
  }
  if (sr) {
    const h = sr[0].map(x => String(x ?? '').trim()),
      ix = n => h.indexOf(n);
    for (const n of ['スキル名', 'TR', '係数'])
      if (ix(n) < 0) throw new Error(`スキルデータに「${n}」列がありません`);
    for (const row of sr) {
      const k = row.findIndex(x => String(x ?? '').trim() === '人数');
      if (k >= 0 && Number.isFinite(Number(row[k + 1]))) {
        plan.people = Number(row[k + 1]);
        break;
      }
    }
    const g = new Map();
    for (const row of sr.slice(1)) {
      const name = row[ix('スキル名')];
      if (name == null || String(name).trim() === '') continue;
      const n = String(name).trim();
      if (!g.has(n)) g.set(n, { name: n, trs: [] });
      if (ix('無尽') >= 0 && row[ix('無尽')] != null && String(row[ix('無尽')]).trim() !== '')
        g.get(n).muzin = N(row[ix('無尽')]);
      {
        const c =
          ix('付与不可') >= 0 ? ix('付与不可') : ix('スキル付与') >= 0 ? ix('スキル付与') : ix('付与');
        if (c >= 0 && row[c] != null && String(row[c]).trim() !== '') {
          const v = String(row[c]).trim();
          g.get(n).noAdd = ix('付与不可') >= 0 ? toFlag(v) : /不可|できない|×|✕|^0$|^false$/i.test(v) ? 1 : 0;
        }
      }
      if (ix('Xスキル') >= 0 && row[ix('Xスキル')] != null && String(row[ix('Xスキル')]).trim() !== '')
        g.get(n).xskill = toFlag(row[ix('Xスキル')]);
      if (
        ix('係数の掛け方') >= 0 &&
        row[ix('係数の掛け方')] != null &&
        String(row[ix('係数の掛け方')]).trim() !== ''
      ) {
        const v = String(row[ix('係数の掛け方')]).trim();
        g.get(n).coefBy =
          /同/.test(v) || v === 'same' ? 'same' : /X|Ｘ/i.test(v) || v === 'x' ? 'x' : 'people';
      }
      const s = g.get(n),
        tr = {
          tr: N(row[ix('TR')]),
          base: ix('素スキル上昇率') < 0 ? 0 : N(row[ix('素スキル上昇率')]),
          coef: N(row[ix('係数')]),
        };
      {
        const c = ix('種類');
        if (c >= 0 && hasV(row[c])) s.init = /初期/.test(String(row[c])) ? 1 : 0;
      }
      for (const [col, key] of [
        ['素攻バフ本人のみ', 'self'],
        ['部隊長限定', 'leader'],
      ]) {
        const c = ix(col);
        if (c >= 0 && hasV(row[c])) s.effFlags = { ...(s.effFlags || {}), [key]: toFlag(row[c]) === 1 };
      }
      {
        const c = ix('係数最大TR参照');
        if (c >= 0 && hasV(row[c])) s.coefMaxTr = toFlag(row[c]);
      }
      {
        const c = ix('模倣可否');
        if (c >= 0 && hasV(row[c])) s.noMimic = /不可|できない/.test(String(row[c])) ? 1 : 0;
      }
      {
        const c = ix('模倣');
        if (c >= 0 && hasV(row[c])) {
          const v = String(row[c]);
          s.mimic = /自/.test(v) ? 'self' : /他|部隊長/.test(v) ? 'leader' : 'none';
        }
        const k = ix('模倣倍率');
        if (k >= 0 && hasV(row[k])) tr.mimicRate = N(row[k]);
        const q = ix('重複上限');
        if (q >= 0 && hasV(row[q])) tr.dupMax = N(row[q]);
      }
      {
        const c = [ix('攻撃or防御'), ix('攻防')].find(x => x >= 0);
        if (c != null && hasV(row[c])) {
          const v = String(row[c]).trim();
          s.side = /攻/.test(v) && /防/.test(v) ? '攻撃・防御' : /防/.test(v) ? '防御' : '攻撃';
        }
      }
      {
        const c = ix('総攻・防バフの掛け方');
        if (c >= 0 && hasV(row[c])) s.tbBy = /無尽/.test(String(row[c])) ? 'muzin' : 'fixed';
        const k = ix('総攻・防バフ係数');
        if (k >= 0 && hasV(row[k])) tr.tbCoef = N(row[k]);
        else {
          const old = M.skills.get(findId(M.skills, d => d.name === n) || ''),
            oe = old && trEntry(old, tr.tr);
          if (oe && oe.tbCoef != null) tr.tbCoef = oe.tbCoef;
        }
      }
      {
        const k = ix('兵数加算');
        if (k >= 0 && hasV(row[k])) tr.troopAdd = N(row[k]);
        else {
          const old = M.skills.get(findId(M.skills, d => d.name === n) || ''),
            oe = old && trEntry(old, tr.tr);
          if (oe && oe.troopAdd != null) tr.troopAdd = oe.troopAdd;
        }
      }
      for (const [f, l] of SKILL_INIT) {
        const c = ix(l);
        if (c >= 0 && row[c] != null && String(row[c]).trim() !== '') tr[f] = N(row[c]);
        else {
          const old = M.skills.get(findId(M.skills, d => d.name === n) || ''),
            oe = old && trEntry(old, tr.tr);
          if (oe && oe[f] != null) tr[f] = oe[f];
        }
      }
      s.trs = s.trs.filter(t => t.tr !== tr.tr);
      s.trs.push(tr);
    }
    for (const [n, s] of g) {
      s.trs = trsOf(s);
      const id = findId(M.skills, d => d.name === n);
      if (s.muzin == null) s.muzin = id ? N(M.skills.get(id).muzin) : 0;
      if (s.xskill == null) s.xskill = id ? toFlag(M.skills.get(id).xskill) : 0;
      if (s.noAdd == null) s.noAdd = id ? toFlag(M.skills.get(id).noAdd) : 0;
      if (s.coefBy == null) s.coefBy = id ? coefByOf(M.skills.get(id)) : 'people';
      if (s.side == null) s.side = id ? skillSide(M.skills.get(id)) : '攻撃';
      if (s.mimic == null && id && isMimic(M.skills.get(id))) s.mimic = mimicOf(M.skills.get(id));
      if (s.mimic === 'none') delete s.mimic;
      if (s.init) {
        const old = id ? M.skills.get(id) : null,
          ef = {
            ...effsOf({ ...s, effs: undefined }),
            ...(old?.effs ? { self: !!old.effs.self, leader: !!old.effs.leader } : {}),
            ...(s.effFlags || {}),
          };
        s.effs = ef;
      }
      delete s.effFlags;
      if (s.coefMaxTr == null && id && M.skills.get(id).coefMaxTr) s.coefMaxTr = 1;
      if (!s.coefMaxTr || s.coefBy !== 'same') delete s.coefMaxTr;
      if (s.noMimic == null && id && M.skills.get(id).noMimic != null)
        s.noMimic = toFlag(M.skills.get(id).noMimic);
      if (s.tbBy == null && id && M.skills.get(id).tbBy) s.tbBy = tbByOf(M.skills.get(id));
      if (s.init == null)
        s.init = id
          ? isInitSkill(M.skills.get(id))
            ? 1
            : 0
          : s.trs.some(t => SKILL_INIT.some(([f]) => t[f] != null))
            ? 1
            : 0;
      if (!s.init)
        s.trs = s.trs.map(t => {
          const o = { ...t };
          for (const [f] of SKILL_INIT) delete o[f];
          delete o.troopAdd;
          delete o.tbCoef;
          return o;
        });
      plan.skills.push({ id, data: s });
    }
  }
  /* 兵種データ:兵科・兵種・攻撃力・防禦力・破壊・速度。兵種名が同じものを上書き。列名は表記ゆれも受け付ける */
  if (or && or.length) {
    const h = or[0].map(x => String(x ?? '').trim()),
      pick = names => {
        for (const n of names) {
          const k = h.indexOf(n);
          if (k >= 0) return k;
        }
        return -1;
      };
    const col = {
      name: pick(['兵種', '兵種名']),
      branch: pick(['兵科']),
      atk: pick(['攻撃力', '兵士攻撃力']),
      def: pick(['防禦力', '防御力', '兵士防御力', '兵士防禦力']),
      destroy: pick(['破壊']),
      speed: pick(['速度']),
    };
    if (col.name < 0) throw new Error('兵種データに「兵種」列がありません');
    if (col.atk < 0) throw new Error('兵種データに「攻撃力」列がありません');
    const g = new Map();
    let order = 0;
    for (const row of or.slice(1)) {
      const name = row[col.name];
      if (name == null || String(name).trim() === '') continue;
      const n = String(name).trim();
      const d = {
        name: n,
        branch: col.branch < 0 ? '' : String(row[col.branch] ?? '').trim(),
        order: ++order,
      };
      for (const f of ['atk', 'def', 'destroy', 'speed']) {
        const v = col[f] < 0 ? null : row[col[f]];
        if (f === 'atk' && (v == null || String(v).trim() === '' || !Number.isFinite(Number(v))))
          warn.push(`兵種「${n}」の攻撃力が数値ではありません(0として取り込みます)`);
        d[f] = N(v);
      }
      if (g.has(n)) warn.push(`兵種「${n}」が2行あります(後の行を使います)`);
      g.set(n, d);
    }
    for (const [n, d] of g) plan.soldiers.push({ id: findId(M.soldiers, x => x.name === n), data: d });
  }
  /* 傑バフデータ:カードNo・武将名・対象兵種(「、」区切り。空なら全兵種)・所属時攻撃力・所属時防御力・外部攻撃力・外部防御力。カードNoが同じものを上書き */
  if (jr && jr.length) {
    const h = jr[0].map(x => String(x ?? '').trim()),
      pick = names => {
        for (const n of names) {
          const k = h.indexOf(n);
          if (k >= 0) return k;
        }
        return -1;
      };
    const col = {
      no: pick(['カードNo', 'カードNO', 'No']),
      name: pick(['武将名', 'カード名']),
      targets: pick(['対象兵種', '兵種']),
      atkIn: pick(['所属時攻撃力']),
      defIn: pick(['所属時防御力', '所属時防禦力']),
      atkOut: pick(['外部攻撃力']),
      defOut: pick(['外部防御力', '外部防禦力']),
    };
    const JL = {
      no: 'カードNo',
      name: '武将名',
      targets: '対象兵種',
      atkIn: '所属時攻撃力',
      defIn: '所属時防御力',
      atkOut: '外部攻撃力',
      defOut: '外部防御力',
    };
    for (const k in JL) if (col[k] < 0) throw new Error(`傑バフデータに「${JL[k]}」列がありません`);
    const g = new Map();
    for (const row of jr.slice(1)) {
      const no = row[col.no],
        name = row[col.name];
      if ((no == null || String(no).trim() === '') && (name == null || String(name).trim() === '')) continue;
      const n = String(name ?? '').trim();
      if (no == null || !Number.isFinite(Number(no))) {
        warn.push(`傑バフ「${n || '(名前なし)'}」のカードNoが数値ではないため、取り込みません`);
        continue;
      }
      const key = String(Number(no)),
        d = { no: Number(no), name: n, targets: splitTargets(row[col.targets]) };
      const miss = d.targets.filter(t => !findId(M.soldiers, x => x.name === t));
      if (miss.length)
        warn.push(
          `傑バフ「${n}」の対象兵種「${miss.join('、')}」は兵種マスタにありません(名前のまま登録します)`,
        );
      for (const f of JBUFF_VALS) {
        const v = row[col[f]];
        if (v != null && String(v).trim() !== '' && !Number.isFinite(Number(v)))
          warn.push(`傑バフ「${n}」の${JL[f]}が数値ではありません(0として取り込みます)`);
        d[f] = N(v);
      }
      if (g.has(key)) warn.push(`カードNo ${key} の傑バフが2行あります(後の行を使います)`);
      g.set(key, d);
    }
    for (const [key, d] of g) plan.jbuffs.push({ id: findId(M.jbuffs, x => String(x.no) === key), data: d });
  }
  plan.warn = [...new Set(warn)];
  return plan;
}
$('mimport').addEventListener('click', () => {
  draft = null;
  renderEditor();
  importPlan = 'pick';
  renderImport();
});
$('importbox').addEventListener('change', async e => {
  if (e.target.id !== 'xfile' || !e.target.files[0]) return;
  const m = $('impmsg');
  m.className = 'msg';
  m.textContent = '読み込んでいます…';
  try {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(await e.target.files[0].arrayBuffer(), { type: 'array' });
    importPlan = planFrom(XLSX, wb);
    renderImport();
  } catch (err) {
    m.className = 'msg err';
    m.textContent = '読み込めませんでした:' + err.message;
  }
});
$('importbox').addEventListener('click', async e => {
  const b = e.target.closest('[data-imp]');
  if (!b) return;
  if (b.dataset.imp === 'cancel') {
    importPlan = null;
    renderImport();
    return;
  }
  if (b.dataset.imp === 'fmt' || b.dataset.imp === 'dump') {
    const m = $('impmsg');
    try {
      m.className = 'msg';
      m.textContent = '作成しています…';
      await downloadXlsx(b.dataset.imp === 'dump');
      m.textContent = '';
    } catch (err) {
      m.className = 'msg err';
      m.textContent = '作成できませんでした:' + err.message;
    }
    return;
  }
  if (needName()) return;
  const p = importPlan,
    m = $('impmsg');
  b.disabled = true;
  let done = 0;
  const total =
    p.cards.length + p.skills.length + p.soldiers.length + p.jbuffs.length + (p.people != null ? 1 : 0);
  try {
    for (const c of p.cards) {
      await writeWithLog(
        'Excel取り込み',
        'cards',
        c.id || 'n' + c.data.no + '_' + Math.random().toString(36).slice(2, 6),
        c.data,
      );
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const s of p.skills) {
      await writeWithLog('Excel取り込み', 'skills', s.id || newId('s'), s.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const o of p.soldiers) {
      await writeWithLog('Excel取り込み', 'soldiers', o.id || newId('o'), o.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    for (const j of p.jbuffs) {
      await writeWithLog('Excel取り込み', 'jbuffs', j.id || 'j' + j.data.no, j.data);
      m.textContent = `取り込み中 ${++done}/${total}`;
    }
    if (p.people != null) {
      await writeWithLog('Excel取り込み', 'config', 'main', { ...plain(config), people: p.people });
      done++;
    }
    importPlan = null;
    renderImport();
    status(`Excelから ${done} 件を取り込みました。`);
    setTimeout(() => status(''), 5000);
  } catch (err) {
    m.className = 'msg err';
    m.textContent = `${done}件まで取り込んだところで止まりました(${logErr(err)})。もう一度「取り込む」を押すと続きから上書きします。`;
    b.disabled = false;
  }
});
