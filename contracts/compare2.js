const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function compare() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const deployedBytecode = await provider.getCode('0x9581a0f1710E42643393e9f1cDd9709447c21656');
  
  const artifactPath = path.join(__dirname, 'build/HomoMimic.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const localCreationBytecode = artifact.bytecode;
  
  // Solc output usually has deployedBytecode as well. Let's check.
  // Wait, in compile.js we only selected 'evm.bytecode.object'. We didn't select 'evm.deployedBytecode.object'.
  console.log('Deployed runtime length:', deployedBytecode.length);
  
  // Just check if deployed bytecode (minus metadata hash at the end) is in the local creation bytecode
  const deployedWithoutMeta = deployedBytecode.slice(0, -100);
  console.log('Is runtime bytecode inside creation bytecode?', localCreationBytecode.includes(deployedWithoutMeta.slice(2)));
}
compare().catch(console.error);
