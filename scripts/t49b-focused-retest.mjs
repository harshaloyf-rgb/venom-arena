#!/usr/bin/env node
/** Focused retest: (1) settings Co-Leader gate, (2) outsider respond gate, (3) disband-mid-war orphan war */
const BASE = 'http://localhost:3000';
function jar() {
  let c = '';
  return {
    get: () => c,
    set: (res) => {
      const sc = res.headers.getSetCookie?.() || [];
      for (const x of sc) {
        const kv = x.split(';')[0];
        if (kv.startsWith('va_session=')) c = kv;
      }
    },
  };
}
async function api(s, m, p, b) { const h={'Content-Type':'application/json'}; if(s?.get()) h.Cookie=s.get(); const r=await fetch(BASE+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined}); if(s) s.set(r); let j=null; try{j=await r.json()}catch{} return {status:r.status,json:j}; }
async function guest(){ const s=jar(); const r=await api(s,'POST','/api/auth/guest',{country:'IN'}); if(r.status!==200) throw new Error('guest failed '+JSON.stringify(r.json)); return {session:s,tag:r.json.player.userTag}; }
const admin=jar();
{ const r=await api(admin,'POST','/api/auth/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}); if(r.status!==200) throw new Error('admin fail (set ADMIN_EMAIL/ADMIN_PASSWORD env)'); }

const A=await guest(), B=await guest(), D=await guest();
console.log('A='+A.tag+' B='+B.tag+' D='+D.tag);

// A founds clan
console.log('create:', (await api(A.session,'POST','/api/clans/create',{tag:'RT1',name:'Retest Clan'})).status);
// B joins, A accepts
await api(B.session,'POST','/api/clans/join',{tag:'RT1'});
let r=await api(A.session,'GET','/api/clans/join-requests');
const reqB=r.json.incoming.find(x=>x.userTag===B.tag);
console.log('accept B:', (await api(A.session,'POST','/api/clans/join-requests/respond',{requestId:reqB.id,action:'accept'})).status);
// promote B to Co-Leader
console.log('promote B:', (await api(A.session,'POST','/api/clans/role',{targetTag:B.tag,action:'promote'})).status);

// ── RETEST 1: Co-Leader settings edit (expect 403)
r=await api(B.session,'POST','/api/clans/settings',{tag:'RT1',description:'coleader tried'});
console.log('RETEST settings-by-coleader:', r.status, JSON.stringify(r.json), r.status===401?'<< 401 SESSION ISSUE':'');

// ── RETEST 2: outsider responds to pending request (expect 403)
const C=await guest();
await api(C.session,'POST','/api/clans/join',{tag:'RT1'});
r=await api(A.session,'GET','/api/clans/join-requests');
const reqC=r.json.incoming.find(x=>x.userTag===C.tag);
r=await api(D.session,'POST','/api/clans/join-requests/respond',{requestId:reqC.id,action:'accept'});
console.log('RETEST outsider-respond:', r.status, JSON.stringify(r.json));

// ── RETEST 3: disband mid-war orphan check
// fund both treasuries via members depositing
await api(admin,'POST','/api/admin/modify-chips',{userTag:A.tag,amount:5000});
await api(admin,'POST','/api/admin/modify-chips',{userTag:D.tag,amount:5000});
console.log('D founds WR3B:', (await api(D.session,'POST','/api/clans/create',{tag:'WR3B',name:'War B'})).status);
// D needs to be in WR3B to deposit — D is leader (create makes leader). Deposit needs membership: D.clanTag=WR3B ✓
console.log('D deposit 3000:', JSON.stringify((await api(D.session,'POST','/api/clans/deposit',{tag:'WR3B',amount:3000})).json));
console.log('A deposit 3000:', JSON.stringify((await api(A.session,'POST','/api/clans/deposit',{tag:'RT1',amount:3000})).json));
r=await api(A.session,'POST','/api/clans/war/declare',{tag:'RT1',targetTag:'WR3B',wager:1000});
console.log('declare war:', r.status, JSON.stringify(r.json));
r=await api(A.session,'GET','/api/clans/war?tag=RT1');
console.log('war active before disband:', r.status, JSON.stringify(r.json.war)?.slice(0,150));
// disband WR3B mid-war (D is its leader)
console.log('disband WR3B:', (await api(D.session,'POST','/api/clans/disband')).status);
r=await api(A.session,'GET','/api/clans/war?tag=RT1');
console.log('war after WR3B disbanded:', r.status, JSON.stringify(r.json));
console.log('>> ORPHAN WAR CONFIRMED' , r.json?.war !== null && r.json?.war !== undefined ? 'YES — war still active, WR3B escrow gone with clan' : 'no');
