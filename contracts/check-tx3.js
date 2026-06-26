const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  const inputTx = '0x288dca6d5a3ce5361a66e3ae32b4c8521bbe5236627518cb4a1e6e655e164f4b';
  
  // All known TX hashes from both deployments
  const knownTxs = {
    // New contract (0x80482d...)
    '0x4831c2e3972eb00249f049b69e5bb544f38e875d4bbfe2f2492faaa250fa5c9d': '🆕 DEPLOY Contract mới (0x80482d...)',
    '0x51a8ae6e70439059ed3418f6375947d213d096c280abffbe2b3182cacdf11a3f': '💰 depositForFees() - Nạp 0.05 RITUAL vào ví phí',
    '0xc41e2164d236dae1cab463e762fff7da30357dc8eff3b3c2160ecc81d7fb1cad': '📋 setRequest() - Lưu Payload Agent lên chain',
    '0x2ce94e244d028b72d9e37587fc718b377f2879b307c5a37fff98d57aa793ee3b': '🚀 startAgent() - Kích hoạt Scheduler #2728872',
  };
  
  console.log("=== PHÂN TÍCH TX BẠN CUNG CẤP ===\n");
  console.log("TX:", inputTx);
  
  if (knownTxs[inputTx]) {
    console.log("✅ KHỚP! Đây là:", knownTxs[inputTx]);
  } else {
    console.log("⚠️  Không khớp với TX nào của Contract MỚI");
    console.log("   → Thử kiểm tra trực tiếp trên chain...\n");
    
    try {
      const tx = await provider.getTransaction(inputTx);
      if (tx) {
        const receipt = await provider.getTransactionReceipt(inputTx);
        console.log("Tìm thấy TX!");
        console.log("From:", tx.from);
        console.log("To:  ", tx.to);
        console.log("Value:", ethers.formatEther(tx.value), "RITUAL");
        console.log("Status:", receipt?.status === 1 ? "✅ Thành công" : "❌ Thất bại");
        console.log("Block:", tx.blockNumber);
        
        // Check which contract
        const OLD_CONTRACT = '0x9581a0f1710E42643393e9f1cDd9709447c21656';
        const NEW_CONTRACT = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451';
        const OWNER = '0xe63a4d9bB091659a47972980E91a087aF4430466';
        
        if (tx.to?.toLowerCase() === OLD_CONTRACT.toLowerCase()) {
          console.log("📌 Giao dịch này thuộc về CONTRACT CŨ (0x9581...)");
        } else if (tx.to?.toLowerCase() === NEW_CONTRACT.toLowerCase()) {
          console.log("📌 Giao dịch này thuộc về CONTRACT MỚI (0x80482d...)");
        } else if (tx.from?.toLowerCase() === OWNER.toLowerCase()) {
          console.log("📌 Giao dịch này được gửi từ VÍ CỦA BẠN");
        }
      } else {
        console.log("❌ Không tìm thấy TX trên Ritual Testnet.");
        console.log("   → TX này có thể thuộc mạng khác (Mainnet, Ethereum, BSC...)");
      }
    } catch(e) {
      console.log("Lỗi khi truy vấn:", e.message);
    }
  }
  
  console.log("\n=== CÁC GIAO DỊCH CHÍNH CỦA TÁC NHÂN ===");
  for (const [hash, desc] of Object.entries(knownTxs)) {
    try {
      const r = await provider.getTransactionReceipt(hash);
      const status = r ? (r.status === 1 ? "✅" : "❌") : "⏳";
      console.log(`\n${status} ${desc}`);
      console.log(`   TX: ${hash.slice(0,20)}...`);
    } catch(e) {}
  }
}

main().catch(e => console.error(e.message));
