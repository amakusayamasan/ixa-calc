window.__rules=location.search.includes('rules');
// Firebase compat の模擬版(テスト用)
(()=>{const store={};const subs=[];let authCb=null,user=null;
const mode=new URLSearchParams(location.search).get('mode')||'';
const admins=mode.includes('admin')?{'uid-123':mode.includes('noname')?{}:{name:'テスト管理者'}}:{};
if(mode.includes('seeded')){/* 後で埋める */}
const coll=p=>Object.entries(store).filter(([k])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/'));
const fire=()=>subs.forEach(s=>s());
const docRef=p=>({get:async()=>{const v=p.startsWith('admins/')?admins[p.slice(7)]:store[p];if(p.startsWith('admins/')&&(!user||user.uid!==p.slice(7)))throw {code:'permission-denied'};return{exists:!!v,data:()=>v}},
  set:async v=>{if(!user||!admins[user.uid])throw {code:'permission-denied'};if(window.__rules&&p.startsWith('master/'))throw {code:'permission-denied',message:'direct set '+p};store[p]=JSON.parse(JSON.stringify(v));fire()},
  delete:async()=>{if(!user||!admins[user.uid])throw {code:'permission-denied'};if(window.__rules&&p.startsWith('master/'))throw {code:'permission-denied',message:'direct del '+p};delete store[p];fire()},
  onSnapshot:(nx)=>{const run=()=>nx({exists:p in store,data:()=>store[p]});subs.push(run);setTimeout(run,5);return()=>{}},_p:p});
const db={collection:p=>({onSnapshot:nx=>{const run=()=>nx({docs:coll(p).map(([k,v])=>({id:k.split('/').pop(),data:()=>v})),metadata:{fromCache:false}});subs.push(run);setTimeout(run,5);return()=>{}}}),
  doc:docRef,batch:()=>{const ops=[];return{set:(r,v)=>ops.push([r._p,JSON.parse(JSON.stringify(v))]),delete:r=>ops.push([r._p,null]),commit:async()=>{if(!user||!admins[user.uid])throw {code:'permission-denied'};if(window.__rules){const has=p=>ops.some(([q,v])=>q===p&&v!==null);for(const [q,v] of ops){if(q.startsWith('logs/')&&v&&v.by!==user.uid)throw {code:'permission-denied',message:'log by'};
 const m=q.match(/^master\/v2\/([^/]+)\/([^/]+)$/);if(!m)continue;
 if(v!==null){if(v.updatedBy!==user.uid||!v.updatedAt||!has('logs/'+v.logId))throw {code:'permission-denied',message:'rule set '+q}}
 else{const old=store[q];if(!has('logs/del_'+m[1]+'_'+m[2]+'_'+((old&&old.logId)||'noid')))throw {code:'permission-denied',message:'rule del '+q}}}}ops.forEach(([p,v])=>{if(v===null)delete store[p];else store[p]=v});fire()}}}};
const auth={onAuthStateChanged:cb=>{authCb=cb;setTimeout(()=>cb(user),5)},signInWithPopup:async()=>{user={uid:'uid-123',displayName:'山本',email:'x'};authCb(user)},signOut:async()=>{user=null;authCb(null)}};
const f=()=>auth;f.GoogleAuthProvider=function(){};
window.firebase={initializeApp:()=>{},firestore:()=>db,auth:f};
window.__store=store;})();
