const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const escrowAddr = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';
  
  const abi = [
    "function balanceOf(address) view returns (uint256)"
  ];
  
  const escrow = new ethers.Contract(escrowAddr, abi, provider);
  
  const ourContract = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451';
  const successfulContract = '0xd44a62457b06e207bc5eaf8ef45b8fc82fc0697d';
  
  try {
    const ourBal = await escrow.balanceOf(ourContract);
    const successfulBal = await escrow.balanceOf(successfulContract);
    
    console.log(`Escrow Balances:`);
    console.log(`  Our contract:        ${ethers.formatEther(ourBal)} RITUAL`);
    console.log(`  Successful contract: ${ethers.formatEther(successfulBal)} RITUAL`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
