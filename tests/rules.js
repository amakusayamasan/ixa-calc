// 部隊内で数えるルールのテスト(飛翔の数・部隊移動速度・重複上限で外れた初期スキル・敵武将の総コスト・追加スキルの攻防の値・姫・剣豪・対象兵科の数の総バフ・兵数加算・倍枠の数)。期待値と違えば失敗する。
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
 /* 12. 倍枠を姫の数で掛ける(倍枠通常1+0.5×姫、倍枠極限1+1×姫)。姫は2人目・4人目。持ち主(1人目)の追加スキル100・極限100 */
 for(const k of [...M.skills.keys()])if(k!=='TA')M.skills.delete(k);
 M.skills.set('MB',{name:'倍初',init:1,side:'攻撃・防御',coefBy:'people',mulBy:'hime',mulSelf:1,effs:{mul:true},trs:tr(t=>({base:0,coef:0,mulNormal:1,mulLimit:1,mulNormalCoef:0.5,mulLimitCoef:1}))});
 M.skills.set('P1',{name:'追100',init:0,side:'攻撃・防御',coefBy:'people',trs:tr(t=>({base:100,coef:0}))});
 M.cards.get('h1').initName='倍初';form.slots[0].s1={id:'P1',tr:0};form.slots[0].lim={id:'P1',tr:0};
 out.mulHime=Math.round(calc().rows[0].sk*100)/100;out.mulHimeFx=skillEffect(0,'s1').match(/<b>([^<]+)/)[1]+'/'+skillEffect(0,'lim').match(/<b>([^<]+)/)[1]+'/'+calc().rows[0].ml.n;
 M.skills.get('MB').mulBy='branch';M.skills.get('MB').mulBranches=['兵器兵科'];out.mulBranch=Math.round(calc().rows[0].sk*100)/100;
 /* 13. 倍枠係数を攻撃と防御で分ける(防御部隊では(防)の係数:通常1、極限2) */
 Object.assign(M.skills.get('MB'),{mulBy:'hime',effs:{mul:true,split:true}});
 M.skills.get('MB').trs.forEach(t=>{t.mulNormalCoefD=1;t.mulLimitCoefD=2;});
 out.mulSplitAtk=Math.round(calc().rows[0].sk*100)/100;mode='def';out.mulSplitDef=Math.round(calc().rows[0].sk*100)/100;mode='atk';
 /* 14. レアリティで増える兵数:覇・天 +2800、傑 +0、それ以外 +2200(兵数加算は外して確かめる) */
 M.skills.get('TA').trs.forEach(t=>t.troopAdd=0);
 ['h1','h2','h3','h4'].forEach((c,i)=>M.cards.get(c).rarity=['覇・天','傑','極','天'][i]);
 out.rarTroops=calc().rows.map(x=>x.troops);
 /* 15. 黎天は「列」「烈」どちらの名前でも特殊効果(兵数+2000)が出る */
 M.skills.set('RE',{name:'黎天烈光',init:0,side:'攻撃・防御',coefBy:'x',xskill:1,trs:[{tr:0,base:0,coef:500}]});
 form.slots[1].s1={id:'RE',tr:0};out.reiTroops=calc().rows[1].troops;
 /* 16. 剣豪は +1600 だけ(覇・天・天・極でも)。傑の剣豪は対象外のまま */
 form.slots[1].s1={id:'',tr:0};['h1','h2','h3','h4'].forEach((c,i)=>{M.cards.get(c).rarity=['覇・天','傑','極','天'][i];M.cards.get(c).kengou=1;});
 out.kengouTroops=calc().rows.map(x=>x.troops);
 /* 17. 係数の掛け方「部隊内の兵科・兵種の数」:持ち主(2人目)の追加スキル、係数100、兵器兵科を数える */
 M.skills.set('CB',{name:'兵科係数',init:0,side:'攻撃・防御',coefBy:'branch',coefBranches:['兵器兵科'],coefSelf:1,trs:[{tr:0,base:10,coef:100}]});
 form.slots[1].s1={id:'CB',tr:0};out.coefBranch=skillVal(form.slots[1].s1,1);
 M.skills.get('CB').coefSelf=0;out.coefBranchNoSelf=skillVal(form.slots[1].s1,1);
 Object.assign(M.skills.get('CB'),{coefBranches:[],coefOwn:1,coefSelf:1});form.slots[1].soldier='sb';out.coefOwn=skillVal(form.slots[1].s1,1);form.slots[1].soldier='sa';
 /* 18. コスト減と兵士攻撃力加算:部隊コスト20(5×4)、部隊長に①武将のコスト分と②5 → コスト減10 → 弓兵科の兵士攻撃力 +0.9×10 */
 for(const k of [...M.skills.keys()])M.skills.delete(k);for(const k of [...M.cards.keys()])M.cards.delete(k);
 M.soldiers.set('yk',{name:'弓騎馬',branch:'弓兵科',atk:27});M.soldiers.set('tk',{name:'鉄砲騎馬',branch:'鉄砲兵科',atk:32});
 M.skills.set('KAI',{name:'怪童',init:1,side:'攻撃',coefBy:'people',effs:{sadd:true,leader:true},saddBranches:['弓兵科'],trs:[{tr:0,base:0,coef:0,soldierAdd:0.9}]});
 M.skills.set('CS',{name:'減自',init:0,side:'攻撃',coefBy:'people',cutBy:'self',effs:{cut:true},trs:[{tr:0,base:0,coef:0}]});
 M.skills.set('CV',{name:'減数',init:0,side:'攻撃',coefBy:'people',cutBy:'value',effs:{cut:true},trs:[{tr:0,base:0,coef:0,costCut:5}]});
 for(let i=0;i<4;i++)M.cards.set('k'+i,{no:5000+i,rarity:'天',side:'攻撃',name:'K'+i,cost:5,initName:i?'なし':'怪童',troops:1000,baseStat:1000,growth:0});
 form={jin:1,slots:[0,1,2,3].map(i=>({card:'k'+i,tr:0,soldier:i==1?'tk':'yk',alloc:'atk',s1:i?e:{id:'CS',tr:0},s2:i?e:{id:'CV',tr:0},lim:e}))};
 out.cut=costCut();out.satk=calc().rows.map(x=>Math.round(x.satk*100)/100);
 M.skills.set('MZ',{name:'無尽2',init:0,side:'攻撃',coefBy:'people',effs:{muzin:true},trs:[{tr:0,base:0,coef:0,muzin:2}]});form.slots[2].s1={id:'MZ',tr:0};out.cutMuzin=costCut().cut;form.slots[2].s1=e;form.slots[0].lim={id:'CS',tr:0};out.cutSelfTwice=costCut().cut;form.slots[0].lim=e;form.slots[0].costUp=true;form.slots[1].costUp=true;out.costUp=[costCut(),calc().rows[0].troops-calc().rows[2].troops];form.slots[0].costUp=false;form.slots[1].costUp=false;
 M.cards.get('k2').name='織田信長';M.cards.get('k3').name='三郎信長';M.cards.get('k3').rarity='傑';const ykOff=calc().rows.map(x=>x.troops);form.tb=['yasuke'];out.yasuke=calc().rows.map((x,i)=>x.troops-ykOff[i]);form.tb=[];
 M.skills.set('TM',{name:'揃え',init:0,side:'防御',coefBy:'people',effs:{tmax:true},trs:[{tr:0,base:80,coef:0}]});mode='def';form.slots[1].s1={id:'TM',tr:0};form.maxTroops=30000;const tmR=calc().rows;out.tmax=[tmR[0].troops,tmR[1].troops];form.maxTroops=100;out.tmaxLow=calc().rows[1].troops===calc().rows[0].troops;form.maxTroops=null;out.tmaxDef=defaultFormationMax().v>0&&calc().rows[1].troops===defaultFormationMax().v;mode='atk';out.tmaxAtk=calc().rows[1].troops===calc().rows[0].troops;form.slots[1].s1=e;
 M.skills.set('LVM',{name:'LV倍',init:1,side:'防御',coefBy:'people',effs:{mul:true},mulBy:'initlv',trs:[{tr:0,base:0,coef:0}]});M.cards.get('k1').initName='LV倍';mode='def';const lvT=cardT(M.cards.get('k1'),0);out.initLv=[slotMul(1,lvT,lvT).l];form.slots[2].tr=2;out.initLv.push(slotMul(1,lvT,lvT).l,slotMul(1,lvT,lvT).n);mode='atk';const lvA=cardT(M.cards.get('k1'),0);out.initLv.push(slotMul(1,lvA,lvA).l);form.slots[2].tr=0;M.cards.get('k1').initName='なし';
 form.slots[0].card='k1';form.slots[1].card='k0';out.satkNotLeader=calc().rows.map(x=>Math.round(x.satk*100)/100);
 return out});
