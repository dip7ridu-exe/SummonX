const RARITIES=[
 {name:'Uncommon',min:0,max:399,color:'uncommon'},
 {name:'Rare',min:400,max:649,color:'rare'},
 {name:'Ultra Rare',min:650,max:829,color:'ultra-rare'},
 {name:'Legendary',min:830,max:939,color:'legendary'},
 {name:'Mythic',min:940,max:999,color:'mythic'}
];
function safeJSON(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const parsed=JSON.parse(raw);
    return parsed ?? fallback;
  }catch(err){
    console.warn(`[SummonX] localStorage inválido em ${key}; restaurando padrão.`,err);
    localStorage.removeItem(key);
    return fallback;
  }
}
const gs={
 coins:Number(localStorage.getItem('dc'))||0,
 coll:safeJSON('dcoll',[]),
 roll:[],savesLeft:0,rolling:false,
 deck:safeJSON('summonxArenaDeck',[])
};
if(!Array.isArray(gs.coll))gs.coll=[];
if(!Array.isArray(gs.deck))gs.deck=[];
let battle=null, lastFrame=0, raf=0;

function save(){
 localStorage.setItem('dc',gs.coins);
 localStorage.setItem('dcoll',JSON.stringify(gs.coll));
 localStorage.setItem('summonxArenaDeck',JSON.stringify(gs.deck));
 document.getElementById('coins').textContent=gs.coins;
}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function hash(str){let h=2166136261;for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h)}
function getRarity(card){
 if(card.rarity)return card.rarity;
 const h=hash(card.id||card.name)%1000;
 return RARITIES.find(r=>h>=r.min&&h<=r.max)?.name||'Rare';
}
function rarityClass(r){return slug(r)}
function enrich(card){
 const h=hash(card.id||card.name);
 const rarity=getRarity(card);
 const idx=RARITIES.findIndex(x=>x.name===rarity);
 return {...card,rarity,
  cost:card.cost||clamp(2+(h%6),2,7),
  hp:card.hp||Math.round(650+idx*165+(h%270)),
  damage:card.damage||Math.round(65+idx*23+(h%55)),
  speed:card.speed||(.027+(h%16)/1000),
  range:card.range||((h%4===0)?11:5.2),
  attackSpeed:card.attackSpeed||(0.7+(h%9)/10),
  power:card.power||Math.round(500+idx*210+(h%360))
 };
}
gs.coll=gs.coll.map(enrich);
gs.deck=gs.deck.map(id=>String(id)).filter(id=>gs.coll.some(c=>String(c.id)===id)).slice(0,8);
save();

document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));
function showSection(id){
 document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id==='sec-'+id));
 document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===id));
 if(id==='collection')renderCollection();
 if(id==='arena')renderDeckBuilder();
 window.scrollTo({top:0,behavior:'smooth'});
}

