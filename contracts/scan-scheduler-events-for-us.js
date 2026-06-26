const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const contractAddr = deployment.contractAddress;
  const scheduleId = Number(deployment.scheduleId);

  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 500;

  console.log(`Scanning Scheduler events from block ${startBlock} to ${currentBlock} for schedule #${scheduleId} or contract ${contractAddr}...`);

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

    let matchedLogs = [];

    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          const callId = Number(parsed.args.callId || parsed.args[0]);
          const target = parsed.args.target?.toLowerCase();
          const payer = parsed.args.payer?.toLowerCase();
          
          if (callId === scheduleId || target === contractAddr.toLowerCase() || payer === contractAddr.toLowerCase()) {
            matchedLogs.push({
              name: parsed.name,
              args: parsed.args.toObject(),
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              logIndex: log.logIndex
            });
          }
        }
      } catch (err) {
        // Skip unparseable logs
      }
    }

    console.log(`\nMatched logs related to schedule #${scheduleId} or contract ${contractAddr}:`);
    console.log(JSON.stringify(matchedLogs, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
