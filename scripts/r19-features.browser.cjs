const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {chromium} = require('playwright');
const source = file => readFileSync(`mods/${file}`, 'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');

test('Instant Seek commits once after release, cancels on focus changes and keeps native movement', async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage();
  await page.setContent('<video></video><ytlr-progress-bar tabindex="0"></ytlr-progress-bar><button id="other">Other</button>');
  await page.evaluate(()=>{
   window.settings={enableInstantSeek:true,instantSeekDelayMs:250};window.configRead=k=>settings[k];window.configChangeEmitter=new EventTarget();
   Object.defineProperty(document.querySelector('video'),'duration',{value:100});
   window.commits=0;window.steps=0;
   document.addEventListener('keydown',event=>{if(event.keyCode===13)commits++;if(event.keyCode===39)steps++;});
  });
  await page.addScriptTag({content:source('features/instantSeek.js')});
  await page.locator('ytlr-progress-bar').focus();
  await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>commits),0,'Never commit while held');
  await page.keyboard.up('ArrowRight');await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>commits),1);assert.equal(await page.evaluate(()=>steps),2);
  await page.keyboard.press('ArrowLeft');await page.locator('#other').focus();await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>commits),1,'Do not press OK on another control');
  await page.locator('ytlr-progress-bar').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>commits),2,'A real OK cancels the automatic commit');
 } finally {await browser.close();}
});

test('fork menu preferences preserve native items and restore configurable entries',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage();
  await page.evaluate(()=>{window.settings={longPressMenuHidden:['queue'],longPressMenuOrder:['channel','play','queue']};window.configRead=k=>settings[k];});
  await page.addScriptTag({content:source('ui/menuOrder.js')+'\nwindow.arrangeMenu=arrangeMenu;'});
  const result=await page.evaluate(()=>{
   const nativeA={native:'A'},nativeB={native:'B'};
   const items=[nativeA,{__ttMenuId:'play'},nativeB,{__ttMenuId:'queue'},{__ttMenuId:'channel'}];
   const hidden=arrangeMenu(items);
   settings.longPressMenuHidden=[];
   return {hidden,restored:arrangeMenu(items),identity:hidden[0]===nativeA&&hidden[2]===nativeB};
  });
  assert.deepEqual(result.hidden,[{native:'A'},{__ttMenuId:'channel'},{native:'B'},{__ttMenuId:'play'}]);
  assert.equal(result.restored.length,5);assert.equal(result.identity,true);
 }finally{await browser.close();}
});

test('Library and player response filtering use IDs, honor the master switch and retain unrelated actions',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage();
  await page.evaluate(()=>{window.settings={hiddenLibraryTabIds:['fehistory'],enablePatchingVideoPlayer:true,enablePreviousNextButtons:false,hidePlayerJoinButton:true};window.configRead=k=>settings[k];window.configChangeEmitter=new EventTarget();});
  await page.addScriptTag({content:source('features/libraryTabHider.js')+'\nwindow.filterLibraryTabs=filterLibraryTabs;'});
  await page.addScriptTag({content:source('features/playerButtonPreferences.js')+'\nwindow.patchPlayerButtons=patchPlayerButtons;'});
  const result=await page.evaluate(()=>{
   const library={tvSecondaryNavSectionRenderer:{tabs:[{tabRenderer:{selected:true,endpoint:{browseEndpoint:{browseId:'FEhistory'}}}},{tabRenderer:{endpoint:{browseEndpoint:{browseId:'FEmy_videos'}}}}]},horizontalListRenderer:{items:[{tileRenderer:{contentId:'video-history',metadata:{title:'History'}}}]}};
   filterLibraryTabs(library);
   const controls={skipPreviousButton:{},skipNextButton:{},engagementActions:[{type:'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORSHIPS'},{type:'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT'},{type:'TRANSPORT_CONTROLS_BUTTON_TYPE_LIKE_BUTTON'}]};
   patchPlayerButtons({transportControls:{transportControlsRenderer:controls}});
   settings.enablePatchingVideoPlayer=false;
   const untouched={skipNextButton:{},engagementActions:[{type:'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORSHIPS'}]};
   patchPlayerButtons({transportControls:{transportControlsRenderer:untouched}});
   return{library,controls,untouched};
  });
  assert.equal(result.library.tvSecondaryNavSectionRenderer.tabs.length,1);
  assert.equal(result.library.horizontalListRenderer.items.length,1);
  assert.equal(result.library.tvSecondaryNavSectionRenderer.tabs[0].tabRenderer.selected,true);
  assert.equal('skipNextButton' in result.controls,false);
  assert.equal(result.controls.engagementActions.length,2);
  assert.equal('skipNextButton' in result.untouched,true);
 }finally{await browser.close();}
});

