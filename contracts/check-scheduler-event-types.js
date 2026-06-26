const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 2000;
  console.log(`Fetching one sample log for each Scheduler event type...`);
  
  const uniqueTopics = [
    '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207',
    '0xc4cf7a799ad7a9ac8738b89bc2fe83ee7a8dc1b15deef037ad58e560b9f00216',
    '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18',
    '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a52235266949',
    '0xae22d5dfcdd8d71d3326f8a32787e3f702adbb3386e3fb6b19a88aa451c878bd',
    '0x21d54ede0ed4aad87a553ba1c2062711124f459855e847fe3e0c210d5ea466fa'
  ];
  
  for (const topic of uniqueTopics) {
    try {
      const logs = await provider.getLogs({
        address: schedulerAddr,
        topics: [topic],
        fromBlock: startBlock,
        toBlock: currentBlock
      });
      if (logs.length > 0) {
        console.log(`\n=== Topic 0: ${topic} ===`);
        console.log(`  Count:  ${logs.length}`);
        console.log(`  Block:  ${logs[0].blockNumber}`);
        console.log(`  Topics:`, logs[0].topics);
        console.log(`  Data:  `, logs[0].data);
      }
    } catch (e) {
      console.error(`Failed to fetch for topic ${topic}:`, e.message);
    }
  }
}

main();
