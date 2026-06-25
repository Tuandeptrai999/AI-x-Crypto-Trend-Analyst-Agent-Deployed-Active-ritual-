const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function compare() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const deployedBytecode = await provider.getCode('0x9581a0f1710E42643393e9f1cDd9709447c21656');
  
  const artifactPath = path.join(__dirname, 'build/HomoMimic.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const localBytecode = artifact.bytecode;
  
  console.log('Deployed length:', deployedBytecode.length);
  console.log('Local length   :', localBytecode.length);
  
  if (deployedBytecode === '0x') {
    console.log('Contract not found on chain!');
    return;
  }
  
  // Note: deployed bytecode is deployed bytecode (runtime). localBytecode is creation bytecode.
  // We need to compare runtime bytecode if possible, or at least check if it's there.
  console.log('Is creation bytecode prefix match?', localBytecode.startsWith(deployedBytecode.slice(0, 100)));
}
compare().catch(console.error);
