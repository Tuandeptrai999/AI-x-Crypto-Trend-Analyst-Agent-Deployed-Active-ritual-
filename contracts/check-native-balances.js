const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  const ourContract = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451';
  const successfulContract = '0x8147DdF831D5b4ad4895651e158E8D1C7a1AEAa4';
  
  try {
    const ourNative = await provider.getBalance(ourContract);
    const successfulNative = await provider.getBalance(successfulContract);
    
    console.log(`Native RITUAL Balances (on-chain):`);
    console.log(`  Our contract:        ${ethers.formatEther(ourNative)} RITUAL`);
    console.log(`  Successful contract: ${ethers.formatEther(successfulNative)} RITUAL`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
