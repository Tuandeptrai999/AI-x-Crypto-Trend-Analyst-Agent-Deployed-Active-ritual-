const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  
  const abi = [
    "function executionCount() view returns (uint256)",
    "function lastThought() view returns (string)",
    "function lastAction() view returns (string)"
  ];
  
  const contract = new ethers.Contract(deployment.contractAddress, abi, provider);
  const startBlock = 37711402;
  
  console.log(`Starting monitoring for contract: ${deployment.contractAddress}`);
  console.log(`Expected start block: ${startBlock}`);
  
  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const count = await contract.executionCount();
      const thought = await contract.lastThought();
      
      console.log(`[Block ${currentBlock}] Execution Count: ${count.toString()}`);
      
      if (count > 0n) {
        console.log("\n🎉 SUCCESS! The agent has executed at least once!");
        console.log(`Last Thought: ${thought}`);
        break;
      }
      
      if (currentBlock > startBlock + 100) {
        console.log("\n⚠️ Passed start block by 100 blocks. Waiting a bit more...");
      }
    } catch (e) {
      console.error("Query error:", e.message);
    }
    await new Promise(resolve => setTimeout(resolve, 15000)); // check every 15s
  }
}

main().catch(console.error);