const want={hisho:8,hcVal:80,drop:[false,false,false,true],sb:[2,2,2,2],buff:1.5,speed:699.2,speedVal:2255.48,speedMuzin:2,costVal:630,costLabel:'630',splitAtk:390,splitDef:440,himeSelf:1.12,himeNoSelf:1.08,himeDef:1.08,brSelf:1.15,brNoSelf:1.1,soldOnly:1.05,soldOr:1.2,own:1.15,ownNoSelf:1.1,ownBushi:1.1,kengou:1.1,kengouSelf:1.15,kengouNoSelf:1.1,troopOthers:[2600,3100,3100,3700],troopAll:[3100,3100,3100,3700],toHime:[3200,3100,2600,3700],toKengou:[3200,3100,3100,3200],toBoth:[3200,3100,3100,3700],mulHime:560,mulHimeFx:'200/360/2',mulBranch:730,mulSplitAtk:560,mulSplitDef:900,rarTroops:[3800,1000,2600,3200],reiTroops:3000,kengouTroops:[2600,1000,2600,2600],coefBranch:310,coefBranchNoSelf:210,coefOwn:210,cut:{total:20,cut:10,left:10},cutMuzin:11,cutSelfTwice:10,initLv:[4,4.2,1,1],tmax:[3200,30000],tmaxLow:true,tmaxDef:true,tmaxAtk:true,yasuke:[0,0,960,960],costUp:[{total:21,cut:10.5,left:10.5},200],satk:[36,32,36,36],satkNotLeader:[27,32,27,27]};
let ng=0;for(const k in want)if(JSON.stringify(got[k])!==JSON.stringify(want[k])){ng++;console.log('NG',k,'期待',JSON.stringify(want[k]),'結果',JSON.stringify(got[k]))}
if(errs.length){ng++;console.log('ページのエラー',errs)}
console.log(ng?`失敗 ${ng}件`:'すべてOK');await b.close();process.exit(ng?1:0)})();
