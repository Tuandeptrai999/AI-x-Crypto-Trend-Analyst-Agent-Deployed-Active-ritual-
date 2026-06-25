const fs = require('fs');
const path = require('path');
const solc = require('solc');

function compileContract(filename, contractName) {
  const contractPath = path.resolve(__dirname, 'src', filename);
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [filename]: { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] }
      }
    }
  };

  console.log(`Compiling ${filename} with viaIR...`);
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasErrors = false;
    output.errors.forEach(err => {
      console.log(err.formattedMessage);
      if (err.severity === 'error') hasErrors = true;
    });
    if (hasErrors) process.exit(1);
  }

  const contractData = output.contracts[filename][contractName];
  return {
    abi:      contractData.abi,
    bytecode: contractData.evm.bytecode.object
  };
}

const buildDir = path.resolve(__dirname, 'build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

// Compile HomoMimic (v2 — uses Sovereign Agent precompile 0x080C)
const homoMimic = compileContract('HomoMimic.sol', 'HomoMimic');
fs.writeFileSync(
  path.join(buildDir, 'HomoMimic.json'),
  JSON.stringify(homoMimic, null, 2)
);
console.log('✅ HomoMimic compiled → build/HomoMimic.json');