async function fetchCharPage(pg,n){
 const q=`query($p:Int){Page(page:$p,perPage:${n*3}){characters{id name{full}image{large}favourites media(sort:POPULARITY_DESC,perPage:1){nodes{title{romaji english}}}}}}`;
 const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:q,variables:{p:pg}})});
 if(r.status===429){await wait(1500);throw new Error('rate-limit')}
 if(!r.ok)throw new Error('anilist');
 const d=await r.json(); return d?.data?.Page?.characters||[];
}
async function fetchChars(n=5){
 const out=[],seen=new Set();
 for(let tries=0;out.length<n&&tries<12;tries++){
  try{
   const pg=Math.floor(Math.random()*450)+1;
   const rows=await fetchCharPage(pg,n);
   rows.sort(()=>Math.random()-.5);
   for(const c of rows){
    if(out.length>=n)break;
    if(!c?.image?.large||!c?.name?.full||seen.has(c.id))continue;
    seen.add(c.id);
    out.push(enrich({id:c.id,name:c.name.full,image:c.image.large,anime:c.media?.nodes?.[0]?.title?.english||c.media?.nodes?.[0]?.title?.romaji||'Anime'}));
   }
  }catch(e){}
 }
 if(out.length<n){
  for(let i=0;i<10&&out.length<n;i++){
   try{
    const r=await fetch('https://api.jikan.moe/v4/random/characters');
    if(r.status===429){await wait(1100);continue}
    const d=await r.json(),c=d?.data,img=c?.images?.jpg?.image_url;
    if(c?.name&&img&&!seen.has('j'+c.mal_id)){
     seen.add('j'+c.mal_id);
     out.push(enrich({id:'jikan-'+c.mal_id,name:c.name,image:img,anime:'Anime'}));
    }
    await wait(350);
   }catch(e){}
  }
 }
 return out.slice(0,n);
}
async function rollCards(){
 if(gs.rolling)return;
 gs.rolling=true;gs.savesLeft=2;gs.roll=[];
 const btn=document.getElementById('rollBtn'),info=document.getElementById('rollInfo');
 btn.disabled=true;btn.innerHTML='✦ ABRINDO PORTAL...';
 info.textContent='Buscando personagens...';
 document.getElementById('rollResults').innerHTML=Array(5).fill('<div class="game-card skeleton" style="height:290px;opacity:.35"></div>').join('');
 try{
  gs.roll=await fetchChars(5);
  if(gs.roll.length<5)throw new Error();
  info.textContent='Escolha até 2 cartas.';
  renderRoll();
 }catch(e){
  info.textContent='Não foi possível carregar 5 personagens agora. Tente novamente.';
  document.getElementById('rollResults').innerHTML='';
 }finally{
  gs.rolling=false;btn.disabled=false;btn.innerHTML='<span>✦</span> ROLAR 5 CARTAS';
  updateRollSaveText();
 }
}
function cardHTML(c,{saveButton=false}={}){
 c=enrich(c); const owned=gs.coll.some(x=>String(x.id)===String(c.id));
 return `<article class="game-card">
  ${saveButton?`<button class="save-card ${owned?'saved':''}" onclick="event.stopPropagation();toggleSave('${c.id}')">${owned?'✓':'＋'}</button>`:''}
  <div class="image"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy"></div><div class="shade"></div>
  <div class="info"><h3>${esc(c.name)}</h3><p>${esc(c.anime||'Universo desconhecido')}</p><div class="badges"><span class="rarity ${rarityClass(c.rarity)}">${c.rarity}</span><span class="cost">✦ ${c.cost}</span></div></div>
 </article>`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderRoll(){document.getElementById('rollResults').innerHTML=gs.roll.map(c=>cardHTML(c,{saveButton:true})).join('')}
function updateRollSaveText(){document.getElementById('rollSaves').textContent=gs.roll.length?`Escolhas restantes: ${gs.savesLeft}`:''}
function toggleSave(id){
 const c=gs.roll.find(x=>String(x.id)===String(id));if(!c)return;
 const ix=gs.coll.findIndex(x=>String(x.id)===String(id));
 if(ix>=0){gs.coll.splice(ix,1);gs.deck=gs.deck.filter(x=>String(x)!==String(id));gs.savesLeft=Math.min(2,gs.savesLeft+1);toast('Carta removida da coleção.')}
 else{if(gs.savesLeft<=0)return toast('Você já guardou 2 cartas desta rolagem.');gs.coll.unshift(enrich(c));gs.savesLeft--;toast(`${c.name} entrou para sua coleção!`)}
 save();renderRoll();updateRollSaveText();
}
function renderCollection(){
 const q=document.getElementById('searchInput').value.toLowerCase();
 const rf=document.getElementById('rarityFilter').value,sort=document.getElementById('sortFilter').value;
 let arr=gs.coll.filter(c=>(!q||`${c.name} ${c.anime}`.toLowerCase().includes(q))&&(!rf||c.rarity===rf));
 if(sort==='power')arr.sort((a,b)=>b.power-a.power);else if(sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name));
 document.getElementById('collectionCount').textContent=gs.coll.length;
 document.getElementById('collectionGrid').innerHTML=arr.length?arr.map(c=>cardHTML(c)).join(''):'<p style="color:#82788f">Nenhuma carta encontrada.</p>';
}
['searchInput','rarityFilter','sortFilter'].forEach(id=>document.getElementById(id).addEventListener(id==='searchInput'?'input':'change',renderCollection));

