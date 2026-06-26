const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const workingAddr = '0xd44a62457b06e207bc5eaf8ef45b8fc82fc0697d';
  
  try {
    const deployedBytecode = await provider.getCode(workingAddr);
    const localArtifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8'));
    
    console.log(`Bytecode length comparison:`);
    console.log(`  Working contract: ${deployedBytecode.length}`);
    console.log(`  Local contract:   ${localArtifact.bytecode.length}`);
    
    // Check if they match or if they have different length
    if (deployedBytecode.length === localArtifact.bytecode.length) {
      console.log("✅ Bytecode length matches!");
    } else {
      console.log("❌ Bytecode length mismatch!");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
