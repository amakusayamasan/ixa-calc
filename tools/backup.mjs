// マスタのバックアップ:Firestore の master/v2 を読み出して backup/master.json に保存する(GitHub Actions から毎日実行)
// マスタは誰でも読める設定なので、ログインなしで公開の REST API から読める。形は seed/master.json と同じ
// 使い方:node tools/backup.mjs [出力先(省略時 backup/master.json)]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] || 'backup/master.json';
const cfgText = readFileSync(new URL('../firebase-config.js', import.meta.url), 'utf8');
const pick = k => (cfgText.match(new RegExp(`${k}:\\s*"([^"]+)"`)) || [])[1];
const projectId = pick('projectId'),
  apiKey = pick('apiKey');
if (!projectId || !apiKey) throw new Error('firebase-config.js から projectId / apiKey を読めません');
const ROOT = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/master/v2`;
const COLLS = ['cards', 'skills', 'soldiers', 'jbuffs', 'config'];
const OMIT = ['updatedBy', 'updatedName', 'updatedAt', 'logId'];

/* Firestore の値の形({stringValue: …} など)をふつうの JSON に */
export function plain(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('mapValue' in v) return fields(v.mapValue.fields);
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  return null;
}
const fields = f => Object.fromEntries(Object.keys(f || {}).sort().map(k => [k, plain(f[k])]));

async function readColl(coll) {
  const out = {};
  let token = '';
  do {
    const url = `${ROOT}/${coll}?pageSize=300&key=${apiKey}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${coll} を読めません(${r.status} ${await r.text()})`);
    const j = await r.json();
    for (const d of j.documents || []) {
      /* 最終更新者(ユーザーID・表示名)・更新日時・履歴IDは入れない(データだけ残す) */
      const o = fields(d.fields);
      for (const k of OMIT) delete o[k];
      out[d.name.split('/').pop()] = o;
    }
    token = j.nextPageToken || '';
  } while (token);
  return Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = {};
  for (const c of COLLS) data[c] = await readColl(c);
  /* 読み込みに失敗して空になったときは上書きしない(前のバックアップを守る) */
  if (!Object.keys(data.cards).length || !Object.keys(data.skills).length)
    throw new Error('武将かスキルが0件でした。上書きせずに終了します');
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log(COLLS.map(c => `${c} ${Object.keys(data[c]).length}件`).join(' / '));
}
