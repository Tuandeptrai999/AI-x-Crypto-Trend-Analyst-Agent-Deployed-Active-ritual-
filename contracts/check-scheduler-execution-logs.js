const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 2000; // scan last 2000 blocks
  console.log(`Scanning last 2000 blocks (${startBlock} to ${currentBlock}) for CallExecuted events...`);
  
  try {
    const executedTopic = ethers.id("CallExecuted(uint256,bool,bytes)");
    console.log("CallExecuted Topic Hash:", executedTopic);
    
    const logs = await provider.getLogs({
      address: schedulerAddr,
      topics: [executedTopic],
      fromBlock: startBlock,
      toBlock: currentBlock
    });
    
    console.log(`Found ${logs.length} CallExecuted events!`);
    
    if (logs.length > 0) {
      const iface = new ethers.Interface([
        "event CallExecuted(uint256 indexed callId, bool success, bytes result)"
      ]);
      
      for (let i = 0; i < Math.min(logs.length, 5); i++) {
        const log = logs[i];
        try {
          const parsed = iface.parseLog(log);
          console.log(`\nExecution ${i}: Call ID #${parsed.args.callId.toString()}`);
          console.log(`  Success:`, parsed.args.success);
          console.log(`  Result Length:`, parsed.args.result.length);
          console.log(`  Block:`, log.blockNumber);
        } catch (e) {
          console.log(`Failed to parse log ${i}:`, e.message);
        }
      }
    }
  } catch (e) {
    console.error("Error querying logs:", e);
  }
}

main();
