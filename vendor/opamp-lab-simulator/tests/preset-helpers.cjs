// Exercise the same instructor unlock flow used in the browser; no test bypass.
async function unlockPresets(page, preset = 'inverting') {
  const access = page.locator('#presetAccess');
  if (await access.isVisible()) {
    if (!await access.evaluate(el => el.open)) await page.locator('#presetAccess summary').click();
    await page.locator('#presetPassword').fill('aero1234');
    await page.locator('#presetUnlockForm button').click();
  }
  if (preset) {
    await page.locator('#presetSelect').selectOption(preset);
    await page.locator('#loadPresetBtn').click();
  }
}
module.exports = { unlockPresets };
