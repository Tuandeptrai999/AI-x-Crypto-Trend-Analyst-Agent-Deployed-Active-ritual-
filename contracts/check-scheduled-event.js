const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const scheduledTopic = '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a52235266949';

  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      topics: [scheduledTopic],
      fromBlock: 37707000,
      toBlock: 37708500
    });

    console.log(`Found ${logs.length} scheduled events:`);
    logs.forEach(log => {
      const callId = BigInt(log.topics[1]).toString();
      console.log(`  - Schedule ID: #${callId} at Block ${log.blockNumber} (TX: ${log.transactionHash})`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
