const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const CONTRACT = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451';
  
  console.log("Checking new contract address:", CONTRACT);
  
  const code = await provider.getCode(CONTRACT);
  if (code.length > 2) {
    console.log("✅ Contract is deployed on chain.");
  } else {
    console.log("❌ Contract is NOT deployed.");
  }
}

main().catch(console.error);
