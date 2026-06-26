// The Scheduler uses different event names than expected. 
// Let's reverse-engineer the unknown topics by checking Ritual's open source code.
// Meanwhile let's decode raw topic data:
// UNKNOWN_A: 0x6973f65... - has callId + target in topics, data has gasUsed-like fields (30 bytes)
// UNKNOWN_B: 0x9506817... - has callId + target + payer in topics (success pattern?)
// UNKNOWN_C: 0xc4cf7a7... - has callId + target + payer in topics
//
// Let's check what UNKNOWN_B and UNKNOWN_C decode to
const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';

  // Get a sample UNKNOWN_B log and decode it
  const currentBlock = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: schedulerAddr,
    topics: ['0x9506817bdcab92f3c10c7d4e11914b441c1ed4be7c03e4f1ca40b538cbe0df18'],
    fromBlock: currentBlock - 100,
    toBlock: currentBlock
  });

  if (logs.length > 0) {
    const log = logs[0];
    console.log('Sample UNKNOWN_B log:');
    console.log('  Topics:', log.topics);
    console.log('  Data:', log.data);

    const callId = BigInt(log.topics[1]);
    const target = '0x' + log.topics[2].slice(26);
    const payer = '0x' + log.topics[3].slice(26);
    console.log(`  callId: #${callId}`);
    console.log(`  target: ${target}`);
    console.log(`  payer: ${payer}`);

    // Decode data: try as (uint256 gasUsed, uint256 executionIndex, uint256 callsMade)
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ['uint256', 'uint256', 'uint256'],
        log.data
      );
      console.log(`  decoded[0] = ${decoded[0]} (possibly gasUsed or blockNumber)`);
      console.log(`  decoded[1] = ${decoded[1]} (possibly executionIndex)`);
      console.log(`  decoded[2] = ${decoded[2]} (possibly callsMade)`);
    } catch (e) {
      console.log('  decode failed:', e.message);
    }
  }

  // Also get UNKNOWN_A
  const logsA = await provider.getLogs({
    address: schedulerAddr,
    topics: ['0x6973f65d18f5d87929a2bb8f001d58f78e132fe5da7e9d9f005dd7e874c0a207'],
    fromBlock: currentBlock - 100,
    toBlock: currentBlock
  });

  if (logsA.length > 0) {
    const log = logsA[0];
    console.log('\nSample UNKNOWN_A log:');
    console.log('  Topics:', log.topics);
    console.log('  Data:', log.data);
    const callId = BigInt(log.topics[1]);
    const target = '0x' + log.topics[2].slice(26);
    console.log(`  callId: #${callId}`);
    console.log(`  target: ${target}`);

    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ['bool', 'bytes'],
        log.data
      );
      console.log(`  bool decoded[0] = ${decoded[0]}`);
      console.log(`  bytes decoded[1] = ${decoded[1].slice(0, 100)}`);
    } catch (e) {
      console.log('  decode as bool+bytes failed:', e.message);
    }
  }
}

main().catch(console.error);
