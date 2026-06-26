const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const contractAddr = '0x3BcDa307cFA37037AC3037c5f661909dBc9Bd9a4';
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = 37519300; // block around when we started the agent
  const BATCH_SIZE = 80000;
  
  console.log(`Scanning Scheduler logs for target/payer = ${contractAddr} from block ${startBlock} to ${currentBlock}...`);
  
  try {
    const addrTopic = ethers.zeroPadValue(contractAddr, 32).toLowerCase();
    const allLogsMap = new Map();
    
    for (let from = startBlock; from <= currentBlock; from += BATCH_SIZE) {
      const to = Math.min(from + BATCH_SIZE - 1, currentBlock);
      console.log(`  Scanning block range [${from}, ${to}]...`);
      
      // Query target
      const targetLogs = await provider.getLogs({
        address: schedulerAddr,
        topics: [null, null, addrTopic],
        fromBlock: from,
        toBlock: to
      });
      
      // Query payer
      const payerLogs = await provider.getLogs({
        address: schedulerAddr,
        topics: [null, null, null, addrTopic],
        fromBlock: from,
        toBlock: to
      });
      
      [...targetLogs, ...payerLogs].forEach(log => {
        const key = `${log.transactionHash}-${log.logIndex}`;
        allLogsMap.set(key, log);
      });
    }
    
    const logs = Array.from(allLogsMap.values());
    console.log(`\nFound ${logs.length} total events related to our contract!`);
    
    const knownTopics = {
      '0xcaca4474e4e795729bb2ff72d20cbac301679d1329458aba9cc4a52235266949': 'CallScheduled',
      '0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207': 'CallCancelled',
      '0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18': 'CallSuccess',
      '0xae22d5dfcdd8d71d3326f8a32787e3f702adbb3386e3fb6b19a88aa451c878bd': 'CallFailed'
    };
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const eventName = knownTopics[log.topics[0]] || 'UnknownEvent (' + log.topics[0].slice(0, 10) + '...)';
      const callId = BigInt(log.topics[1]).toString();
      
      console.log(`\nEvent ${i}: ${eventName} (Block: ${log.blockNumber}, Tx: ${log.transactionHash.slice(0, 15)}...)`);
      console.log(`  Call ID: #${callId}`);
      
      if (eventName === 'CallFailed') {
        console.log(`  Raw Data:`, log.data);
        // Try decoding revert reason
        try {
          // If the data starts with offset pointers for the string
          // We can slice off the offset and length and decode the string
          const reasonBytes = ethers.dataSlice(log.data, 96);
          const reason = ethers.toUtf8String(reasonBytes).replace(/\u0000/g, '');
          console.log(`  Decoded Revert Reason: "${reason}"`);
        } catch (e) {
          console.log("  Could not decode revert reason:", e.message);
        }
      }
    }
  } catch (e) {
    console.error("Error batching logs:", e);
  }
}

main();
