// Now we know the actual Scheduler event topic signatures!
// UNKNOWN_A = CallExecuted (callId, target, bool success, bytes result)  topic: 0x6973f65...
// UNKNOWN_B = CallSuccess or similar (callId, target, payer, gasUsed/block, executionIndex, frequency, ...) topic: 0x9506817...
// Let's check for our specific contract (0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451) in recent + historical blocks

const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const ourContract = '0x2b5cecc6f4b8b07a005bbc8fdd8ea06e7b97c451'; // lowercase

  // The actual execution event topic (UNKNOWN_A / CallExecuted-like)
  const execTopic = '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207';
  const successTopic = '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18';
  const cancelledTopic = '0xc4cf7a799ad7a9ac8738b89bc2fe83ee7a8dc1b15deef037ad58e560b9f00216';

  const currentBlock = await provider.getBlockNumber();
  // Scan since we deployed (block ~37708000)
  const startBlock = 37708000;

  console.log(`Current block: ${currentBlock}`);
  console.log(`Scanning for our contract ${ourContract} in Scheduler events from block ${startBlock}...`);

  const BATCH = 10000;
  let allLogs = [];

  for (let from = startBlock; from <= currentBlock; from += BATCH) {
    const to = Math.min(from + BATCH - 1, currentBlock);
    process.stdout.write(`  [${from} - ${to}]...\r`);
    try {
      const logs = await provider.getLogs({
        address: schedulerAddr,
        fromBlock: from,
        toBlock: to
      });
      // Filter for our contract in topics[2]
      const ourLogs = logs.filter(log => {
        return log.topics.some(t => t.toLowerCase().includes(ourContract.slice(2)));
      });
      allLogs.push(...ourLogs);
    } catch (e) {
      console.error(`\nError in range [${from}-${to}]: ${e.message}`);
    }
  }

  console.log(`\nFound ${allLogs.length} logs related to our contract.`);

  for (const log of allLogs) {
    const t0 = log.topics[0];
    let eventName = 'UNKNOWN';
    if (t0 === execTopic) eventName = 'CallExecuted(bool,bytes)';
    else if (t0 === successTopic) eventName = 'CallSuccess(gasUsed,execIdx,...)';
    else if (t0 === cancelledTopic) eventName = 'CANCELLED?';

    const callId = BigInt(log.topics[1]);
    console.log(`\n[${eventName}] CallId: #${callId} at block ${log.blockNumber}`);
    console.log(`  Data: ${log.data}`);
  }
}

main().catch(console.error);
