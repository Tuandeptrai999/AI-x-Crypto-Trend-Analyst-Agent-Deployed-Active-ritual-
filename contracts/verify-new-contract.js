const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const CONTRACT = '0x6032697f3445F8157f3CFdF86d224d67341Ee43f';
  
  console.log("Checking new contract address:", CONTRACT);
  
  const code = await provider.getCode(CONTRACT);
  if (code.length > 2) {
    console.log("✅ Contract is deployed on chain.");
  } else {
    console.log("❌ Contract is NOT deployed.");
  }
}

main().catch(console.error);
