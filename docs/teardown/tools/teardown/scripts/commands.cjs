const fs = require('node:fs'), {execFileSync} = require('node:child_process');

function has(command) {
  try {
    execFileSync('which', [command], {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function findChrome() {
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', 'google-chrome', 'chromium', 'chromium-browser'];
  return candidates.filter(Boolean).find(c => /^(\/|[A-Za-z]:)/.test(c) ? fs.existsSync(c) : has(c));
}

module.exports = {has, findChrome};
