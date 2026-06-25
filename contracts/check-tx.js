const { ethers } = require('ethers');

async function checkTx() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const TX_HASH = deployment.startAgentTx;
  const CONTRACT = deployment.contractAddress;
  const OWNER    = '0x75E698390F225568510DB5b56B34EA4C94AA3b9d';

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         KIỂM TRA GIAO DỊCH (TRANSACTION)            ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log("TX Hash:", TX_HASH, "\n");

  const tx = await provider.getTransaction(TX_HASH);
  if (!tx) {
    console.log("❌ KHÔNG TÌM THẤY giao dịch này trên mạng Ritual Testnet.");
    return;
  }

  const receipt = await provider.getTransactionReceipt(TX_HASH);

  console.log("=== THÔNG TIN GIAO DỊCH ===");
  console.log("Từ (From):", tx.from);
  console.log("Đến (To): ", tx.to);
  console.log("Giá trị (Value):", ethers.formatEther(tx.value), "RITUAL");
  console.log("Block Number:", tx.blockNumber);
  console.log("Gas Limit:", tx.gasLimit?.toString());
  console.log("Status:", receipt?.status === 1 ? "✅ THÀNH CÔNG" : "❌ THẤT BẠI");
  console.log("Gas đã dùng:", receipt?.gasUsed?.toString());
  console.log("Logs (events):", receipt?.logs?.length || 0, "sự kiện");

  console.log("\n=== ĐÁNH GIÁ ĐỒng BỘ ===");

  const fromOwner = tx.from.toLowerCase() === OWNER.toLowerCase();
  const toContract = tx.to?.toLowerCase() === CONTRACT.toLowerCase();
  const fromContract = tx.from.toLowerCase() === CONTRACT.toLowerCase();
  const isRelated = fromOwner || toContract || fromContract;

  if (fromOwner && toContract) {
    console.log("✅ Giao dịch này: CHỦ SỞ HỮU → HỢP ĐỒNG TÁC NHÂN");
    console.log("   → Đây là giao dịch TRỰC TIẾP liên quan đến tác nhân của bạn!");
  } else if (fromOwner) {
    console.log("✅ Giao dịch này được gửi TỪ Ví của bạn");
    console.log("   Đến:", tx.to);
  } else if (toContract) {
    console.log("✅ Giao dịch này được gửi ĐẾN Hợp đồng tác nhân");
    console.log("   Từ:", tx.from);
  } else {
    console.log("⚠️  Giao dịch này KHÔNG liên quan trực tiếp đến Tác nhân hoặc Ví của bạn.");
    console.log("   From:", tx.from);
    console.log("   To:  ", tx.to);
  }

  // Decode function selector
  if (tx.data && tx.data.length >= 10) {
    const selector = tx.data.slice(0, 10);
    const knownSelectors = {
      '0xb6b55f25': 'deposit(uint256)',
      '0x12065fe0': 'getBalance()',
      '0x6a627842': 'mint(address)',
      '0x60806040': '(deploy constructor)',
      '0x4e9f5e62': 'setRequest(bytes)',
      '0x9a9e3b6e': 'startAgent(uint32,uint32,uint32,uint256)',
      '0xd0e30db0': 'deposit()',
    };
    const decoded = knownSelectors[selector] || 'Unknown function (' + selector + ')';
    console.log("\n   Hàm được gọi:", decoded);
  }

  console.log("\n=== TÓM TẮT ===");
  if (receipt?.status === 1 && isRelated) {
    console.log("🟢 Giao dịch ĐÃ ĐỒNG BỘ với tác nhân và THÀNH CÔNG trên blockchain.");
  } else if (receipt?.status === 1 && !isRelated) {
    console.log("🟡 Giao dịch THÀNH CÔNG nhưng KHÔNG liên quan đến tác nhân của bạn.");
  } else {
    console.log("🔴 Giao dịch THẤT BẠI hoặc không tìm thấy.");
  }
}

checkTx().catch(e => console.error("Lỗi:", e.message));

// Also check deployment transactions
async function checkAllAgentTxs() {
  const { ethers } = require('ethers');
  const fs = require('fs');
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  console.log("\n=== KIỂM TRA CÁC GIAO DỊCH CỦA TÁC NHÂN ===");
  try {
    const deployment = JSON.parse(fs.readFileSync('./build/deployment.json', 'utf8'));
    console.log("Deploy TX:", deployment.startAgentTx || "(không có)");
    if (deployment.startAgentTx) {
      const r = await provider.getTransactionReceipt(deployment.startAgentTx);
      console.log("Deploy TX Status:", r?.status === 1 ? "✅ Hợp lệ" : "❌ Thất bại");
    }
  } catch(e) {}
}
