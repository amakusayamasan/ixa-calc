// 回帰テスト:いろいろな登録・編成をして、計算結果・画面の表示・保存データを JSON で出力する。
// 使い方:リポジトリのフォルダで `python3 -m http.server 8765` を起動してから
//   node tests/regress.js > out.json   (整理の前後で out.json が同じなら、動きは変わっていない)
// Firebase は tests/stub.js(模擬版)、SheetJS は tests/fakexlsx.js(模擬版)に差し替える。
const {chromium}=require('playwright');const path=require('path');const dir=__dirname;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let t=1794600000000,r=0.123;Date.now=()=>t++;Math.random=()=>{r=(r*9301+49297)%233280/233280;return r}});
await p.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/,r=>r.fulfill({path:path.join(dir,'stub.js'),contentType:'text/javascript'}));
await p.route(/gstatic\.com\/firebasejs\/.*(auth|firestore)-compat\.js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
await p.route(/cdnjs\.cloudflare\.com\/.*xlsx/,r=>r.fulfill({path:path.join(dir,'fakexlsx.js'),contentType:'text/javascript'}));
await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({body:'',contentType:'text/css'}));
const out={};const W=ms=>p.waitForTimeout(ms);
await p.goto('http://127.0.0.1:'+(process.env.PORT||8765)+'/index.html?mode=admin&rules=1');await W(200);await p.click('#login');await W(80);
await p.click('#tab-master');await p.click('#seedRun');await W(200);
await p.click('#tab-calc');await p.evaluate(()=>{form=fromKeys(SAMPLE);renderCalc()});await W(50);
const snapCalc=()=>p.evaluate(()=>{const r=calc();const rnd=v=>typeof v==='number'?Math.round(v*1000)/1000:v;
  const eff=[];form.slots.forEach((s,i)=>['s1','s2','lim'].forEach(k=>eff.push(skillEffect(i,k).replace(/<[^>]+>/g,''))));
  return{total:rnd(r.total),base:rnd(r.base),skill:rnd(r.skill),buff:rnd(r.buff),rei:r.rei,hi:r.hi,muzin:r.muzin,
    rows:r.rows.map(x=>x&&Object.fromEntries(Object.entries(x).map(([k,v])=>[k,rnd(v)]))),eff,
    bd:[...document.querySelectorAll('[id^=calc-]')].map(e=>e.innerHTML)}});
