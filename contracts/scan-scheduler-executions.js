const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  const currentBlock = 37700000;
  const startBlock = 37690000;

  console.log(`Current Block: ${currentBlock}`);
  console.log(`Scanning Scheduler execution events from block ${startBlock} to ${currentBlock}...`);

  const iface = new ethers.Interface([
    "event CallExecuted(uint256 indexed callId, bool success, bytes result)",
    "event CallSuccess(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)",
    "event CallFailed(uint256 indexed callId, address indexed target, address indexed payer, uint256 executionIndex, uint256 gasUsed, bytes result)"
  ]);

  const topics = [
    [
      ethers.id("CallExecuted(uint256,bool,bytes)"),
      ethers.id("CallSuccess(uint256,address,address,uint256,uint256,bytes)"),
      ethers.id("CallFailed(uint256,address,address,uint256,uint256,bytes)")
    ]
  ];

  try {
    const logs = await provider.getLogs({
      address: schedulerAddr,
      topics: topics,
      fromBlock: startBlock,
      toBlock: currentBlock
    });

    console.log(`Found ${logs.length} execution logs in the last 15,000 blocks.`);

    logs.forEach((log) => {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(`\n[${parsed.name}] CallId: #${parsed.args.callId || parsed.args[0]} at block ${log.blockNumber}`);
          if (parsed.args.target) console.log(`  Target: ${parsed.args.target}`);
          if (parsed.args.payer) console.log(`  Payer: ${parsed.args.payer}`);
          if (parsed.args.success !== undefined) console.log(`  Success: ${parsed.args.success}`);
          if (parsed.args.gasUsed) console.log(`  GasUsed: ${parsed.args.gasUsed}`);
        }
      } catch (err) {
        // Skip
      }
    });

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
