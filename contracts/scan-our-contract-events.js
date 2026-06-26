const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const contractAddr = deployment.contractAddress;
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 5000;
  
  console.log(`Current Block: ${currentBlock}`);
  console.log(`Scanning events for contract ${contractAddr} from block ${startBlock} to ${currentBlock}...`);

  const abi = [
    "event AgentWake(uint256 indexed executionIndex, bytes32 indexed jobId)",
    "event AgentResult(bytes32 indexed jobId, string thought, string action)",
    "event Scheduled(uint256 indexed callId, uint32 frequency, uint32 numCalls)"
  ];
  
  const contract = new ethers.Contract(contractAddr, abi, provider);
  
  try {
    const events = await contract.queryFilter("*", startBlock, currentBlock);
    console.log(`Found ${events.length} events:`);
    events.forEach((event) => {
      console.log(`\n[${event.fragment.name}] Block: ${event.blockNumber}`);
      console.log(`  TxHash: ${event.transactionHash}`);
      console.log(`  Args:`, JSON.stringify(event.args.toObject(), (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    });
  } catch (e) {
    console.error("Error queryFilter:", e);
  }
}

main();
