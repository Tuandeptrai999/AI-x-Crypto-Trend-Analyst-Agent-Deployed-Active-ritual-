const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 2000;
  console.log(`Scanning last 2000 blocks (${startBlock} to ${currentBlock}) for all Scheduler events...`);
  
  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      fromBlock: startBlock,
      toBlock: currentBlock
    });
    
    console.log(`Total events found: ${logs.length}`);
    
    // Group by Topic 0 (event signature hash)
    const topicCounts = {};
    for (const log of logs) {
      const topic0 = log.topics[0];
      topicCounts[topic0] = (topicCounts[topic0] || 0) + 1;
    }
    
    console.log("\n=== EVENT TOPIC DISTRIBUTION ===");
    for (const [topic, count] of Object.entries(topicCounts)) {
      console.log(`Topic 0: ${topic} - Count: ${count}`);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
