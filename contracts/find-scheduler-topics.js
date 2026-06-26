// Inspect the raw topics of Scheduler contract to find what event signatures it actually uses
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 50;

  console.log(`Current block: ${currentBlock}`);
  console.log(`Checking raw log topics for Scheduler in last 50 blocks...`);

  const logs = await provider.getLogs({
    address: schedulerAddr,
    fromBlock: startBlock,
    toBlock: currentBlock
  });

  console.log(`Found ${logs.length} logs.`);
  
  const uniqueTopics = new Set();
  logs.forEach(log => {
    uniqueTopics.add(log.topics[0]);
  });
  
  console.log('\nUnique topic0 hashes found:');
  for (const t of uniqueTopics) {
    console.log(' ', t);
  }

  // Print known hashes for comparison
  console.log('\nKnown hashes:');
  console.log('  CallScheduled:', ethers.id("CallScheduled(uint256,address,address,uint32,uint32,uint32,uint32,uint32,uint256,uint256,uint256,bytes)"));
  console.log('  CallSuccess:  ', ethers.id("CallSuccess(uint256,address,address,uint256,uint256,bytes)"));
  console.log('  CallFailed:   ', ethers.id("CallFailed(uint256,address,address,uint256,uint256,bytes)"));
  console.log('  CallExecuted: ', ethers.id("CallExecuted(uint256,bool,bytes)"));
  console.log('  CallCancelled:', ethers.id("CallCancelled(uint256,address)"));
}

main().catch(console.error);