test('SponsorBlock overlay sits on the seek bar container and disappears on the ended/Up Next screen',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage();await page.setContent('<style>.ytLrProgressBarSlider{position:absolute;height:10px}</style><video></video><ytlr-redux-connect-ytlr-progress-bar style="display:block;position:relative;width:600px;height:20px"><ytlr-progress-bar hybridnavfocusable="true"><div idomkey="slider" class="ytLrProgressBarSlider" style="width:500px;height:10px"></div></ytlr-progress-bar></ytlr-redux-connect-ytlr-progress-bar>');
  await page.evaluate(()=>{window.ended=false;window.position=10;const video=document.querySelector('video');Object.defineProperties(video,{ended:{get:()=>ended},duration:{value:100},currentTime:{get:()=>position}});});
  await page.addScriptTag({content:source('features/sponsorOverlay.js')+'\nwindow.cleanup=createSponsorOverlay(document.querySelector("video"),[{segment:[10,20],category:"sponsor"}],{sponsor:{color:"green",opacity:.7}});'});
  assert.equal(await page.locator('ytlr-redux-connect-ytlr-progress-bar > .tt-sponsor-segments').count(),1);
  assert.equal(await page.locator('.tt-sponsor-segments').isVisible(),true);
  assert.equal(await page.locator('.tt-sponsor-segments > div').evaluate(e=>e.style.getPropertyValue('width')),'10%');
  await page.evaluate(()=>{document.querySelector('ytlr-progress-bar').setAttribute('hybridnavfocusable','false');document.querySelector('video').dispatchEvent(new Event('timeupdate'));});
  assert.equal(await page.locator('.tt-sponsor-segments').isVisible(),false,'Hidden with the seek bar, as in the original overlay');
  await page.evaluate(()=>{document.querySelector('ytlr-progress-bar').setAttribute('hybridnavfocusable','true');window.ended=true;document.querySelector('video').dispatchEvent(new Event('ended'));});
  assert.equal(await page.locator('.tt-sponsor-segments').isVisible(),false);
  await page.evaluate(()=>{window.ended=false;window.position=99.95;document.querySelector('video').dispatchEvent(new Event('timeupdate'));});
  assert.equal(await page.locator('.tt-sponsor-segments').isVisible(),false);
  await page.evaluate(()=>cleanup());assert.equal(await page.locator('.tt-sponsor-segments').count(),0);
 }finally{await browser.close();}
});

test('original language fetches YouTube titles once and chooses original audio once per video',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage();await page.setContent('<main></main>');
  await page.evaluate(()=>{
   window.settings={enableOriginalTitles:true,enableOriginalAudio:true};window.configRead=k=>settings[k];window.configChangeEmitter=new EventTarget();window.requests=[];
   window.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>({title:'Original creator title'})};};
   window.track='dub';window.selected=[];window.player={getVideoData:()=>({video_id:'abcdefghijk'}),getAvailableAudioTracks:()=>[{id:'dub',language:{name:'English dubbed'}},{id:'original',language:{name:'Romanian (Original)'}}],getAudioTrack:()=>({id:track}),setAudioTrack:async value=>{track=value.id;selected.push(value.id);}};
  });
  await page.addScriptTag({content:source('features/originalLanguage.js')+'\nwindow.patchOriginalMetadata=patchOriginalMetadata;window.applyOriginalAudio=applyOriginalAudio;'});
  const result=await page.evaluate(async()=>{
   const response={videoDetails:{videoId:'abcdefghijk',title:'Translated title'}};
   patchOriginalMetadata(response);await new Promise(resolve=>setTimeout(resolve,30));patchOriginalMetadata(response);
   await applyOriginalAudio(player);track='dub';await applyOriginalAudio(player);
   return{title:response.videoDetails.title,requests,selected,manualChoice:track};
  });
  assert.equal(result.title,'Original creator title');assert.equal(result.requests.length,1);
  assert.match(result.requests[0],/^https:\/\/www.youtube.com\/oembed\?/);
  assert.deepEqual(result.selected,['original']);assert.equal(result.manualChoice,'dub');
 }finally{await browser.close();}
});
