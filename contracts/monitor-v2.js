// Monitor NEW HomoMimic v2 contract for first execution
// Contract: 0x4D96A9f6A185da08c724EBC6a816f841F2E43A62
// Schedule: #2757247
const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const ourContract = '0x4d96a9f6a185da08c724ebc6a816f841f2e43a62'; // lowercase v2
  const scheduleId = 2757247;
  
  const execTopic = '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207';
  const successTopic = '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18';
  
  // Get block when startAgent was called
  const startBlock = 37726113;
  
  console.log('=============================================================');
  console.log('  🤖 MONITORING HomoMimic v2 - Waiting for Execution...');
  console.log('=============================================================\n');
  console.log(`Contract  : 0x4D96A9f6A185da08c724EBC6a816f841F2E43A62`);
  console.log(`Schedule  : #${scheduleId}`);
  console.log(`Start Block: ${startBlock}`);
  console.log('Expected first execution: block ~37726123 (startBlock + freq=10)');
  console.log('TTL expires: block ~37726623 (startBlock + freq + TTL=500)\n');
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  // Expected execution window
  const expectedExecBlock = startBlock + 10; // startBlock + frequency
  const expiryBlock = expectedExecBlock + 500; // + TTL
  
  if (currentBlock > expiryBlock) {
    console.log('⚠️  WARNING: Execution window may have expired!');
    console.log(`Expected: block ${expectedExecBlock}, expired at block ${expiryBlock}`);
  } else if (currentBlock >= expectedExecBlock) {
    console.log(`✅ Execution window OPEN (blocks ${expectedExecBlock} to ${expiryBlock})`);
  } else {
    console.log(`⏳ Waiting for block ${expectedExecBlock} (currently at ${currentBlock})`);
  }
  
  // Scan from startBlock
  const logs = await provider.getLogs({
    address: schedulerAddr,
    fromBlock: startBlock,
    toBlock: currentBlock
  });
  
  const ourLogs = logs.filter(log => 
    log.topics.some(t => t.toLowerCase().includes(ourContract.slice(2)))
  );
  
  console.log(`\nFound ${ourLogs.length} Scheduler logs for our v2 contract:`);
  
  for (const log of ourLogs) {
    const t0 = log.topics[0];
    const callId = BigInt(log.topics[1]);
    let eventName = 'UNKNOWN';
    if (t0 === execTopic) {
      // Decode bool, uint256
      const success = log.data !== '0x' + '0'.repeat(63) + '0' + '0'.repeat(63) + '0';
      const val0 = BigInt('0x' + log.data.slice(2, 66));
      eventName = `CallExecuted(success=${val0 > 0n})`;
    }
    else if (t0 === successTopic) eventName = '🟢 CallSuccess!';
    
    console.log(`  [${eventName}] CallId: #${callId} at block ${log.blockNumber}`);
    
    if (t0 === successTopic) {
      console.log('\n🎉🎉🎉 AGENT EXECUTED SUCCESSFULLY! 🎉🎉🎉');
    }
  }
  
  if (ourLogs.length === 0) {
    console.log('  No events yet. Check again in a few minutes.');
  }
  
  // Also check the contract state
  const artifact = JSON.parse(fs.readFileSync('build/HomoMimic.json', 'utf8'));
  const c = new ethers.Contract('0x4D96A9f6A185da08c724EBC6a816f841F2E43A62', artifact.abi, provider);
  
  try {
    const execCount = await c.executionCount();
    const lastJobId = await c.lastJobId();
    const activeId = await c.activeScheduleId();
    const lastError = await c.lastWakeError();
    
    console.log('\nContract State:');
    console.log(`  executionCount: ${execCount}`);
    console.log(`  activeScheduleId: #${activeId}`);
    console.log(`  lastJobId: ${lastJobId}`);
    console.log(`  lastWakeError: ${lastError || '(none)'}`);
  } catch(e) {
    console.log('Could not read contract state:', e.message);
  }
}

main().catch(console.error);
