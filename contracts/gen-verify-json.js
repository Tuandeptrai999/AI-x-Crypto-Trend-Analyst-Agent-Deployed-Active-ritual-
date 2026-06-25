const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, 'src/HomoMimic.sol'), 'utf8');

// Standard JSON input - NO viaIR, optimizer enabled runs=200
const input = {
  language: "Solidity",
  sources: {
    "HomoMimic.sol": {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    evmVersion: "shanghai",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "evm.methodIdentifiers", "metadata"]
      }
    }
  }
};

const json = JSON.stringify(input, null, 2);
fs.writeFileSync('verify-upload.json', json);
console.log('✅ Đã tạo file verify-upload.json');
console.log('Kích thước:', json.length, 'bytes');
console.log('\n=== THÔNG SỐ XÁC MINH ===');
console.log('Compiler Version : v0.8.20+commit.a1b79de6');
console.log('Phương thức      : Standard JSON Input');
console.log('File upload      : verify-upload.json');
console.log('Contract Name    : HomoMimic');
console.log('Optimizer        : Enabled, 200 runs');
console.log('EVM Version      : shanghai');
console.log('viaIR            : false (KHÔNG bật)');
