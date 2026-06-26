const fs = require('fs');
const path = require('path');

const NEW_ADDRESS = '0x3BcDa307cFA37037AC3037c5f661909dBc9Bd9a4';
const OLD_ADDRESSES = [
  '0x3BcDa307cFA37037AC3037c5f661909dBc9Bd9a4'
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'build') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.json') || fullPath.endsWith('.md') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const old of OLD_ADDRESSES) {
        if (content.includes(old)) {
          content = content.split(old).join(NEW_ADDRESS);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.resolve(__dirname, '..'));
