// CRITICAL FINDING: 
// CallExecuted(bool,bytes) bool=false means the call to wakeUp() FAILED!
// The UNKNOWN event after CallExecuted with data having 3 uint256 = (startBlock, current, expiry)
// means "Lifespan expired" event
//
// Our schedule #2756526 got CallExecuted with success=false (expired) at block 37711325
// Our schedule #2756570 got CallExecuted with success=false (expired) at block 37713409
//
// The issue: wakeUp() is reverting because:
//   - The Sovereign Agent precompile (0x080C) returns ok=false on testnet
//   - require(ok, "Sovereign agent precompile failed") then reverts
//   - The scheduler marks this as failed/cancelled
//
// Also notice: CallExecuted has data decoded[1] == 3 or 4 == some error code, not success
//
// SOLUTION: Remove the `require(ok, ...)` in wakeUp() and just store the jobId anyway
// OR check if the precompile actually fails and handle it gracefully
//
// Also: UNKNOWN_B event = execution success event (has target + payer + lots of data)
//        We see NO UNKNOWN_B events for our contract = our contract NEVER successfully executed wakeUp

const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  // Let's look at a successful UNKNOWN_B event to understand the pattern
  const successTopic = '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18';
  
  const currentBlock = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: schedulerAddr,
    topics: [successTopic],
    fromBlock: currentBlock - 1000,
    toBlock: currentBlock
  });

  console.log(`Found ${logs.length} CallSuccess events in last 1000 blocks.`);
  
  if (logs.length > 0) {
    const log = logs[0];
    const callId = BigInt(log.topics[1]);
    const target = '0x' + log.topics[2].slice(26);
    const payer = '0x' + log.topics[3].slice(26);
    console.log(`\nSample successful execution:`);
    console.log(`  CallId: #${callId}`);
    console.log(`  Target: ${target}`);
    console.log(`  Payer: ${payer}`);
    console.log(`  Raw data: ${log.data}`);
    
    // Fetch the tx to see who the target is
    const tx = await provider.getTransaction(log.transactionHash);
    console.log(`\nTx from: ${tx?.from}`);
    
    // Now check what wakeUp looks like for a successful execution
    // by getting the tx receipt and contract events
    const receipt = await provider.getTransactionReceipt(log.transactionHash);
    console.log(`  Gas used: ${receipt?.gasUsed}`);
  }

  // Count our CallExecuted(bool=false) for our contract
  const execTopic = '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207';
  const ourLogs = await provider.getLogs({
    address: schedulerAddr,
    topics: [execTopic],
    fromBlock: 37708000,
    toBlock: currentBlock
  });

  const ourContract = '0x2b5cecc6f4b8b07a005bbc8fdd8ea06e7b97c451';
  const ourExecLogs = ourLogs.filter(log => 
    log.topics.some(t => t.toLowerCase().includes(ourContract.slice(2)))
  );

  console.log(`\nCallExecuted events for our contract: ${ourExecLogs.length}`);
  for (const log of ourExecLogs) {
    const callId = BigInt(log.topics[1]);
    // data = [bool success, uint256 errorCode]
    const success = log.data.slice(0, 66) !== '0x' + '0'.repeat(63) + '0';
    const errorCode = BigInt('0x' + log.data.slice(66, 130));
    console.log(`  #${callId} at block ${log.blockNumber}: success=${success}, data=${log.data}`);
    console.log(`  errorCode=${errorCode}`);
  }
}

main().catch(console.error);
