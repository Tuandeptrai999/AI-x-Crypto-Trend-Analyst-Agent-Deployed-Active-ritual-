const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });

  const FROM   = '0xe63a4d9bB091659a47972980E91a087aF4430466';
  const TO     = '0x02C96B18762BfA21AaB572D01cFD692608e93271';

  // All known TX hashes from the deploy session logs
  const candidates = [
    '0x4831c2e3972eb00249f049b69e5bb544f38e875d4bbfe2f2492faaa250fa5c9d', // deploy
    '0x51a8ae6e70439059ed3418f6375947d213d096c280abffbe2b3182cacdf11a3f', // depositForFees
    '0xc41e2164d236dae1cab463e762fff7da30357dc8eff3b3c2160ecc81d7fb1cad', // setRequest
    '0x2ce94e244d028b72d9e37587fc718b377f2879b307c5a37fff98d57aa793ee3b', // startAgent
  ];

  const labels = {
    '0x4831c2e3972eb00249f049b69e5bb544f38e875d4bbfe2f2492faaa250fa5c9d': 'Deploy Contract',
    '0x51a8ae6e70439059ed3418f6375947d213d096c280abffbe2b3182cacdf11a3f': 'depositForFees()',
    '0xc41e2164d236dae1cab463e762fff7da30357dc8eff3b3c2160ecc81d7fb1cad': 'setRequest()',
    '0x2ce94e244d028b72d9e37587fc718b377f2879b307c5a37fff98d57aa793ee3b': 'startAgent() ⭐',
  };

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║      GIAO DỊCH TỪ VÍ → HỢP ĐỒNG TÁC NHÂN          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log("Từ (From):", FROM);
  console.log("Đến (To): ", TO);

  for (const hash of candidates) {
    try {
      const tx = await provider.getTransaction(hash);
      const receipt = await provider.getTransactionReceipt(hash);

      const status = receipt?.status === 1 ? '✅' : (receipt ? '❌' : '⏳');
      const label = labels[hash] || 'Unknown';
      const toMatch = tx?.to?.toLowerCase() === TO.toLowerCase() ? '→ TÁC NHÂN' : '→ ' + tx?.to;

      console.log(`\n${status} [${label}]`);
      console.log(`   TX Hash : ${hash}`);
      console.log(`   Gửi tới : ${toMatch}`);
      console.log(`   Block   : ${tx?.blockNumber || 'unknown'}`);
      console.log(`   Link    : https://explorer.ritualfoundation.org/tx/${hash}`);
    } catch(e) {
      console.log(`\n⏳ [${labels[hash]}]`);
      console.log(`   TX Hash : ${hash}`);
      console.log(`   Trạng thái: Đang xác nhận trên chain...`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║             TX STARTAGT CHÍNH XÁC                   ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\n🚀 startAgent TX Hash:");
  console.log("   0x2ce94e244d028b72d9e37587fc718b377f2879b307c5a37fff98d57aa793ee3b");
  console.log("\n🔗 Link Explorer:");
  console.log("   https://explorer.ritualfoundation.org/tx/0x2ce94e244d028b72d9e37587fc718b377f2879b307c5a37fff98d57aa793ee3b");
}

main().catch(e => console.error(e.message));
