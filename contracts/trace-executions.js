// Now we see the actual relayer transaction format!
// The relayer uses tx type 0x10 (a special Ritual transaction type)
// And the relayer's callId #2756843 with frequency=10, ttl=30, caller=0xc649d1a4...
// That confirms frequency=10 schedules DO get executed by the relayer!
// 
// The problem is: our wakeUp() REVERTS when called, causing the Scheduler to mark our call as failed.
// The error is because Sovereign Agent precompile might fail.
// 
// Let's trace a successful wakeUp() from another agent to compare:
// The successful CallSuccess events target 0x48ba49c2fFee9845E467143feC8Ed7B36A434694
// Let's see what their wakeUp function does (to understand what we're missing)

const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const successTopic = '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18';
  const execTopic = '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207';

  const currentBlock = await provider.getBlockNumber();

  // Find a CallSuccess event for target 0x48ba49c2... to understand what their wakeUp does
  const successLogs = await provider.getLogs({
    address: schedulerAddr,
    topics: [successTopic],
    fromBlock: currentBlock - 500,
    toBlock: currentBlock
  });

  console.log(`Found ${successLogs.length} CallSuccess events.`);
  
  for (const log of successLogs.slice(0, 3)) {
    const callId = BigInt(log.topics[1]);
    const target = '0x' + log.topics[2].slice(26);
    const payer = '0x' + log.topics[3].slice(26);
    
    // Decode data: (uint256 blockNum, uint256 execIndex, uint256 frequency, ...)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      log.data.slice(0, 2 + 6*64) // first 6 uint256s
    );
    
    console.log(`\n[CallSuccess] #${callId}`);
    console.log(`  Target: ${target}`);
    console.log(`  Payer: ${payer}`);
    console.log(`  blockNum: ${decoded[0]}`);
    console.log(`  execIndex: ${decoded[1]}`);
    console.log(`  frequency: ${decoded[2]}`);
    console.log(`  decoded[3]: ${decoded[3]}`);
    console.log(`  decoded[4]: ${decoded[4]}`);
    console.log(`  decoded[5]: ${decoded[5]}`);
  }

  // Also find CallExecuted with bool=false for our schedule #2756671
  const ourLogs = await provider.getLogs({
    address: schedulerAddr,
    topics: [execTopic],
    fromBlock: 37713416,
    toBlock: currentBlock
  });

  const ourContract = '0x2b5cecc6f4b8b07a005bbc8fdd8ea06e7b97c451';
  const ourExecLogs = ourLogs.filter(log => 
    log.topics.some(t => t.toLowerCase().includes(ourContract.slice(2)))
  );
  
  console.log(`\nCallExecuted events for our contract since #2756671: ${ourExecLogs.length}`);
  for (const log of ourExecLogs) {
    const callId = BigInt(log.topics[1]);
    console.log(`  #${callId} at block ${log.blockNumber}: data=${log.data}`);
  }
}

main().catch(console.error);
