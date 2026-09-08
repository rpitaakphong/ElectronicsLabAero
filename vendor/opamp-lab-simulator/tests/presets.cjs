const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const manage=async()=>{if(!await page.locator('.preset-manager').evaluate(el=>el.open))await page.locator('.preset-manager > summary').click();};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const entry of ['index.html','gds1202b_opamp_sim_single_file.html']){
    await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/')+entry);
    await page.evaluate(()=>localStorage.clear());await page.reload();
    await page.fill('#amplitudeInput','2');await page.locator('#amplitudeInput').press('Tab');
    await page.selectOption('#cursorSource','CH2');
    const resistor=await page.locator('#componentList option').evaluateAll(options=>options.find(o=>o.textContent.includes('resistor')).value);
    await page.selectOption('#componentList',resistor);await page.locator('.editor-advanced > summary').filter({hasText:'Exact position'}).click();await page.selectOption('#aRow','A');await page.fill('#aCol','7');await page.click('#applyPosition');
    await manage();await page.click('#savePresetBtn');
    const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('gds1202b-preset-inverting')));
    assert.equal(saved.state.generator.amplitude,2);assert.deepEqual(saved.state.components.find(c=>c.id===resistor).aHole,{row:'A',col:7});assert.equal(saved.scope.cursor.source,'CH2');
    assert((await page.locator('#presetSelect option:checked').textContent()).includes('Saved'));
    await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');
    await page.selectOption('#presetSelect','inverting');await page.click('#loadPresetBtn');
    await page.waitForTimeout(100);assert.equal(await page.locator('#amplitudeInput').inputValue(),'2');assert.equal(await page.locator('#cursorSource').inputValue(),'CH2');
    await page.reload();assert.equal(await page.locator('#amplitudeInput').inputValue(),'2');
    await page.fill('#amplitudeInput','3');await page.locator('#amplitudeInput').press('Tab');await manage();await page.click('#savePresetBtn');await page.reload();assert.equal(await page.locator('#amplitudeInput').inputValue(),'3');
    await manage();await page.click('#restorePresetBtn');assert.equal(await page.locator('#amplitudeInput').inputValue(),'1');assert(await page.locator('#restorePresetBtn').isDisabled());assert.equal(await page.evaluate(()=>localStorage.getItem('gds1202b-preset-inverting')),null);
    await manage();await page.fill('#newPresetName','My custom amplifier');await page.click('#createPresetBtn');const customId=await page.locator('#presetSelect').inputValue();assert(customId.startsWith('custom-'));
    await page.fill('#amplitudeInput','4');await page.locator('#amplitudeInput').press('Tab');await manage();await page.click('#savePresetBtn');await page.reload();await page.selectOption('#presetSelect',customId);await page.click('#loadPresetBtn');await page.waitForTimeout(100);assert.equal(await page.locator('#amplitudeInput').inputValue(),'4');
    const count=await page.locator('#presetSelect option').count();await manage();await page.fill('#newPresetName','my custom amplifier');await page.click('#createPresetBtn');assert.equal(await page.locator('#presetSelect option').count(),count);
    assert.equal(await page.locator('#restorePresetBtn').textContent(),'Delete preset');await manage();await page.click('#restorePresetBtn');assert.equal(await page.locator('#amplitudeInput').inputValue(),'4');assert.equal(await page.locator('#presetSelect option').count(),count-1);
    // Reset stays blank even when the Blank board preset has an override.
    await page.selectOption('#presetSelect','blank');await manage();await page.click('#savePresetBtn');
    page.once('dialog',d=>d.accept());await page.click('#resetAllBtn');assert.equal(await page.locator('#componentList option').count(),1);
    await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');assert(await page.locator('#componentList option').count()>1);
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1100});
    assert.deepEqual(errors,[]);console.log('PASS',entry,'overwrite, exact holes, scope settings, reload, re-overwrite, restore, blank reset, mobile');
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
