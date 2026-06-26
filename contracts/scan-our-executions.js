const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const startBlock = 37700400;
  const currentBlock = await provider.getBlockNumber();

  console.log(`Scanning Scheduler executions from block ${startBlock} to ${currentBlock}...`);

  const successTopic = '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18';
  const failedTopic = '0xae22d5dfcdd8d71d3326f8a32787e3f702adbb3386e3fb6b19a88aa451c878bd';

  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      topics: [[successTopic, failedTopic]],
      fromBlock: startBlock,
      toBlock: currentBlock
    });

    console.log(`Found ${logs.length} executions in the range.`);
    logs.forEach((log) => {
      const type = log.topics[0] === successTopic ? 'CallSuccess' : 'CallFailed';
      const callId = BigInt(log.topics[1]).toString();
      console.log(`  - [Block ${log.blockNumber}] ${type} for Schedule #${callId} (TX: ${log.transactionHash})`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