out.sample=await snapCalc();
// 初期スキル・スキルを画面から登録
await p.click('#tab-master');await p.click('[data-m=skills]');
const addTr=async n=>{for(let k=0;k<n;k++)await p.click('[data-act=addtr]')};
const save=async()=>{await p.click('#edform button[type=submit]');await W(80);const m=await p.textContent('#edmsg').catch(()=>'');await p.click('[data-act=close]').catch(()=>{});return m};
const inits=[
 {n:'初L',eff:['stat'],v:{statBuff:3},lead:true,base:1450},
 {n:'初S',eff:['stat','mul'],self:true,v:{statBuff:2.5,mulNormal:2,mulLimit:1.5},base:900},
 {n:'初T',eff:['total','troop'],muz:1,tb:'muzin',v:{totalBuff:1.2,tbCoef:4.1,troopAdd:3000},base:800},
 {n:'初M',eff:['mul'],muz:1,coefBy:'same',coefMax:true,v:{mulNormal:3,mulLimit:2},base:500,coef:[10,20,30,40,50,60]},
];
out.msgs=[];
for(const s of inits){await p.click('#maddInit');await W(40);await p.fill('#f-name',s.n);
  if(s.coefBy){await p.selectOption('#f-coefBy',s.coefBy);await W(30)}if(s.coefMax){await p.check('#f-coefMaxTr');await W(30)}
  for(const e of s.eff){await p.check(`[data-eff=${e}]`);await W(30)}if(s.self){await p.check('[data-eff2=self]');await W(30)}if(s.lead){await p.check('[data-eff2=leader]');await W(30)}
  if(s.tb){await p.selectOption('#f-tbBy',s.tb);await W(30)}await addTr(5);if(s.muz){await p.check('[data-effx=muzin]');await W(30);for(let k=0;k<6;k++)await p.fill(`[data-t="${k}:muzin"]`,String(s.muz))}
  for(let k=0;k<6;k++){await p.fill(`[data-t="${k}:base"]`,String(s.base+k*100));if(s.coef)await p.fill(`[data-t="${k}:coef"]`,String(s.coef[k]));for(const [f,v] of Object.entries(s.v))await p.fill(`[data-t="${k}:${f}"]`,String(v))}
  out['editorText_'+s.n]=await p.$eval('#edform',e=>e.innerHTML.replace(/ value="[^"]*"/g,''));out.msgs.push(await save())}
const skills=[
 {n:'自模倣S',mimic:'self',rate:[1,1,1,1.05,1.1,1.15]},{n:'他真似S',mimic:'leader',rate:[1.1,1.1,1.2,1.2,1.25,1.25],base:100},
 {n:'火焔武闘',x:true,coefBy:'x',coef:720,dup:2},{n:'同数S',coefBy:'same',coef:50,base:300,coefMax:true},{n:'防御S',side:'防御',base:5000},{n:'無尽S',muz:1,base:2000,coef:3}];
for(const s of skills){await p.click('#maddSkill');await W(40);await p.fill('#f-name',s.n);if(s.side)await p.selectOption('#f-side',s.side);
  if(s.x)await p.selectOption('#f-xskill','1');if(s.coefBy){await p.selectOption('#f-coefBy',s.coefBy);await W(30)}if(s.coefMax){await p.check('#f-coefMaxTr');await W(30)}
  if(s.mimic){await p.selectOption('#f-mimic',s.mimic);await W(30)}if(s.dup){await p.check('[data-eff=dup]');await W(30)}await addTr(5);if(s.muz){await p.check('[data-effx=muzin]');await W(30);for(let k=0;k<6;k++)await p.fill(`[data-t="${k}:muzin"]`,String(s.muz))}
  for(let k=0;k<6;k++){if(s.base!=null)await p.fill(`[data-t="${k}:base"]`,String(s.base+k*10));if(s.coef!=null&&!s.mimic)await p.fill(`[data-t="${k}:coef"]`,String(s.coef));if(s.rate)await p.fill(`[data-t="${k}:mimicRate"]`,String(s.rate[k]));}if(s.dup)await p.fill('#f-dupMax',String(s.dup));
  out['editorText_'+s.n]=await p.$eval('#edform',e=>e.innerHTML.replace(/ value="[^"]*"/g,''));out.msgs.push(await save())}
out.skillList=await p.$eval('#mtable',e=>e.innerHTML);
// 武将に初期スキルを設定(画面から)
await p.click('[data-m=cards]');
const cardInit=[['緋村剣心','初L',{hime:true}],['織田信長','初S',{}],['志々雄真実','初T',{kengou:true}],['斎藤一','初M',{}]];
for(const [cn,sn,f] of cardInit){await p.locator('#mtable tbody tr',{hasText:cn}).first().click();await W(50);await p.fill('#f-initName',sn);if(f.hime)await p.check('#f-hime');if(f.kengou)await p.check('#f-kengou');out.msgs.push(await save())}
// 存在しない初期スキル名 → 初期スキル追加画面へ
await p.locator('#mtable tbody tr',{hasText:'織田信長'}).nth(1).click();await W(50);await p.fill('#f-initName','未登録初期');await p.click('#edform button[type=submit]');await W(100);
out.redirect=await p.evaluate(()=>[mtab,draft&&draft.coll,draft&&draft.data.name,$('edmsg').textContent]);await p.click('[data-act=close]');
await p.click('[data-m=cards]');out.cardList=await p.$eval('#mtable',e=>e.innerHTML);out.masterHead=await p.$eval('#view-master',e=>e.innerText.slice(0,400));out.cardEditor=await (async()=>{await p.locator('#mtable tbody tr',{hasText:'緋村剣心'}).click();await W(50);const t=await p.$eval('#edform',e=>e.innerHTML);await p.click('[data-act=close]');return t})();
// 編成いろいろ
await p.click('#tab-calc');await W(50);
const setForm=async spec=>{await p.evaluate(spec=>{const sid=n=>n?findId(M.skills,d=>d.name===n):'';const cid=n=>findId(M.cards,d=>d.name===n&&d.rarity!=='覇・パラレル天'&&d.rarity!=='パラレル天')||findId(M.cards,d=>d.name===n);
  spec.forEach((x,i)=>{const s=form.slots[i];s.card=cid(x[0]);s.tr=x[1];s.s1={id:sid(x[2]),tr:x[3]??0};s.s2={id:sid(x[4]),tr:x[5]??0};s.lim={id:sid(x[6]),tr:x[7]??0};if(x[8])s.alloc=x[8]});renderCalc()},spec);await W(40)};
const forms={
 f1:[['緋村剣心',5,'火焔武闘',0,'自模倣S',5,'他真似S',5],['織田信長',5,'火焔武闘',2,'同数S',1,'他真似S',3],['志々雄真実',5,'火焔武闘',5,'同数S',5,'無尽S',2],['斎藤一',5,'火焔武闘',1,'防御S',0,'同数S',3,'hei']],
 f2:[['斎藤一',3,'無尽S',5,'自模倣S',4,'他真似S',2],['緋村剣心',4,'同数S',2,'火焔武闘',3,'無尽S',1],['志々雄真実',2,'他真似S',5,'火焔武闘',0,'同数S',4],['織田信長',0,'火焔武闘',4,'',0,'自模倣S',5]],
};
for(const [k,spec] of Object.entries(forms)){await setForm(spec);out[k]=await snapCalc();out[k+'_slots']=await p.$eval('#slots',e=>e.innerHTML);out[k+'_jbbtn']=await p.textContent('#jbBtn');await p.fill('#jin','1.1');await p.dispatchEvent('#jin','input');await W(30);out[k+'_jin']=(await snapCalc()).total;await p.fill('#jin','1.05');await p.dispatchEvent('#jin','input')}
// 無尽部隊(部隊長を No.1274 に)
await p.evaluate(async()=>{const id=findId(M.cards,d=>d.name==='緋村剣心');const d=structuredClone(M.cards.get(id));d.no='1274';const b=db.batch();putWithLog(b,'更新','cards',id,d);await b.commit()});await W(100);
for(const [k,spec] of Object.entries(forms)){await setForm(spec);out[k+'_muzin']=await snapCalc()}
// 傑バフ
await p.evaluate(async()=>{const b=db.batch();putWithLog(b,'追加','jbuffs','jb1',{no:20001,name:'傑A',targets:['焙烙火矢','鉄砲騎馬'],atkIn:5,defIn:3,atkOut:2,defOut:1},null);putWithLog(b,'追加','jbuffs','jb2',{no:20002,name:'傑B',targets:['焙烙火矢'],atkIn:4,defIn:0,atkOut:3,defOut:0},null);await b.commit()});await W(100);
await setForm(forms.f1);await p.click('#jbBtn');await W(30);out.jbPanel=await p.$eval('#jbpanel',e=>e.innerHTML);await p.click('#jbpanel button:has-text("すべてOn")');await W(40);out.f1_jb=await snapCalc();
// 候補一覧
await p.click('#card-0');await p.fill('#card-0','');await W(60);out.cardCands=await p.$eval('#list-card-0',e=>[...e.querySelectorAll('li')].map(l=>l.className.replace(/\s*active/,'')+'|'+l.innerText.replace(/\n/g,' ')));
await p.keyboard.press('Escape');await p.click('#s1-1');await p.fill('#s1-1','');await W(60);out.skillCands=await p.$eval('#list-s1-1',e=>[...e.querySelectorAll('li')].map(l=>l.className.replace(/\s*active/,'')+'|'+l.innerText.replace(/\n/g,' ')));await p.keyboard.press('Escape');
// Excel ダウンロード(模擬)→ 取り込み
await p.click('#tab-master');await p.click('#mimport');await W(40);out.importPick=await p.$eval('#importbox',e=>e.innerHTML);await p.click('[data-imp=fmt]');await W(100);out.xlsxFmt=await p.evaluate(()=>[window.__fname,window.__wb.SheetNames,...window.__wb.SheetNames.map(n=>window.__wb.Sheets[n].aoa)]);
await p.click('[data-imp=dump]');await W(100);out.xlsxDump=await p.evaluate(()=>window.__wb.SheetNames.map(n=>window.__wb.Sheets[n].aoa));
const before=await p.evaluate(()=>Math.round(calc().total));
await p.evaluate(()=>{importPlan=planFrom(window.XLSX,window.__wb);renderImport()});await W(40);out.importPlan=await p.$eval('#importbox',e=>e.innerHTML);await p.click('[data-imp=run]');await W(500);
out.afterImport=[before,await p.evaluate(()=>Math.round(calc().total))];
// 人数・削除・不要データ
await p.click('[data-m=skills]');await p.fill('#peopleIn','300');await p.click('#peopleSave');await W(80);out.people=await p.evaluate(()=>config.people);
await p.click('[data-m=soldiers]');await p.locator('#mtable tbody tr').first().click();await W(40);await p.click('[data-act=delete]');await W(20);await p.click('[data-act=delete]');await W(100);

// 防御部隊(Excel「柳生部隊」と同じ編成。期待値 2,935,090,108.339...)
await p.evaluate(async()=>{const b=db.batch();const P=(c,id,d)=>putWithLog(b,'追加',c,id,d,null);
 const ini=(name,trs,ef)=>P('skills','I'+name,{name,init:1,side:'攻撃・防御',noAdd:1,coefBy:'people',muzin:0,xskill:0,noMimic:0,tbBy:'fixed',effs:{stat:false,mul:false,total:false,troop:false,self:false,leader:false,enemy:false,split:false,...ef},trs});
 ini('斎藤初',[{tr:5,base:0,coef:0,totalBuff:1.8}],{total:true});ini('尼子初',[{tr:2,base:0,coef:0,mulNormal:2,mulLimit:2.3}],{mul:true});
 ini('長宗我部初',[{tr:5,base:990,coef:0,mulNormal:1,mulLimit:4.5}],{mul:true});ini('傑秀吉初',[{tr:0,base:550,coef:0}],{enemy:true});
 ini('攻防初',[{tr:0,base:1000,coef:0,statBuff:2,baseD:3000,statBuffD:1.5}],{stat:true,split:true});
 const card=(id,no,name,initName,troops,bd,gd,rar='天')=>P('cards',id,{no,name,initName,troops,baseStat:1000,baseDef:bd,growth:0,growthDef:gd,rarity:rar,side:'攻撃・防御',cost:5,hime:0,kengou:0});
 card('d1',90001,'斎藤覇','斎藤初',8300,1310,10);card('d2',90002,'尼子経久','尼子初',7540,1270,74);card('d3',90003,'長宗我部','長宗我部初',7700,1260,72);card('d4',20003,'傑秀吉B','傑秀吉初',24000,90000,0,'傑');card('d5',90005,'攻防将','攻防初',8000,1000,10);
 const sk=(name,base)=>P('skills','S'+name,{name,init:0,side:'防御',noAdd:0,coefBy:'people',muzin:0,xskill:0,effs:{dup:false},trs:[{tr:0,base,coef:0}]});
 sk('泰厳射手',3220);sk('従魔',2632);sk('魔導',2352);sk('権謀',520);sk('梵天',2850);sk('梵天5',24764.4/(4.5*1.2));
 P('jbuffs','jbH',{no:20003,name:'傑秀吉B',targets:['鉄砲騎馬'],atkIn:0,defIn:7,atkOut:0,defOut:0});await b.commit()});await W(150);
await p.click('#tab-calc');await W(40);await p.click('[data-mode=def]');await W(60);
const setDef=async spec=>{await p.evaluate(spec=>{const sid=n=>n?findId(M.skills,d=>d.name===n):'';const cid=n=>findId(M.cards,d=>d.name===n);const sol=findId(M.soldiers,d=>d.name==='鉄砲騎馬');
  spec.forEach((x,i)=>{const s=form.slots[i];s.card=cid(x[0]);s.tr=x[1];s.soldier=sol;s.s1={id:sid(x[2]),tr:0};s.s2={id:sid(x[3]),tr:0};s.lim={id:sid(x[4]),tr:0}});renderCalc()},spec);await W(40)};
await setDef([['斎藤覇',5,'泰厳射手','従魔','梵天'],['尼子経久',2,'従魔','魔導','梵天'],['長宗我部',5,'権謀','従魔','梵天5'],['傑秀吉B',0,'','','']]);
out.def1=await snapCalc();out.def1_slots=await p.$eval('#slots',e=>e.innerHTML);out.def1_head=await p.$eval('#view-calc',e=>e.innerText.slice(0,500));
await setDef([['攻防将',0,'泰厳射手','','梵天'],['尼子経久',2,'従魔','魔導','梵天'],['長宗我部',5,'権謀','従魔','梵天5'],['斎藤覇',5,'','','']]);out.def2=await snapCalc();
await p.click('[data-mode=atk]');await W(60);out.backToAtk=await snapCalc();
// 保存データ(日時・ID を除く)
out.store=await p.evaluate(()=>{const st=window.__store,strip=o=>JSON.parse(JSON.stringify(o,(k,v)=>['updatedAt','at','logId'].includes(k)?undefined:v));
  const m={};for(const [k,v] of Object.entries(st)){if(k.startsWith('logs/'))continue;const c=k.split('/')[2];(m[c]=m[c]||[]).push(strip(v))}
  for(const c in m)m[c]=m[c].map(x=>JSON.stringify(x)).sort();
  const logs=Object.entries(st).filter(([k])=>k.startsWith('logs/')).map(([k,v])=>[v.action,v.coll,v.label,v.name,v.by,k.startsWith('logs/del_')]).map(x=>x.join('|')).sort();return{m,logs}});
// 管理者でないログイン・閲覧のみ
const p2=await b.newPage();p2.on('pageerror',e=>errs.push('p2:'+e.message));for(const [re,f] of [[/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/,'stub.js']])await p2.route(re,r=>r.fulfill({path:path.join(dir,f),contentType:'text/javascript'}));
await p2.route(/gstatic\.com\/firebasejs\/.*(auth|firestore)-compat\.js/,r=>r.fulfill({body:''}));await p2.route(/fonts\./,r=>r.fulfill({body:''}));
await p2.goto('http://127.0.0.1:'+(process.env.PORT||8765)+'/index.html?mode=viewer');await p2.waitForTimeout(200);out.viewerHead=await p2.$eval('header',e=>e.innerHTML);
await p2.click('#login');await p2.waitForTimeout(100);out.uidnote=await p2.$eval('#uidnote',e=>e.innerHTML);await p2.click('#tab-master');await p2.waitForTimeout(50);out.viewerMaster=await p2.$eval('#view-master',e=>e.innerText.slice(0,600));
out.errs=errs;process.stdout.write(JSON.stringify(out,null,1));await b.close()})();
