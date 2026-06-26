const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 500;
  console.log(`Searching for recent CallScheduled events from block ${startBlock} to ${currentBlock}...`);
  
  try {
    // Topic for CallScheduled: event signature hash from print-raw-log0.js
    const scheduledTopic = '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a52235266949';
    
    const logs = await provider.getLogs({
      address: schedulerAddr,
      topics: [scheduledTopic],
      fromBlock: startBlock,
      toBlock: currentBlock
    });
    
    console.log(`Found ${logs.length} recent schedules.`);
    if (logs.length === 0) return;
    
    // Get callId of the most recent one
    const latestLog = logs[logs.length - 1];
    const callId = BigInt(latestLog.topics[1]);
    console.log(`Most recent Call ID: #${callId.toString()} in block ${latestLog.blockNumber}`);
    
    const abi = [
      "function calls(uint256) view returns (address target, address payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint32 callsMade, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data, bool cancelled)"
    ];
    const scheduler = new ethers.Contract(schedulerAddr, abi, provider);
    
    console.log(`Querying calls(${callId.toString()})...`);
    try {
      const callInfo = await scheduler.calls(callId);
      console.log("Success! Call Info:");
      console.log("  Target:    ", callInfo.target);
      console.log("  Payer:     ", callInfo.payer);
      console.log("  StartBlock:", callInfo.startBlock.toString());
      console.log("  CallsMade: ", callInfo.callsMade.toString());
      console.log("  Cancelled: ", callInfo.cancelled);
    } catch (e) {
      console.log(`Failed with error: ${e.message}`);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
