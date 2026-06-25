const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const CONTRACT = '0x02C96B18762BfA21AaB572D01cFD692608e93271';
  
  console.log("Checking new contract address:", CONTRACT);
  
  const code = await provider.getCode(CONTRACT);
  if (code.length > 2) {
    console.log("✅ Contract is deployed on chain.");
  } else {
    console.log("❌ Contract is NOT deployed.");
  }
}

main().catch(console.error);
