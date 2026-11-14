// 部隊内で数えるルールのテスト(飛翔の数・部隊移動速度・重複上限で外れた初期スキル・敵武将の総コスト・追加スキルの攻防の値・姫・剣豪・対象兵科の数の総バフ・兵数加算)。期待値と違えば失敗する。
// 使い方:リポジトリのフォルダで `python3 -m http.server 8765` を起動してから  node tests/rules.js
const {chromium}=require('playwright');const path=require('path');const dir=__dirname;
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/,r=>r.fulfill({path:path.join(dir,'stub.js'),contentType:'text/javascript'}));
await p.route(/gstatic\.com\/firebasejs\/.*(auth|firestore)-compat\.js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({body:'',contentType:'text/css'}));
await p.goto('http://127.0.0.1:'+(process.env.PORT||8765)+'/index.html');await p.waitForTimeout(600);
const got=await p.evaluate(()=>{const tr=o=>[0,1,2,3,4,5].map(t=>({tr:t,...o(t)}));const e={id:'',tr:0};const out={};
 /* 1. 飛翔の数(各武将の最大を足す)と、重複上限で外れた初期スキルの特殊効果 */
 M.skills.set('H1',{name:'飛A',init:0,coefBy:'people',effs:{hisho:true},trs:tr(t=>({base:100,coef:0,hisho:t+1}))});
 M.skills.set('H2',{name:'飛B',init:0,coefBy:'people',effs:{hisho:true},trs:tr(t=>({base:100,coef:0,hisho:2}))});
 M.skills.set('HC',{name:'飛係数',init:0,coefBy:'hisho',trs:tr(t=>({base:0,coef:10}))});
 M.skills.set('IH',{name:'初飛',init:1,coefBy:'people',effs:{hisho:true},trs:tr(t=>({base:500,coef:0,hisho:4}))});
 M.skills.set('ID',{name:'初重',init:1,coefBy:'people',dupMax:1,effs:{dup:true,total:true,stat:true,mul:true},trs:tr(t=>({base:1000+t,coef:0,statBuff:2,totalBuff:1.5,mulNormal:2,mulLimit:1}))});
 const card=(no,init)=>({no,rarity:'天',name:'C'+no,initName:init,troops:1000,baseStat:1000,growth:0,trs:[]});
 M.cards.set('c1',card(1,'初飛'));M.cards.set('c2',card(2,'なし'));M.cards.set('c3',card(3,'初重'));M.cards.set('c4',card(4,'初重'));
 form={jin:1,slots:[{card:'c1',tr:0,soldier:'',alloc:'atk',s1:{id:'H1',tr:5},s2:{id:'HC',tr:0},lim:e},{card:'c2',tr:0,soldier:'',alloc:'atk',s1:{id:'H1',tr:0},s2:{id:'H2',tr:0},lim:e},{card:'c3',tr:5,soldier:'',alloc:'atk',s1:e,s2:e,lim:e},{card:'c4',tr:0,soldier:'',alloc:'atk',s1:e,s2:e,lim:e}]};
 const r=calc();out.hisho=coefN(M.skills.get('HC'),'HC');out.hcVal=skillVal(form.slots[0].s2,0);
 out.drop=r.rows.map(x=>x.initDrop);out.sb=r.rows.map(x=>x.sb);out.buff=r.buff;
 /* 2. 部隊移動速度(いちばん遅い兵種 × (100 + 速度スキルの合計) ÷ 100)と、無尽のとき */
 for(const k of [...M.skills.keys()])M.skills.delete(k);for(const k of [...M.cards.keys()])M.cards.delete(k);
 M.soldiers.set('o1',{name:'速い',atk:30,speed:20});M.soldiers.set('o2',{name:'遅い',atk:30,speed:16});
 M.skills.set('I',{name:'初',init:1,side:'攻撃',coefBy:'people',effs:{speed:true,muzin:true},trs:tr(t=>({base:1000,coef:0,speed:1000,muzin:1}))});
 M.skills.set('SP',{name:'速',init:0,side:'攻撃',coefBy:'people',effs:{speed:true,muzin:true},trs:tr(t=>({base:100,coef:0,speed:270,muzin:1}))});
 M.skills.set('SC',{name:'速度係数',init:0,side:'攻撃',coefBy:'speed',effs:{muzin:true},trs:tr(t=>({base:0,coef:31,muzin:1}))});
 for(let i=0;i<4;i++)M.cards.set('c'+i,{no:(i?2000+i:1274),rarity:'天',side:'攻撃',name:'武'+i,initName:'初',troops:1000,baseStat:1000,growth:0});
 form={jin:1,slots:[{card:'c0',tr:0,soldier:'o1',alloc:'atk',s1:{id:'SC',tr:0},s2:e,lim:e},{card:'c1',tr:0,soldier:'o2',alloc:'atk',s1:{id:'SP',tr:0},s2:e,lim:e},{card:'c2',tr:0,soldier:'',alloc:'atk',s1:e,s2:e,lim:e},{card:'c3',tr:0,soldier:'o1',alloc:'atk',s1:e,s2:e,lim:e}]};
 out.speed=unitSpeed();out.speedVal=Math.round(skillVal(form.slots[0].s1,0)*100)/100;out.speedMuzin=muzinMul(form.slots[0].s1,'s1');
 /* 3. 敵武将の総コスト(係数 × 平均コスト × 人数) */
 config.people=280;config.avgCost=4.5;
 M.skills.set('CO',{name:'総コスト',init:0,side:'攻撃',coefBy:'cost',trs:tr(t=>({base:0,coef:0.5}))});
 out.costVal=skillVal({id:'CO',tr:0},1);out.costLabel=skillLabel(M.skills.get('CO').trs[0],M.skills.get('CO'));
 /* 4. 追加スキルを攻撃と防御で分ける(防御部隊では(防)の値) */
 M.skills.set('SPL',{name:'分け',init:0,side:'攻撃・防御',coefBy:'people',effs:{split:true},trs:tr(t=>({base:250,coef:0.5,baseD:300,coefD:0.5}))});
 out.splitAtk=skillVal({id:'SPL',tr:0},1);mode='def';out.splitDef=skillVal({id:'SPL',tr:0},1);mode='atk';
 /* 5. 総攻バフの掛け方「部隊内の姫の数」(係数4% × 姫の数。自身をカウントする/しない) */
 for(const k of [...M.skills.keys()])M.skills.delete(k);for(const k of [...M.cards.keys()])M.cards.delete(k);
 M.skills.set('HI',{name:'姫初',init:1,side:'攻撃・防御',coefBy:'people',tbBy:'hime',tbSelf:1,effs:{total:true},trs:tr(t=>({base:0,coef:0,totalBuff:1,tbCoef:4}))});
 const hc=(no,h,init)=>({no,rarity:'天',side:'攻撃・防御',name:'姫'+no,initName:init,troops:1000,baseStat:1000,growth:0,baseDef:1000,growthDef:0,hime:h});
 M.cards.set('h1',hc(3001,1,'姫初'));M.cards.set('h2',hc(3002,1,''));M.cards.set('h3',hc(3003,0,''));M.cards.set('h4',hc(3004,1,''));
 form={jin:1,slots:['h1','h2','h3','h4'].map(c=>({card:c,tr:0,soldier:'',alloc:'atk',s1:e,s2:e,lim:e}))};
 out.himeSelf=Math.round(calc().buff*1000)/1000;
 M.skills.get('HI').tbSelf=0;out.himeNoSelf=Math.round(calc().buff*1000)/1000;
 mode='def';out.himeDef=Math.round(calc().buff*1000)/1000;mode='atk';
 /* 6. 総攻バフの掛け方「部隊内の対象兵科の数」(兵器兵科を数える。係数5%) */
 M.soldiers.set('sa',{name:'鉄砲足軽',branch:'兵器兵科',atk:31,def:33});M.soldiers.set('sb',{name:'武士',branch:'槍兵科',atk:26,def:27});
 M.skills.set('HI',{name:'姫初',init:1,side:'攻撃・防御',coefBy:'people',tbBy:'branch',tbBranches:['兵器兵科'],tbSelf:1,effs:{total:true},trs:tr(t=>({base:0,coef:0,totalBuff:1,tbCoef:5}))});
 form.slots[0].soldier='sa';form.slots[1].soldier='sa';form.slots[2].soldier='sb';form.slots[3].soldier='sa';
 out.brSelf=Math.round(calc().buff*1000)/1000;M.skills.get('HI').tbSelf=0;out.brNoSelf=Math.round(calc().buff*1000)/1000;
 /* 7. 対象兵種:兵科は選ばず「武士」だけ(自身をカウントしない。自分は鉄砲足軽なので変わらない) */
 M.skills.get('HI').tbBranches=[];M.skills.get('HI').tbSoldiers=['武士'];M.skills.get('HI').tbSelf=1;out.soldOnly=Math.round(calc().buff*1000)/1000;
 M.skills.get('HI').tbBranches=['兵器兵科'];out.soldOr=Math.round(calc().buff*1000)/1000;
 /* 8. 自身のもつ兵種:持ち主(1人目)は鉄砲足軽 → 鉄砲足軽の武将3人(自身を含む) */
 Object.assign(M.skills.get('HI'),{tbBranches:[],tbSoldiers:[],tbOwn:1,tbSelf:1});out.own=Math.round(calc().buff*1000)/1000;
 M.skills.get('HI').tbSelf=0;out.ownNoSelf=Math.round(calc().buff*1000)/1000;
 form.slots[0].soldier='sb';M.skills.get('HI').tbSelf=1;out.ownBushi=Math.round(calc().buff*1000)/1000;form.slots[0].soldier='sa';
 /* 9. 部隊内の剣豪の数(剣豪2人、持ち主は剣豪でない) */
 ['h1','h2','h3','h4'].forEach((c,i)=>M.cards.get(c).kengou=[0,1,1,0][i]);
 Object.assign(M.skills.get('HI'),{tbBy:'kengou',tbSelf:1});out.kengou=Math.round(calc().buff*1000)/1000;
 M.cards.get('h1').kengou=1;out.kengouSelf=Math.round(calc().buff*1000)/1000;M.skills.get('HI').tbSelf=0;out.kengouNoSelf=Math.round(calc().buff*1000)/1000;
 /* 10. 兵数加算(+500):自身の兵数も増やす なし→ほかの3人だけ、あり→4人全員 */
 M.skills.set('TA',{name:'兵数初',init:1,side:'攻撃・防御',coefBy:'people',effs:{troop:true},trs:tr(t=>({base:0,coef:0,troopAdd:500}))});
 M.cards.get('h1').initName='兵数初';out.troopOthers=calc().rows.map(x=>x.troops);
 M.skills.get('TA').effs.troopSelf=true;out.troopAll=calc().rows.map(x=>x.troops);
 /* 11. 兵数加算の対象:姫だけ(h2・h4が姫)、剣豪だけ(h2・h3が剣豪)、姫と剣豪 */
 M.skills.get('TA').effs.troopSelf=false;M.cards.get('h1').kengou=0;['h1','h2','h3','h4'].forEach((c,i)=>{M.cards.get(c).hime=[0,1,0,1][i];M.cards.get(c).kengou=[0,1,1,0][i]});
 M.skills.get('TA').troopTo=['hime'];out.toHime=calc().rows.map(x=>x.troops);
 M.skills.get('TA').troopTo=['kengou'];out.toKengou=calc().rows.map(x=>x.troops);
 M.skills.get('TA').troopTo=['hime','kengou'];out.toBoth=calc().rows.map(x=>x.troops);
 return out});
const want={hisho:8,hcVal:80,drop:[false,false,false,true],sb:[2,2,2,2],buff:1.5,speed:699.2,speedVal:2255.48,speedMuzin:2,costVal:630,costLabel:'630',splitAtk:390,splitDef:440,himeSelf:1.12,himeNoSelf:1.08,himeDef:1.08,brSelf:1.15,brNoSelf:1.1,soldOnly:1.05,soldOr:1.2,own:1.15,ownNoSelf:1.1,ownBushi:1.1,kengou:1.1,kengouSelf:1.15,kengouNoSelf:1.1,troopOthers:[1000,1500,1500,1500],troopAll:[1500,1500,1500,1500],toHime:[1000,1500,1000,1500],toKengou:[1000,1500,1500,1000],toBoth:[1000,1500,1500,1500]};
let ng=0;for(const k in want)if(JSON.stringify(got[k])!==JSON.stringify(want[k])){ng++;console.log('NG',k,'期待',JSON.stringify(want[k]),'結果',JSON.stringify(got[k]))}
if(errs.length){ng++;console.log('ページのエラー',errs)}
console.log(ng?`失敗 ${ng}件`:'すべてOK');await b.close();process.exit(ng?1:0)})();
