// 定数・共有の状態・小さな道具(どのファイルからも使う)
// 使うファイル:なし(調べ方:node tests/deps.js)
const BASE = 'master/v2';
const SLOT_NAMES = ['部隊長', '小隊長1', '小隊長2', '小隊長3'];
const SP = { rei: '黎天列光', hi: '火焔武闘' };
/* 無尽:部隊長がこのカードNoのとき、無尽の効果がかかる
   ・初期スキル:武将マスタの無尽が1以上なら2倍、0なら0(無効)
   ・極限スキル:全員2倍(無尽が付与される)
   ・追加スキル:スキルマスタの無尽が1以上のスキルは2倍 */
const MUZIN_LEADER_NO = '1274';
const muzinOn = () => !!form && String(M.cards.get(form.slots[0].card)?.no ?? '') === MUZIN_LEADER_NO;
const REI_TROOPS = 2000;
const STAT_FACTOR = 690;
const SAMPLE = {
  jin: 1.05,
  slots: [
    { card: '10052', tr: 5, soldier: '焙烙火矢', s1: ['', 0], s2: ['', 0], lim: ['', 0] },
    {
      card: '1286',
      tr: 5,
      soldier: '焙烙火矢',
      s1: ['天地超克', 0],
      s2: ['勇冠三軍', 0],
      lim: ['万物神勇', 0],
    },
    {
      card: '10053',
      tr: 5,
      soldier: '焙烙火矢',
      s1: ['勇冠三軍', 5],
      s2: ['万物神勇', 5],
      lim: ['天地超克', 5],
    },
    {
      card: '10066',
      tr: 5,
      soldier: '焙烙火矢',
      s1: ['天地超克', 0],
      s2: ['万物神勇', 0],
      lim: ['勇冠三軍', 0],
    },
  ],
};
const M = { cards: new Map(), skills: new Map(), soldiers: new Map(), jbuffs: new Map() };
/* 最終更新者:管理者ごとの表示名は、Firebase コンソールで admins/{ユーザーID} の name フィールドに登録する。
   保存のたびに 表示名・ユーザーID・日時 を記録する */
let me = null,
  adminName = '';
const myName = () => adminName;
const nowStamp = () => ({
  updatedBy: me?.uid || '',
  updatedName: myName(),
  updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
});
const loaded = { cards: false, skills: false, soldiers: false, jbuffs: false, config: false };
let config = { people: 280 };
let db = null,
  isOwner = false,
  mtab = 'cards',
  draft = null,
  form = null,
  importPlan = null;
const $ = id => document.getElementById(id);
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const N = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString('ja-JP', { maximumFractionDigits: d }) : '—';
function jp(n) {
  if (!Number.isFinite(n)) return '';
  const v = Math.round(n),
    oku = Math.floor(v / 1e8),
    man = Math.floor((v % 1e8) / 1e4);
  return (oku ? oku + '億' : '') + (man ? man + '万' : '');
}
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
function status(text, warn) {
  const s = $('status');
  s.hidden = !text;
  s.textContent = text || '';
  s.className = 'banner' + (warn ? ' warn' : '');
}
const allLoaded = () => loaded.cards && loaded.skills && loaded.soldiers;
const trsOf = d => [...(d?.trs || [])].sort((a, b) => N(a.tr) - N(b.tr));
const trEntry = (d, tr) => (d?.trs || []).find(t => N(t.tr) === N(tr));
const cardAtk = c => N(c.baseStat) + N(c.growth) * STAT_FACTOR;
/* ---------- HTML の小さな部品 ---------- */
/* ボタン1つ。attrs は data-* などの属性(なければ空) */
const button = (label, attrs = '', cls = 'btn') =>
  `<button class="${cls}" type="button"${attrs ? ' ' + attrs : ''}>${label}</button>`;
/* 横に並べるボタンの列 */
const buttonRow = (...btns) => `<div style="display:flex;gap:8px;flex-wrap:wrap">${btns.join('')}</div>`;

/* ---------- どのファイルからも使う小さな道具 ---------- */
const toFlag = v => {
  if (v == null) return 0;
  const t = String(v).trim();
  if (t === '' || t === '0' || /^(false|no|なし|いいえ|×|✕|-|—)$/i.test(t) || /(ではない|しない)$/.test(t))
    return 0;
  return 1;
};
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const byName = (a, b) =>
  String(a[1].name).localeCompare(String(b[1].name), 'ja', { numeric: true }) || N(a[1].no) - N(b[1].no);
/* 検索用に、ひらがな・カタカナ・全角半角の違いをそろえる */
const kana = s =>
  String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasV = v => v != null && String(v).trim() !== '';
const findId = (map, pred) => {
  for (const [id, d] of map) if (pred(d)) return id;
  return '';
};
