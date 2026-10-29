const assert=require('node:assert/strict');const {test}=require('node:test');
const {readFileSync}=require('node:fs');const {chromium}=require('playwright');
// Controls are "up" while focus is inside the watch page; #stage stands in for
// YouTube's overlay stage, which holds focus once they hide. An Up key brings
// them back, like YouTube does.
const page_html='<ytlr-watch-default style="display:block;height:300px"><ytlr-progress-bar hybridnavfocusable="true" tabindex="0" style="display:block;height:5px"></ytlr-progress-bar><button id="player">Player</button></ytlr-watch-default><div id="stage" tabindex="0">stage</div><div role="dialog"><button id="menu">Menu</button></div>';
async function setup(browser,config){
 const page=await browser.newPage();await page.setContent(page_html);
 await page.evaluate(config=>{window.configRead=key=>config[key];window.normalBack=0;window.ups=0;window.commands=[];
  window.resolveCommand=c=>commands.push(c.signalAction.signal);
  document.addEventListener('keydown',e=>{if(e.key==='ArrowUp'){ups++;document.querySelector('ytlr-progress-bar').focus();}});
  document.addEventListener('keyup',e=>{if(e.key==='Escape')normalBack++;});},config);
 await page.addScriptTag({content:readFileSync('mods/features/playerBackGuard.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')});
 return page;
}
const state=page=>page.evaluate(()=>({normalBack,ups,commands,controls:!!document.activeElement.closest('ytlr-watch-default')}));
test('Back on a bare video shows the controls, a second Back leaves the player',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await setup(browser,{enableDoubleBackExit:true,enableBackRevealsControls:true});
  await page.locator('#stage').focus();await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:0,ups:1,commands:[],controls:true},'First Back reveals the controls');
  await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:0,ups:1,commands:['HISTORY_BACK'],controls:true},'Confirming Back leaves the player');
  await page.locator('#menu').focus();await page.keyboard.press('Escape');assert.equal((await state(page)).normalBack,1,'Menus keep their own Back');
  await page.locator('#stage').focus();await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
  assert.equal((await state(page)).commands.length,1,'Another key resets confirmation');
 }finally{await browser.close();}
});
test('With controls up, the first Back hides them and the second leaves',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await setup(browser,{enableDoubleBackExit:true,enableBackRevealsControls:true});
  await page.evaluate(()=>document.addEventListener('keyup',e=>{if(e.key==='Escape'&&document.activeElement.closest('ytlr-watch-default'))document.querySelector('#stage').focus();}));
  await page.locator('#player').focus();await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:1,ups:0,commands:[],controls:false});
  await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:2,ups:0,commands:[],controls:false},'YouTube navigates back on its own');
  await page.waitForTimeout(2050);await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:2,ups:1,commands:[],controls:true},'Expired confirmation only reveals the controls');
 }finally{await browser.close();}
});
test('Without confirmation, Back shows the controls and Back again leaves',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await setup(browser,{enableDoubleBackExit:false,enableBackRevealsControls:true});
  await page.locator('#stage').focus();await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:0,ups:1,commands:[],controls:true});
  await page.waitForTimeout(2050);await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:0,ups:1,commands:['HISTORY_BACK'],controls:true});
 }finally{await browser.close();}
});
test('With both options off, Back is left to YouTube',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await setup(browser,{enableDoubleBackExit:false,enableBackRevealsControls:false});
  await page.locator('#stage').focus();await page.keyboard.press('Escape');
  assert.deepEqual(await state(page),{normalBack:1,ups:0,commands:[],controls:false});
 }finally{await browser.close();}
});
