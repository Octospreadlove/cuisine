'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function app(stored){
 const data=new Map(stored?[['atable.v1',JSON.stringify(stored)]]:[]);
 const node={addEventListener(){},classList:{add(){},remove(){}},querySelector(){return node},querySelectorAll(){return []},setAttribute(){},textContent:'',innerHTML:''};
 const ctx=vm.createContext({console,structuredClone,crypto:webcrypto,Date,Intl,setTimeout(){},clearTimeout(){},confirm:()=>true,window:{},document:{addEventListener(){},querySelector(){return node},querySelectorAll(){return []}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});
 vm.runInContext(scripts[0],ctx);
 const main=scripts[1].replace(/ensureBase\(\);save\(\);render\(\);tab\('week'\);if\(storageError\)[\s\S]*$/,'');
 vm.runInContext(main,ctx);
 return {run:s=>vm.runInContext(s,ctx),data};
}
const plain=v=>JSON.parse(JSON.stringify(v));
let checks=0;
function check(value,msg){assert.ok(value,msg);checks++;}
let a=app(); const seed=plain(a.run('window.SEED'));
const report={seed:{batch:seed.recipes.filter(r=>r.category<3).length,pleasure:seed.recipes.filter(r=>r.category===4).length,bonus:seed.recipes.filter(r=>r.category===3).map(r=>r.id)},tests:[]};
const results=plain(a.run('('+function(){
 const counts=Object.fromEntries(state.recipes.map(r=>[r.id,0])),firstFive=[],fallbacks={sauce:0,base:0};
 prepareDrawWeek();ensureBase();
 for(let n=0;n<1000;n++){
  const old=[...state.week];drawFallback=false;
  const batch=drawBatch([],old),pleasure=pick(4,old);
  state.week=batch.concat(pleasure?[pleasure]:[]);rememberDraw(state.week);
  if(n<5)firstFive.push(batch);
  for(const id of state.week)counts[id]++;
  if(new Set(batch.map(id=>recipeTags(recipe(id)).sauce)).size<3)fallbacks.sauce++;
  if(new Set(batch.map(id=>recipeTags(recipe(id)).base)).size<3)fallbacks.base++;
  if(new Set(state.week).size!==state.week.length||batch.length!==3||state.week.filter(id=>recipe(id).category===4).length!==1)throw Error('slot or duplicate regression');
 }
 return {counts,firstFive,fallbacks,drawSequence:state.drawSequence};
}+')()'));
check(new Set(results.firstFive.flat()).size===15,'five batch draws without repeats');
const batchCounts=seed.recipes.filter(r=>r.category<3).map(r=>results.counts[r.id]);
const pleasureCounts=seed.recipes.filter(r=>r.category===4).map(r=>results.counts[r.id]);
check(batchCounts.every(n=>n>0)&&pleasureCounts.every(n=>n>0),'every intended recipe covered');
check(Math.max(...batchCounts)-Math.min(...batchCounts)<=2,'fair batch empirical count spread <=2');
check(Math.max(...pleasureCounts)-Math.min(...pleasureCounts)<=1,'fair pleasure empirical count spread <=1');
report.simulation1000=results;report.distribution={batchMin:Math.min(...batchCounts),batchMax:Math.max(...batchCounts),pleasureMin:Math.min(...pleasureCounts),pleasureMax:Math.max(...pleasureCounts)};
report.tests.push('1000 draws, intended slots, complete coverage, near-equal distribution, first 15 batch choices distinct');
for(const mode of ['riz','pates']){
 a=app();a.run('state.baseMode='+JSON.stringify(mode));
 const modeResult=plain(a.run('('+function(){
 ensureBase();prepareDrawWeek();
 const eligible=state.recipes.filter(r=>r.category<3&&batchOptions(r).length).map(r=>r.id),seen=new Set();
 for(let n=0;n<1000;n++){
  const batch=drawBatch([],state.week);state.week=batch;rememberDraw(batch);
  if(new Set(batch).size!==batch.length)throw Error('duplicates');
  for(const id of batch){if(recipeTags(recipe(id)).base!==state.baseMode)throw Error('mode violation');seen.add(id);}
 }
 return {eligible,seen:[...seen]};
 }+')()'));
 check(modeResult.eligible.every(id=>modeResult.seen.includes(id)),'all eligible mode recipes covered');
 check(modeResult.seen.every(id=>modeResult.eligible.includes(id)),'no ineligible mode recipes');
 report[mode]=modeResult;
}
report.tests.push('1000 riz + 1000 pates draws, mode completeness and exclusivity');
a=app();const prior=seed.recipes.filter(r=>r.category<3).slice(0,3).map(r=>r.id);
a.run('state.previous='+JSON.stringify(prior)+';ensureBase()');
for(let n=0;n<30;n++){const ids=plain(a.run('drawBatch()'));check(ids.every(id=>!prior.includes(id)),'previous excluded when alternatives exist');}
check(a.run('state.recipes=state.recipes.filter(r=>state.previous.includes(r.id));drawFallback=false;drawBatch().length===3&&drawFallback'),'previous fallback fills three');
check(a.run('state.recipes=state.recipes.slice(0,1);drawBatch().length===1'),'small pool terminates without duplicates');
a.run('state.recipes=[]');check(a.run('drawBatch().length===0&&pick(4)==null'),'empty pools safe');
report.tests.push('previous exclusion, previous fallback, one-recipe and zero-recipe pools');
a=app();
const fixture=plain(a.run('('+function(){
 const x=fresh();delete x.drawStatsRevision;delete x.drawSequence;delete x.drawStats;
 x.recipes=x.recipes.filter(r=>r.id!=='paul_pates_pesto_rosso');x.pestoRossoRevision=0;
 x.recipes[0].personalNotes='ma note';x.recipes[0].name='Ma bolo à moi';x.recipes[0].ingredients[0].qty=345;
 x.recipes.push({...structuredClone(x.recipes[0]),id:'custom_bonus',category:3,name:'Mon bonus'});
 x.ingredients.pates.price=.77;x.ingredients.pates.priceMax=1.4;x.ingredients.pates.brand='Perso';
 x.stock={pates:133};x.checked={pates:true};x.extras=[{id:'pates',key:'extra_pates',qty:50}];
 x.week=['paul_bolo','paul_carbonara','paul_tikka','pleasure_burger','custom_bonus'];
 x.previous=['paul_butter','pleasure_croque'];x.menuWeek='2026-11-16';x.drawHistory={'2026-11-09':x.previous,'2026-11-16':x.week};
 x.favorites=['paul_bolo'];x.ingredientFavorites=['pates'];x.baseMode='pates';x.household=2;
 x.basePlan={week:weekStamp(),base:'pates',overrides:{paul_tikka:'riz'}};x.pestoChoices={paul_pesto:'cat_pesto_rosso'};
 x.plannedAt='2026-11-20T19:00:00Z';return x;
}+')()'));
a=app(fixture);
const migrated=plain(a.run('state'));
check(migrated.recipes.some(r=>r.id==='paul_pates_pesto_rosso'),'pesto additive migration existing users');
for(const key of ['week','previous','stock','checked','extras','favorites','ingredientFavorites','drawHistory','basePlan','baseMode','household','pestoChoices','plannedAt']){assert.deepEqual(migrated[key],fixture[key],'migration preserves '+key);checks++;}
check(JSON.stringify(migrated.ingredients.pates)===JSON.stringify(plain(a.run('validate('+JSON.stringify(fixture)+').ingredients.pates'))),'user ingredient price brand preserved');
for(const r of fixture.recipes){const actual=migrated.recipes.find(x=>x.id===r.id);const expected=plain(a.run('validate('+JSON.stringify(fixture)+').recipes.find(r=>r.id==='+JSON.stringify(r.id)+')'));assert.deepEqual(actual,expected);checks++;}
check(a.run('batchOptions(recipe("paul_pates_pesto_rosso")).length===1'),'migrated pesto in pasta pool');
check(a.run('manualCandidates("paul_bolo").some(r=>r.id==="paul_pates_pesto_rosso")'),'pesto manual choice');
check(a.run('!manualCandidates("paul_bolo").some(r=>r.category===3||r.category===4||state.week.includes(r.id))'),'manual batch slot and duplicates');
check(a.run('manualCandidates("pleasure_burger").every(r=>r.category===4)'),'manual pleasure slot');
check(a.run('manualCandidates("custom_bonus").length===0'),'bonus remains optional');
const reloaded=app(JSON.parse(a.data.get('atable.v1')));
check(reloaded.run('state.drawStatsRevision===1&&state.drawSequence===2'),'history metadata survives reload');
report.tests.push('migration existing pre-pesto storage, custom recipe/bonus and all user-facing data retained, pesto pasta/manual eligibility');
a=app({...fixture,pestoRossoRevision:1});check(!a.run('state.recipes.some(r=>r.id==="paul_pates_pesto_rosso")'),'intentional deletion respected');
const edited=structuredClone(fixture);edited.recipes.push({...seed.recipes.find(r=>r.id==='paul_pates_pesto_rosso'),name:'Mon pesto personnel'});a=app(edited);check(a.run('recipe("paul_pates_pesto_rosso").name==="Mon pesto personnel"'),'edited pesto not overwritten');
const alias=structuredClone(fixture);alias.ingredients.my_pesto={...alias.ingredients.cat_pesto_rosso,id:'my_pesto'};delete alias.ingredients.cat_pesto_rosso;a=app(alias);check(a.run('recipe("paul_pates_pesto_rosso").ingredients.some(l=>l.id==="my_pesto")'),'pesto uses existing ingredient alias');
report.tests.push('intentional deletion, edited pesto, ingredient alias preserved');
a=app();a.run('prepareDrawWeek();ensureBase();state.week=drawBatch().concat(pick(4));rememberDraw(state.week);save()');
const before=plain(a.run('state')),validated=plain(a.run('validate(state)'));
assert.deepEqual(validated.drawStats,before.drawStats);checks++;
a.run('state.drawStats.bad={last:-4,count:"oops"};state.drawStats.paul_bolo={last:Infinity,count:0}');
check(a.run('Object.values(validate(state).drawStats).every(v=>v.last>0&&v.count>0)'),'malformed history normalized');
report.tests.push('export/import draw metadata, malformed history sanitization');
a=app();a.run('prepareDrawWeek();ensureBase();state.week=["paul_bolo","paul_carbonara","paul_tikka","pleasure_burger"];rememberDraw(state.week);render=()=>{};toast=()=>{};');
check(a.run('replaceDish("paul_bolo","paul_pates_pesto_rosso")'),'manual replacement succeeds');
check(a.run('state.week.includes("paul_pates_pesto_rosso")&&state.week.length===4&&state.drawStats.paul_pates_pesto_rosso.count===1'),'manual state and history');
check(a.run('shopping().some(i=>i.id==="cat_pesto_rosso")'),'shopping reflects manual choice');
check(!a.run('replaceDish("paul_carbonara","paul_tikka")'),'cannot select duplicate');
check(!a.run('replaceDish("paul_carbonara","pleasure_croque")'),'cannot mix batch and pleasure');
const locked=plain(a.run('state.week.filter(id=>id!=="paul_carbonara")'));
a.run('reroll("paul_carbonara")');
check(locked.every(id=>a.run('state.week.includes('+JSON.stringify(id)+')')),'reroll preserves other slots');
report.tests.push('manual replacement, shopping, duplicate/wrong-slot protection, single reroll locks');
check(seed.recipes.length>0,'recipe seed present');
report.checks=checks;
if(process.env.WRITE_TEST_RESULTS)fs.writeFileSync(__dirname+'/TEST_RESULTS.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:'PASS',checks,distribution:report.distribution,tests:report.tests,counts:results.counts},null,2));