function renderDeckBuilder(){
 gs.deck=gs.deck.filter(id=>gs.coll.some(c=>String(c.id)===String(id))).slice(0,8);save();
 const cards=gs.deck.map(id=>gs.coll.find(c=>String(c.id)===String(id))).filter(Boolean);
 document.getElementById('deckCounter').textContent=`${cards.length}/8`;
 document.getElementById('deckSlots').innerHTML=Array.from({length:8},(_,i)=>cards[i]?`<div class="deck-slot"><img src="${esc(cards[i].image)}"><b>${esc(cards[i].name)}</b></div>`:`<div class="deck-slot">＋</div>`).join('');
 document.getElementById('avgCost').textContent=cards.length?(cards.reduce((s,c)=>s+c.cost,0)/cards.length).toFixed(1):'—';
 document.getElementById('deckPower').textContent=cards.reduce((s,c)=>s+c.power,0);
 document.getElementById('startArenaBtn').disabled=cards.length<8;
 document.getElementById('arenaCollection').innerHTML=gs.coll.length?gs.coll.map(c=>`<div class="mini-card ${gs.deck.includes(String(c.id))?'in-deck':''}" onclick="toggleDeck('${c.id}')"><img src="${esc(c.image)}"><div><b>${esc(c.name)}</b><span>✦ ${c.cost} · ${c.power}</span></div></div>`).join(''):'<p>Role cartas primeiro.</p>';
}
function toggleDeck(id){
 id=String(id);
 if(gs.deck.includes(id))gs.deck=gs.deck.filter(x=>x!==id);
 else if(gs.deck.length<8)gs.deck.push(id);else return toast('O deck já tem 8 cartas.');
 save();renderDeckBuilder();
}
async function buyPack(price,minR){
 if(gs.coins<price)return toast('Moedas insuficientes.');
 const btn=[...document.querySelectorAll('.pack button')].find(b=>b.getAttribute('onclick')?.includes(`${price},`));
 if(btn)btn.disabled=true;
 toast('Abrindo pacote...');
 let pool=await fetchChars(8);
 const min=RARITIES.findIndex(r=>r.name===minR);
 pool=pool.map(enrich).map(c=>{
  let ri=RARITIES.findIndex(r=>r.name===c.rarity);if(ri<min)c.rarity=RARITIES[min].name;return enrich(c)
 }).slice(0,3);
 if(pool.length===3){gs.coins-=price;pool.forEach(c=>{if(!gs.coll.some(x=>String(x.id)===String(c.id)))gs.coll.unshift(c)});save();showPackModal(pool)}
 else toast('Falha ao carregar o pacote. Tente de novo.');
 if(btn)btn.disabled=false;
}
function showPackModal(cards){
 document.getElementById('modalCard').innerHTML=`<div class="eyebrow">PACOTE ABERTO</div><h2>Novas invocações</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${cards.map(c=>`<img src="${esc(c.image)}" style="width:100%;aspect-ratio:.75;object-fit:cover;border-radius:10px">`).join('')}</div><div class="modal-actions"><button class="primary" onclick="closeModal()">CONTINUAR</button></div>`;
 document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show')}

function openArena(){
 if(gs.deck.length<8)return toast('Monte um deck com 8 cartas.');
 const deck=gs.deck.map(id=>enrich(gs.coll.find(c=>String(c.id)===String(id)))).filter(Boolean);
 if(deck.length<8)return toast('Alguma carta do deck não existe mais.');
 document.getElementById('battleScreen').classList.add('active');
 document.getElementById('battleScreen').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 initBattle(deck);
}
function leaveArena(){
 if(battle&&!battle.over&&!confirm('Sair da batalha?'))return;
 cancelAnimationFrame(raf);battle=null;document.getElementById('battleScreen').classList.remove('active');document.body.style.overflow='';clearBattleDom();
}
function clearBattleDom(){['unitLayer','fxLayer','towerLayer','battleHand','nextCard'].forEach(id=>document.getElementById(id).innerHTML='')}

function initBattle(deck){
 clearBattleDom();lastFrame=performance.now();
 const shuffled=[...deck].sort(()=>Math.random()-.5), botDeck=[...deck].sort(()=>Math.random()-.5).map(c=>({...c,power:Math.round(c.power*.94)}));
 battle={time:180,energy:5,botEnergy:5,over:false,double:false,units:[],towers:[],playerQueue:shuffled,botQueue:botDeck,hand:[],botHand:[],crowns:{player:0,enemy:0},lastBot:0};
 for(let i=0;i<4;i++){battle.hand.push(battle.playerQueue.shift());battle.botHand.push(battle.botQueue.shift())}
 const defs=[
  ['enemy-left','enemy','princess',26,18,1700],['enemy-right','enemy','princess',74,18,1700],['enemy-king','enemy','king',50,8,2800],
  ['player-left','player','princess',26,82,1700],['player-right','player','princess',74,82,1700],['player-king','player','king',50,92,2800]
 ];
 defs.forEach(d=>spawnTower(...d));renderHand();renderEnergy();banner('BATALHA!');
 setTimeout(()=>{if(battle)battle.started=true},800);
 raf=requestAnimationFrame(loop);
}
function spawnTower(id,side,type,x,y,hp){
 const t={id,side,type,x,y,hp,maxHp:hp,range:type==='king'?18:16,damage:type==='king'?105:82,cool:0,alive:true};battle.towers.push(t);
 const el=document.createElement('div');el.id=id;el.className=`tower ${side} ${type==='king'?'king':''}`;el.style.left=x+'%';el.style.top=y+'%';el.innerHTML=`<span class="hptext">${hp}</span><span class="icon">${type==='king'?'♛':'♜'}</span><span class="hpbar"><i></i></span>`;document.getElementById('towerLayer').appendChild(el);
}
function renderHand(){
 const h=document.getElementById('battleHand');h.innerHTML='';
 battle.hand.forEach((c,i)=>{
  const el=document.createElement('div');el.className='hand-card';el.dataset.index=i;
  el.innerHTML=`<img src="${esc(c.image)}"><span class="hand-shade"></span><span class="hand-cost">${c.cost}</span><b>${esc(c.name.split(' ')[0])}</b>`;
  const start=e=>beginDrag(e,i);el.addEventListener('pointerdown',start);h.appendChild(el);
 });
 const n=battle.playerQueue[0];document.getElementById('nextCard').innerHTML=n?`<img src="${esc(n.image)}">`:'';
 updateHandDisabled();
}
function updateHandDisabled(){if(!battle)return;document.querySelectorAll('.hand-card').forEach((el,i)=>el.classList.toggle('disabled',battle.hand[i]?.cost>battle.energy))}
let drag=null;
function beginDrag(e,index){
 if(!battle||battle.over)return;const c=battle.hand[index];if(!c||c.cost>battle.energy)return toast('Estamina insuficiente.');
 drag={index,card:c};document.getElementById('deployHint').classList.add('show');
 const field=document.getElementById('arenaField');
 const move=ev=>{}; const up=ev=>{
  window.removeEventListener('pointerup',up);document.getElementById('deployHint').classList.remove('show');
  const r=field.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*100,y=(ev.clientY-r.top)/r.height*100;
  if(x>=0&&x<=100&&y>=57&&y<=99)playCard(index,x,y);else toast('Coloque a carta na sua metade da arena.');
  drag=null;
 };window.addEventListener('pointerup',up,{once:true});
}
function playCard(index,x,y){
 const c=battle.hand[index];if(!c||battle.energy<c.cost)return;
 battle.energy-=c.cost;spawnUnit(c,'player',x,y);
 battle.hand.splice(index,1);const next=battle.playerQueue.shift();if(next)battle.hand.push(next);battle.playerQueue.push(c);
 renderHand();renderEnergy();
}
function botPlay(){
 if(!battle.botHand.length)return;
 const viable=battle.botHand.map((c,i)=>({c,i})).filter(o=>o.c.cost<=battle.botEnergy);if(!viable.length)return;
 viable.sort((a,b)=>b.c.power-a.c.power);const {c,i}=viable[Math.random()<.6?0:Math.floor(Math.random()*viable.length)];
 battle.botEnergy-=c.cost;const x=Math.random()<.5?20+Math.random()*16:64+Math.random()*16;spawnUnit(c,'enemy',x,10+Math.random()*22);
 battle.botHand.splice(i,1);const next=battle.botQueue.shift();if(next)battle.botHand.push(next);battle.botQueue.push(c);
}
function spawnUnit(card,side,x,y){
 const u={id:'u'+Date.now()+Math.random(),side,card,x,y,hp:card.hp,maxHp:card.hp,damage:card.damage,range:card.range,speed:card.speed,attackSpeed:card.attackSpeed,cool:.25,alive:true,target:null};
 battle.units.push(u);
 const fx=document.createElement('div');fx.className='spawn-ring';fx.style.left=x+'%';fx.style.top=y+'%';document.getElementById('fxLayer').appendChild(fx);setTimeout(()=>fx.remove(),650);
 const el=document.createElement('div');el.id=u.id;el.className=`unit ${side}`;el.style.left=x+'%';el.style.top=y+'%';el.innerHTML=`<div class="u-hp"><i></i></div><img src="${esc(card.image)}" alt="">`;document.getElementById('unitLayer').appendChild(el);
}
function dist(a,b){const dx=(a.x-b.x)*.52,dy=a.y-b.y;return Math.hypot(dx,dy)}
function findTarget(u){
 let candidates=battle.units.filter(v=>v.alive&&v.side!==u.side&&dist(u,v)<u.range+9);
 if(candidates.length)return candidates.sort((a,b)=>dist(u,a)-dist(u,b))[0];
 candidates=battle.towers.filter(t=>t.alive&&t.side!==u.side);
 // focus nearest lane tower; king remains targetable but farther
 return candidates.sort((a,b)=>dist(u,a)-dist(u,b))[0]||null;
}
function updateUnit(u,dt){
 if(!u.alive)return;u.cool-=dt;
 if(!u.target||!u.target.alive)u.target=findTarget(u);
 const t=u.target;if(!t)return;
 const d=dist(u,t);
 if(d<=u.range){
  if(u.cool<=0){u.cool=u.attackSpeed;damageTarget(u,t,u.damage);animateAttack(u)}
 }else{
  const dx=t.x-u.x,dy=t.y-u.y,mag=Math.hypot(dx*.52,dy)||1;
  let vx=(dx*.52/mag)*u.speed*dt*60,vy=(dy/mag)*u.speed*dt*60;
  // bridge guidance near river
  const crossing=(u.side==='player'&&u.y>47&&t.y<57)||(u.side==='enemy'&&u.y<57&&t.y>47);
  if(crossing&&u.y>42&&u.y<62){const bridgeX=u.x<50?23:77;u.x+=(bridgeX-u.x)*.025*dt*60}
  u.x+=vx;u.y+=vy;
  const el=document.getElementById(u.id);if(el){el.style.left=u.x+'%';el.style.top=u.y+'%'}
 }
}
function damageTarget(attacker,target,dmg){
 target.hp=Math.max(0,target.hp-dmg);
 hitFx(target.x,target.y,Math.round(dmg));
 if(target.id?.startsWith('u')){const el=document.getElementById(target.id);if(el)el.querySelector('.u-hp i').style.width=(target.hp/target.maxHp*100)+'%'}
 else updateTower(target);
 if(target.hp<=0){target.alive=false;if(target.id?.startsWith('u')){document.getElementById(target.id)?.remove()}
  else destroyTower(target,attacker.side)}
}
function animateAttack(u){const el=document.getElementById(u.id);if(el){el.classList.add('attacking');setTimeout(()=>el.classList.remove('attacking'),240)}}
function hitFx(x,y,n){const e=document.createElement('div');e.className='hit-fx';e.style.left=x+'%';e.style.top=y+'%';e.textContent='-'+n;document.getElementById('fxLayer').appendChild(e);setTimeout(()=>e.remove(),750)}
function updateTower(t){
 const el=document.getElementById(t.id);if(!el)return;el.querySelector('.hptext').textContent=Math.ceil(t.hp);el.querySelector('.hpbar i').style.width=(t.hp/t.maxHp*100)+'%';
}
function destroyTower(t,killer){
 document.getElementById(t.id)?.classList.add('dead');document.getElementById(t.id)?.remove();
 if(t.type==='king'){battle.crowns[killer]+=3;finishBattle(killer)}
 else{battle.crowns[killer]++;document.getElementById(killer==='player'?'playerCrowns':'enemyCrowns').textContent=battle.crowns[killer];banner('TORRE DESTRUÍDA')}
}
function updateTowers(dt){
 battle.towers.forEach(t=>{
  if(!t.alive)return;t.cool-=dt;
  const enemies=battle.units.filter(u=>u.alive&&u.side!==t.side&&dist(t,u)<=t.range).sort((a,b)=>dist(t,a)-dist(t,b));
  if(enemies[0]&&t.cool<=0){t.cool=.9;damageTarget(t,enemies[0],t.damage)}
 });
}
function renderEnergy(){
 if(!battle)return;document.getElementById('energyText').textContent=`${battle.energy.toFixed(1)}/10`;document.getElementById('energyFill').style.width=(battle.energy*10)+'%';updateHandDisabled();
}
function loop(now){
 if(!battle||battle.over)return;const dt=Math.min(.04,(now-lastFrame)/1000);lastFrame=now;
 if(battle.started){
  battle.time-=dt;const rate=battle.time<=60?1.45:.72;battle.energy=clamp(battle.energy+dt*rate,0,10);battle.botEnergy=clamp(battle.botEnergy+dt*rate,0,10);
  if(battle.time<=60&&!battle.double){battle.double=true;banner('ESTAMINA ×2')}
  battle.lastBot+=dt;if(battle.lastBot>1.35+Math.random()*1.0){battle.lastBot=0;botPlay()}
  battle.units.forEach(u=>updateUnit(u,dt));updateTowers(dt);battle.units=battle.units.filter(u=>u.alive);
  if(battle.time<=0)timeUp();
 }
 const min=Math.max(0,Math.floor(battle.time/60)),sec=Math.max(0,Math.floor(battle.time%60));document.getElementById('battleTimer').textContent=`${min}:${String(sec).padStart(2,'0')}`;
 renderEnergy();raf=requestAnimationFrame(loop);
}
function timeUp(){
 const pHp=battle.towers.filter(t=>t.alive&&t.side==='player').reduce((s,t)=>s+t.hp,0),eHp=battle.towers.filter(t=>t.alive&&t.side==='enemy').reduce((s,t)=>s+t.hp,0);
 if(battle.crowns.player!==battle.crowns.enemy)finishBattle(battle.crowns.player>battle.crowns.enemy?'player':'enemy');
 else if(pHp!==eHp)finishBattle(eHp<pHp?'player':'enemy');else finishBattle('draw');
}
function finishBattle(winner){
 if(!battle||battle.over)return;battle.over=true;cancelAnimationFrame(raf);
 let title='EMPATE',desc='As torres resistiram.';
 if(winner==='player'){title='VITÓRIA';const gain=80+Math.floor(Math.random()*61);gs.coins+=gain;save();desc=`Você conquistou a arena e recebeu ◈ ${gain}.`}
 if(winner==='enemy'){title='DERROTA';desc='A torre principal caiu. Ajuste seu deck e tente novamente.'}
 banner(title);
 setTimeout(()=>{document.getElementById('modalCard').innerHTML=`<div class="eyebrow">RESULTADO DA ARENA</div><h2>${title}</h2><p>${desc}</p><div class="modal-actions"><button class="secondary" onclick="closeModal();leaveArena()">SAIR</button><button class="primary" onclick="closeModal();initBattle(gs.deck.map(id=>gs.coll.find(c=>String(c.id)===String(id))).filter(Boolean))">REVANCHE</button></div>`;document.getElementById('modal').classList.add('show')},900);
}
function banner(txt){const e=document.getElementById('battleBanner');e.textContent=txt;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function toast(msg){const e=document.getElementById('toast');e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2300)}

renderCollection();renderDeckBuilder();save();
