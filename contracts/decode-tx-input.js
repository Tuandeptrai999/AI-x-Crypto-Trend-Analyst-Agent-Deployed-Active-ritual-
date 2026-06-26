const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const txHash = '0x4b001805b9498ce8381355d0ef8761d18b0441f9a9d87a71814ba4067ffa8f3a';

  try {
    const tx = await provider.getTransaction(txHash);
    console.log(`Input data: ${tx.data}`);
    
    // The target contract seems to be a sovereign agent contract. Let's see if we can decode the input.
    // Standard sovereign agent contracts have a function like startAgent or start.
    // Let's print out the function selector:
    const selector = tx.data.slice(0, 10);
    console.log(`Selector: ${selector}`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
