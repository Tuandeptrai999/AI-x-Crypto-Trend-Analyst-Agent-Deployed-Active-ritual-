// Great findings:
// 1. CallSuccess events ARE happening for frequency=10 schedules (e.g. #2756896, #2756897)
// 2. Our schedule #2756671 has 0 CallExecuted events since it was registered in block 37713416
//    - This means the relayer hasn't even TRIED to execute it yet
// 3. The TTL=500 blocks from our schedule means it should still be live
//    - Start block: 37713426
//    - numCalls: 5, frequency: 10 => last execution at 37713426 + 5*10 = 37713476
//    - TTL=500 means each call expires 500 blocks after startBlock 
//    - TTL seems to be used differently - maybe it's TTL after each call's startBlock
//
// Why isn't our schedule being executed?
// The CallSuccess events happen in separate "relay transactions" from address 0x000000000000000000000000000000000000fa7e
// The relayer is executing other schedules but not ours.
//
// PROBLEM: Our schedule has startBlock = 37713426 (which was current block + frequency=10 = 37713426)
//          As of now we're at block 37718000+, which is 4574 blocks past our startBlock
//          TTL=500 means the call window for each execution expired 500 blocks after its expected execution
//          Our schedule was supposed to execute from 37713436, 37713446, 37713456, ...
//          But none of those windows were served by the relayer
//          At block 37713436 + 500 = 37713936, the first call expired!
//
// CONCLUSION: The schedule has already EXPIRED. We need to create a new schedule.
// The startBlock should NOT be too far in the past.
// 
// FIX: Create a NEW schedule right now with:
//   startBlock = currentBlock + 2 (very soon)
//   frequency = 10 (fast execution)
//   numCalls = 5
//   TTL = 5000 (much larger TTL to survive relayer latency)

const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  // Check our current schedule state
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const scheduleId = BigInt(deployment.scheduleId);

  const abi = [
    "function calls(uint256) view returns (address target, address payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint32 callsMade, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data, bool cancelled)"
  ];
  const scheduler = new ethers.Contract(schedulerAddr, abi, provider);

  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  const callInfo = await scheduler.calls(scheduleId);
  const startBlock = Number(callInfo.startBlock);
  const ttl = Number(callInfo.ttl);
  const frequency = Number(callInfo.frequency);
  const numCalls = Number(callInfo.numCalls);
  const callsMade = Number(callInfo.callsMade);
  
  console.log(`Schedule #${scheduleId}:`);
  console.log(`  Start Block: ${startBlock}`);
  console.log(`  Frequency: ${frequency}`);
  console.log(`  Num Calls: ${numCalls}`);
  console.log(`  TTL: ${ttl}`);
  console.log(`  Calls Made: ${callsMade}`);
  console.log(`  Cancelled: ${callInfo.cancelled}`);
  
  // Check if expired
  for (let i = 0; i < numCalls - callsMade; i++) {
    const execBlock = startBlock + (callsMade + i) * frequency;
    const expiryBlock = execBlock + ttl;
    const isExpired = currentBlock > expiryBlock;
    console.log(`  Call ${callsMade + i + 1}: expected at block ${execBlock}, TTL expires at ${expiryBlock} -> ${isExpired ? 'EXPIRED' : 'STILL LIVE'}`);
  }
}

main().catch(console.error);
