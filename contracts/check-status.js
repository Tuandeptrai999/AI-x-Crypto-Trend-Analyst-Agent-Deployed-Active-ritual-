const { ethers } = require('ethers');

async function check() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  const abi = [
    "function owner() view returns (address)",
    "function walletBalance() view returns (uint256)",
    "function activeScheduleId() view returns (uint256)",
    "function executionCount() view returns (uint256)",
    "function lastJobId() view returns (bytes32)",
    "function lastThought() view returns (string)",
    "function lastAction() view returns (string)"
  ];
  
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const contract = new ethers.Contract(deployment.contractAddress, abi, provider);
  
  console.log("=== HOMO MIMIC CONTRACT STATUS ===");
  console.log("Owner:", await contract.owner());
  const bal = await contract.walletBalance();
  console.log("RitualWallet Balance (for fees):", ethers.formatEther(bal), "RITUAL");
  console.log("Active Schedule ID:", (await contract.activeScheduleId()).toString());
  console.log("Execution Count (Phase 1):", (await contract.executionCount()).toString());
  console.log("Last Job ID:", await contract.lastJobId());
  
  const thought = await contract.lastThought();
  const action = await contract.lastAction();
  
  console.log("Last Thought:", thought ? thought : "(empty - waiting for TEE delivery)");
  console.log("Last Action:", action ? action : "(empty)");
}

check().catch(console.error);
