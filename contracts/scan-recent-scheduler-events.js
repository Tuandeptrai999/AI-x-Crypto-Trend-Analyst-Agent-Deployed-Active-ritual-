const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 200;

  console.log(`Scanning Scheduler events from block ${startBlock} to ${currentBlock}...`);

  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      fromBlock: startBlock,
      toBlock: currentBlock
    });

    console.log(`Found ${logs.length} logs in this range.`);

    const iface = new ethers.Interface([
      "event CallScheduled(uint256 indexed callId, address indexed target, address indexed payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data)",
      "event CallExecuted(uint256 indexed callId, bool success, bytes result)",
      "event CallCancelled(uint256 indexed callId, address indexed payer)",
      "event CallSuccess(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)",
      "event CallFailed(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)"
    ]);

    let eventCounts = {};
    let events = [];

    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          eventCounts[parsed.name] = (eventCounts[parsed.name] || 0) + 1;
          const callId = Number(parsed.args.callId || parsed.args[0]);
          events.push({
            name: parsed.name,
            callId,
            target: parsed.args.target,
            payer: parsed.args.payer,
            executionIndex: parsed.args.executionIndex?.toString(),
            gasUsed: parsed.args.gasUsed?.toString(),
            success: parsed.args.success,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash
          });
        }
      } catch (err) {
        // Skip unparseable logs
      }
    }

    console.log("Event counts:", eventCounts);
    console.log("\nSome recent events (last 20):");
    const slice = events.slice(-20);
    slice.forEach((ev) => {
      console.log(`[${ev.name}] CallId: #${ev.callId} at block ${ev.blockNumber} (tx: ${ev.txHash})`);
      if (ev.target) console.log(`  Target: ${ev.target}`);
      if (ev.success !== undefined) console.log(`  Success: ${ev.success}`);
      if (ev.gasUsed) console.log(`  GasUsed: ${ev.gasUsed}`);
    });

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
