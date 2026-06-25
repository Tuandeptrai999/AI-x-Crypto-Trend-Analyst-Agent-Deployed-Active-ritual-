const { ethers } = require('ethers');
const fs = require('fs');

async function fullCheck() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });

  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const CONTRACT = deployment.contractAddress;
  const OWNER_WALLET = '0x75E698390F225568510DB5b56B34EA4C94AA3b9d';
  const SCHEDULER = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const RITUAL_WALLET = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';

  const abi = [
    "function owner() view returns (address)",
    "function walletBalance() view returns (uint256)",
    "function activeScheduleId() view returns (uint256)",
    "function executionCount() view returns (uint256)",
    "function lastJobId() view returns (bytes32)",
    "function lastThought() view returns (string)",
    "function lastAction() view returns (string)",
    "function encodedRequest() view returns (bytes)"
  ];

  const schedulerAbi = [
    "function getCall(uint256) view returns (tuple(address target, bytes data, uint32 gas, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 ttl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, address payer, uint32 callsMade, bool cancelled))"
  ];

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║     KIỂM TRA TOÀN DIỆN TÁC NHÂN RITUAL TESTNET      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // 1. Network
  const block = await provider.getBlockNumber();
  console.log("✅ [1] KẾT NỐI MẠNG LƯỚI");
  console.log("   Mạng:       Ritual Testnet (Chain ID: 1979)");
  console.log("   Block hiện tại:", block);
  
  // 2. Ví chủ
  const balance = await provider.getBalance(OWNER_WALLET);
  console.log("\n✅ [2] VÍ DEPLOY (CHỦ TÁC NHÂN)");
  console.log("   Địa chỉ:", OWNER_WALLET);
  console.log("   Số dư:   ", ethers.formatEther(balance), "RITUAL");

  // 3. Contract
  const code = await provider.getCode(CONTRACT);
  console.log("\n✅ [3] HỢP ĐỒNG THÔNG MINH (Smart Contract)");
  console.log("   Địa chỉ:", CONTRACT);
  console.log("   Bytecode:", code.length > 4 ? `✅ Đã deploy (${code.length/2} bytes)` : "❌ Không tìm thấy");

  // 4. Contract state
  const contract = new ethers.Contract(CONTRACT, abi, provider);
  const owner = await contract.owner();
  const walletBal = await contract.walletBalance();
  const schedId = await contract.activeScheduleId();
  const execCount = await contract.executionCount();
  const lastJobId = await contract.lastJobId();
  const encodedReq = await contract.encodedRequest();
  const thought = await contract.lastThought();
  const action = await contract.lastAction();

  console.log("\n✅ [4] TRẠNG THÁI HỢP ĐỒNG");
  console.log("   Owner:              ", owner);
  console.log("   Ritual Wallet Bal:  ", ethers.formatEther(walletBal), "RITUAL (để trả phí gas)");
  console.log("   Encoded Request:    ", encodedReq.length > 2 ? `✅ Đã lưu (${encodedReq.length/2} bytes)` : "❌ Chưa có");
  console.log("   Active Schedule ID: ", schedId.toString() !== '0' ? `✅ #${schedId.toString()}` : "❌ Chưa kích hoạt");
  console.log("   Số lần đã thực thi:", execCount.toString());
  console.log("   Last Job ID:        ", lastJobId !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? lastJobId : "(chưa có - đang chờ)");
  console.log("   Last Thought:       ", thought || "(chưa có - đang chờ TEE)");
  console.log("   Last Action:        ", action || "(chưa có)");

  // 5. Scheduler check via events
  console.log("\n✅ [5] LỊCH TRÌNH TỰ ĐỘNG (Scheduler)");
  const filter = {
    address: CONTRACT,
    topics: [ethers.id("Scheduled(uint256,uint32,uint32)")],
    fromBlock: block - 50000 > 0 ? block - 50000 : 0,
    toBlock: block
  };
  const events = await provider.getLogs(filter);
  if (events.length > 0) {
    console.log(`   ✅ Tìm thấy ${events.length} sự kiện Scheduled`);
    const last = events[events.length - 1];
    console.log("   Tx hash:", last.transactionHash);
    console.log("   Block: ", last.blockNumber);
  } else {
    console.log("   ⚠️  Không tìm thấy event Scheduled trong 50000 blocks gần nhất");
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                  TỔNG KẾT ĐÁNH GIÁ                  ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  const checks = {
    "Kết nối mạng Ritual Testnet": true,
    "Ví chủ có số dư": parseFloat(ethers.formatEther(balance)) > 0,
    "Contract đã deploy": code.length > 4,
    "Owner đúng ví của bạn": owner.toLowerCase() === OWNER_WALLET.toLowerCase(),
    "Ritual Wallet đã nạp tiền": parseFloat(ethers.formatEther(walletBal)) > 0,
    "Payload (encodedRequest) đã lưu": encodedReq.length > 2,
    "Scheduler đang chạy (ID > 0)": schedId.toString() !== '0'
  };

  let allOk = true;
  for (const [key, val] of Object.entries(checks)) {
    console.log(`   ${val ? '✅' : '❌'} ${key}`);
    if (!val) allOk = false;
  }

  console.log("\n" + (allOk ? "🟢 TẤT CẢ OK! Tác nhân đã sẵn sàng và đang hoạt động." : "🔴 CÓ LỖI CẦN SỬA!"));
  console.log("   Đang chờ Scheduler kích hoạt wakeUp() sau ~500 blocks...\n");
}

fullCheck().catch(e => { console.error("LỖI:", e.message); });
