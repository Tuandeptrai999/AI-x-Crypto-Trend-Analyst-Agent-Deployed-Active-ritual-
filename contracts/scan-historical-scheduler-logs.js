const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const startBlock = 37698800;
  const endBlock = 37699200;

  console.log(`Scanning ALL Scheduler logs from block ${startBlock} to ${endBlock}...`);

  const iface = new ethers.Interface([
    "event CallScheduled(uint256 indexed callId, address indexed target, address indexed payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data)",
    "event CallExecuted(uint256 indexed callId, bool success, bytes result)",
    "event CallCancelled(uint256 indexed callId, address indexed payer)",
    "event CallSuccess(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)",
    "event CallFailed(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)"
  ]);

  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      fromBlock: startBlock,
      toBlock: endBlock
    });

    console.log(`Found ${logs.length} logs in this range.`);

    logs.forEach((log) => {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(`\n[${parsed.name}] CallId: #${parsed.args.callId || parsed.args[0]} at block ${log.blockNumber} (tx: ${log.transactionHash})`);
          if (parsed.name === 'CallSuccess' || parsed.name === 'CallFailed') {
            console.log(`  Target: ${parsed.args.target}`);
            console.log(`  Payer: ${parsed.args.payer}`);
            console.log(`  GasUsed: ${parsed.args.gasUsed?.toString()}`);
          }
        } else {
          console.log(`Unparseable event in block ${log.blockNumber} (tx: ${log.transactionHash}) topics:`, log.topics);
        }
      } catch (err) {
        console.log(`Error parsing log in block ${log.blockNumber} (tx: ${log.transactionHash}) topics:`, log.topics, err.message);
      }
    });

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
