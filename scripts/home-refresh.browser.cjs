const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {chromium}=require('playwright');
test('OK on Home refreshes Home from any page; focus and OK elsewhere do not reload',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage();await page.setContent('<ytlr-guide-entry-renderer><button id="home">Home</button></ytlr-guide-entry-renderer><button id="search">Search</button>');
  await page.evaluate(()=>{window.reloads=0;document.querySelector('ytlr-guide-entry-renderer').__instance={props:{data:{icon:{iconType:'HOME'},navigationEndpoint:{browseEndpoint:{browseId:'FEwhat_to_watch'}}}}};});
  const source=readFileSync('mods/utils/okKey.js','utf8').replace('export function','function')+'\n'+readFileSync('mods/features/homeRefresh.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('window.location.reload()','window.reloads++');
  await page.addScriptTag({content:source});
  await page.locator('#home').focus();assert.equal(await page.evaluate(()=>reloads),0);
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>reloads),1);
  await page.evaluate(()=>location.hash='#/browse?browseId=FElibrary');
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#/');assert.equal(await page.evaluate(()=>reloads),2);
  await page.locator('#search').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>reloads),2);
  assert.equal(await page.locator('#tt-refresh-button').count(),0);
 }finally{await browser.close();}
});
