// Decode actual Scheduler event topics to understand what the precompile emits
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 50;

  const logs = await provider.getLogs({
    address: schedulerAddr,
    fromBlock: startBlock,
    toBlock: currentBlock
  });

  console.log(`Found ${logs.length} logs, printing raw topic0 and sample data:`);
  
  // Show a representative log for each unique topic0
  const seen = new Set();
  for (const log of logs) {
    const t0 = log.topics[0];
    if (!seen.has(t0)) {
      seen.add(t0);
      console.log(`\n--- topic0: ${t0} ---`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx: ${log.transactionHash}`);
      console.log(`  Topics:`, log.topics);
      console.log(`  Data (first 200 chars): ${log.data.slice(0, 200)}`);
    }
  }

  // Now check if any known topic matches
  const known_topics = {
    '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a52235266949': 'CallScheduled',
    '0xdae29b338091722e0b93a12454ab506ff7354fc9cf9ff0b21fb5d8ac9f514210': 'CallSuccess',
    '0x15f0d97c1489650f6b9c009ed3c3da6105647810bb658e48cd165720c3668712': 'CallFailed',
    '0xc844f5305195f29489ff13d35e268904b855970284ef0c8d85f1ce917be4cc74': 'CallExecuted',
    '0xdb8c28331eec1922d753ed0867eb31aceef62bcfca874caeb43c28f272b5518c': 'CallCancelled',
    '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207': 'UNKNOWN_A',
    '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18': 'UNKNOWN_B',
    '0xc4cf7a799ad7a9ac8738b89bc2fe83ee7a8dc1b15deef037ad58e560b9f00216': 'UNKNOWN_C',
  };

  // Count frequency of each topic
  const counts = {};
  for (const log of logs) {
    const t0 = log.topics[0];
    counts[t0] = (counts[t0] || 0) + 1;
  }

  console.log('\n\nEvent frequency summary:');
  for (const [topic, count] of Object.entries(counts)) {
    const name = known_topics[topic] || 'UNKNOWN';
    console.log(`  ${name} (${topic}): ${count} occurrences`);
  }
}

main().catch(console.error);
