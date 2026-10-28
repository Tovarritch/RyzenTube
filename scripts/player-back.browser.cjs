const assert=require('node:assert/strict');const {test}=require('node:test');
const {readFileSync}=require('node:fs');const {chromium}=require('playwright');
test('player Back requires confirmation, shows no reminder and leaves menus alone',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage();await page.setContent('<ytlr-watch-default style="display:block;height:300px"><ytlr-progress-bar hybridnavfocusable="false" style="display:block;height:5px"></ytlr-progress-bar><button id="player">Player</button></ytlr-watch-default><div role="dialog"><button id="menu">Menu</button></div>');
  await page.evaluate(()=>{window.configRead=()=>true;window.toasts=[];window.showToast=(title,text)=>toasts.push(text);window.normalBack=0;document.addEventListener('keyup',e=>{if(e.key==='Escape')normalBack++;});});
  await page.addScriptTag({content:readFileSync('mods/features/playerBackGuard.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')});
  await page.locator('#player').focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>normalBack),0);assert.equal(await page.evaluate(()=>toasts.length),0,'No notification on first Back');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>normalBack),1);
  await page.locator('#menu').focus();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>normalBack),2);assert.equal(await page.evaluate(()=>toasts.length),0);
  await page.locator('#player').focus();await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>normalBack),2,'Another key resets confirmation');
  await page.waitForTimeout(2050);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>normalBack),2,'Expired confirmation cannot exit');
 }finally{await browser.close();}
});
