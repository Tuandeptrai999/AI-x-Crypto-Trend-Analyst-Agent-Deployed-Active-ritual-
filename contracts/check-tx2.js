const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  console.log("=== TẤT CẢ GIAO DỊCH CỦA TÁC NHÂN ===\n");
  
  const deployment = JSON.parse(fs.readFileSync('./build/deployment.json', 'utf8'));
  console.log("Contract:", deployment.contractAddress);
  console.log("startAgent TX:", deployment.startAgentTx);
  console.log("Deployed at:", deployment.deployedAt);
  
  const txs = [deployment.startAgentTx].filter(Boolean);
  
  for (const hash of txs) {
    const r = await provider.getTransactionReceipt(hash);
    console.log(`\nTX: ${hash}`);
    console.log("  Status:", r?.status === 1 ? "✅ Thành công" : "❌ Thất bại");
    console.log("  Block:", r?.blockNumber);
  }
  
  // Check if input TX exists anywhere
  const inputTx = '0x288dca6d5a3ce5361a66e3ae32b4c8521bbe5236627518cb4a1e6e655e164f4b';
  console.log("\n=== KIỂM TRA TX BẠN CUNG CẤP ===");
  console.log("TX Hash:", inputTx);
  
  // Try to match with known transactions
  const knownTxs = {
    [deployment.startAgentTx]: 'startAgent() - Kích hoạt lịch trình tác nhân',
  };
  
  if (knownTxs[inputTx]) {
    console.log("✅ KHỚP! Đây là giao dịch:", knownTxs[inputTx]);
  } else {
    console.log("⚠️  Không khớp với bất kỳ TX nào của tác nhân `0x80482d...`");
    console.log("   TX này có thể thuộc về Contract CŨ: 0x9581a0f1710E42643393e9f1cDd9709447c21656");
  }
}

main().catch(e => console.error(e.message));
