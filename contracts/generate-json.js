const fs = require('fs');
const path = require('path');

const filename = 'HomoMimic.sol';
const contractPath = path.resolve(__dirname, 'src', filename);
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    [filename]: { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'shanghai',
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object'] }
    }
  }
};

fs.writeFileSync('standard-json-fix.json', JSON.stringify(input, null, 2));
console.log('Generated standard-json-fix.json');
