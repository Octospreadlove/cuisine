const {chromium}=require('/home/kit/cuisine/node_modules/playwright');
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
(async()=>{
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(__dirname+'/index.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.TEST_URL||'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'/opt/hako/bin/google-chrome',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(url);
const migration=await page.evaluate(()=>{
 const old=fresh();delete old.winterBonusRevision;old.recipes=old.recipes.filter(r=>r.category!==3);
 old.ingredients.pates.price=.77;old.ingredients.pates.priceMax=1.25;
 old.recipes.push({...structuredClone(old.recipes[0]),id:'custom_bonus',name:'Bonus perso test',category:3,season:'summer',personalNotes:'à conserver'});
 old.checked={pates:true};old.stock={pates:125};old.favorites=['custom_bonus'];old.extras=[{key:'extra_test',id:'pates',qty:100}];
 localStorage.setItem(KEY,JSON.stringify(old));return old;
});
await page.reload();
assert.deepEqual(await page.evaluate(()=>({price:state.ingredients.pates.price,stock:state.stock.pates,check:state.checked.pates,note:recipe('custom_bonus').personalNotes,fav:state.favorites,extras:state.extras})),{price:.77,stock:125,check:true,note:'à conserver',fav:['custom_bonus'],extras:[{key:'extra_test',id:'pates',qty:100}]});
await page.locator('#roll-first').click();await page.waitForFunction(()=>!drawing);
await page.evaluate(()=>document.fonts.ready);
async function layout(){
 return page.evaluate(()=>{
 const a=document.querySelector('#roll-all').getBoundingClientRect(),b=document.querySelector('#choose-meals').getBoundingClientRect();
 const c=document.querySelector('#draw-bonus').getBoundingClientRect(),d=document.querySelector('#choose-bonus').getBoundingClientRect();
 const style=e=>{const s=getComputedStyle(e);return [s.backgroundColor,s.border,s.fontSize,s.fontWeight,s.borderRadius,s.boxShadow]};
 return {width:innerWidth,a:{x:a.x,y:a.y,w:a.width,h:a.height},b:{x:b.x,y:b.y,w:b.width,h:b.height},bonusSameRow:Math.abs(c.y-d.y)<1,bonusInViewport:d.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,sameStyle:JSON.stringify(style(document.querySelector('#roll-all')))===JSON.stringify(style(document.querySelector('#choose-meals')))};
 });
}
const mobile=await layout();assert.ok(Math.abs(mobile.a.y-mobile.b.y)<1);assert.ok(mobile.b.x>mobile.a.x+mobile.a.w);assert.ok(mobile.b.x+mobile.b.w<=390);assert.ok(mobile.sameStyle&&mobile.bonusSameRow&&mobile.bonusInViewport&&!mobile.overflow);
await page.screenshot({path:__dirname+'/manual-mobile.png',fullPage:true});
const exhaustive=await page.evaluate(()=>{
 const saved=state.week;
 const pool=state.recipes.filter(r=>r.category!==3&&r.category!==4).map(r=>r.id);
 const pleasure=state.recipes.find(r=>r.category===4).id,bonus=state.recipes.find(r=>r.category===3).id;
 const combos=(arr,n,start=0,prefix=[],out=[])=>{if(!n){out.push(prefix);return out;}for(let i=start;i<=arr.length-n;i++)combos(arr,n-1,i+1,[...prefix,arr[i]],out);return out;};
 const starts=combos(pool,3),selections=[...combos(pool,1),...combos(pool,2),...combos(pool,3)];let cases=0;
 for(const batch of starts){
  state.week=[...batch,pleasure,bonus];
  for(const selected of selections){
   const result=manualBatchWeek(selected),next=result.slice(0,3);
   if(new Set(next).size!==3||selected.some(id=>!next.includes(id))||result[3]!==pleasure||result[4]!==bonus)throw Error('invalid manual result');
   const incoming=selected.filter(id=>!batch.includes(id)).length;
   if(batch.filter(id=>next.includes(id)).length!==3-incoming)throw Error('lost more original dishes than necessary');
   for(let i=0;i<batch.length;i++)if(selected.includes(batch[i])&&next[i]!==batch[i])throw Error('selected existing dish moved');
   cases++;
  }
 }
 state.week=saved;
 return {pool:pool.length,starts:starts.length,selections:selections.length,cases};
});
console.log('EXHAUSTIVE',exhaustive);
const ids=await page.evaluate(()=>({batch:state.week.filter(id=>recipe(id).category!==3&&recipe(id).category!==4),outside:state.recipes.filter(r=>r.category!==3&&r.category!==4&&!state.week.includes(r.id)).map(r=>r.id),other:state.week.filter(id=>recipe(id).category===3||recipe(id).category===4)}));
await page.locator('#choose-meals').click();
assert.equal(await page.locator('input[name="manual-menu-pick"]').count(),exhaustive.pool);
assert.ok(await page.locator('#apply-manual-menu').isDisabled());
await page.locator('input[value="'+ids.batch[1]+'"]').check();
await page.locator('input[value="'+ids.outside[0]+'"]').check();
await page.locator('input[value="'+ids.outside[1]+'"]').check();
assert.equal(await page.locator('input[name="manual-menu-pick"]:disabled').count(),exhaustive.pool-3);
await page.locator('input[value="'+ids.outside[1]+'"]').uncheck();
await page.locator('#apply-manual-menu').click();
const result=await page.evaluate(()=>state.week);
assert.equal(result[0],ids.outside[0]);assert.equal(result[1],ids.batch[1]);assert.equal(result[2],ids.batch[2]);assert.deepEqual(result.slice(3),ids.other);
await page.locator('#choose-meals').click();await page.locator('input[name="manual-menu-pick"]').first().check();await page.locator('[data-close="manual-menu-dialog"]').first().click();assert.deepEqual(await page.evaluate(()=>state.week),result);
await page.locator('#choose-bonus').click();await page.locator('input[value="bonus_raclette_hiver"]').check();await page.locator('#apply-manual-menu').click();
await page.locator('#choose-bonus').click();assert.equal(await page.locator('input[value="bonus_raclette_hiver"]').count(),0);await page.locator('input[value="bonus_tartiflette_poele_hiver"]').check();await page.locator('#apply-manual-menu').click();
assert.deepEqual(await page.evaluate(()=>state.week.slice(0,4)),result);
const beforeReload=await page.evaluate(()=>({week:state.week,shopping:shopping(),stock:state.stock,extras:state.extras,recipes:validate(structuredClone(state)).recipes,ingredients:state.ingredients}));
assert.equal(new Set(beforeReload.week).size,beforeReload.week.length);
const cheese=await page.evaluate(()=>['bonus_raclette_hiver','bonus_tartiflette_poele_hiver'].map(id=>linesFor(recipe(id)).map(l=>l.id)));
for(const group of cheese)for(const id of group)assert.ok(beforeReload.shopping.some(x=>x.id===id));
await page.locator('[data-goto="shopping"]').click();assert.ok(await page.locator('#shopping').isVisible());
await page.locator('[data-tab="week"]').click();
await page.reload();const afterReload=await page.evaluate(()=>({week:state.week,shopping:shopping(),stock:state.stock,extras:state.extras,recipes:validate(structuredClone(state)).recipes,ingredients:state.ingredients}));assert.deepEqual(afterReload,beforeReload);
await page.locator('#draw-bonus').click();assert.deepEqual(await page.evaluate(()=>state.week.filter(id=>recipe(id).category!==3)),result);assert.ok(await page.evaluate(()=>state.week.includes('custom_bonus')));
await page.setViewportSize({width:1440,height:1000});const desktop=await layout();assert.ok(Math.abs(desktop.a.y-desktop.b.y)<1&&desktop.sameStyle&&!desktop.overflow);
await page.screenshot({path:__dirname+'/manual-desktop.png',fullPage:true});
assert.deepEqual(errors,[]);
const report={status:'PASS',url,exhaustive,mobile,desktop,checks:['migration custom recipes prices stock favorites extras checked preserved','checkbox min1 max3','existing selected retained in place','minimal replacements for every combination','cancel unchanged','bonus explicit radio add and duplicates excluded','random bonus unchanged main menu','shopping quantities and stock','reload exact state','390px and 1440px adjacent same styled buttons','zero page errors'],errors};
fs.writeFileSync(__dirname+'/MANUAL_RESULTS.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
