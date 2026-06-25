const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const RPC_URL = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  if (!PRIVATE_KEY) {
    console.error("❌ LỖI: Vui lòng cấu hình PRIVATE_KEY trong file contracts/.env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 1979, name: 'ritual' });
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Tải thông tin deployment cũ
  const deploymentPath = path.resolve(__dirname, 'build/deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ LỖI: Không tìm thấy file build/deployment.json. Hãy đảm bảo bạn chạy script trong thư mục contracts.");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const CONTRACT_ADDRESS = deployment.contractAddress;

  // Tải ABI HomoMimic
  const artifactPath = path.resolve(__dirname, 'build/HomoMimic.json');
  const { abi } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  console.log("=================================================");
  console.log("    KÍCH HOẠT LẠI TÁC NHÂN AI X CRYPTO (RITUAL)   ");
  console.log("=================================================\n");
  console.log(`Đang kết nối bằng ví: ${signer.address}`);
  console.log(`Hợp đồng tác nhân:   ${CONTRACT_ADDRESS}`);

  // 1. Kiểm tra chủ sở hữu hợp đồng
  const owner = await contract.owner();
  console.log(`Chủ sở hữu hiện tại:  ${owner}`);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`\n❌ LỖI: Bạn không phải chủ sở hữu hợp đồng này!`);
    console.error(`Địa chỉ ví của bạn (${signer.address}) khác với chủ sở hữu (${owner}).`);
    console.error(`Hãy chắc chắn bạn đã điền đúng Private Key của ví ${owner} vào file contracts/.env`);
    process.exit(1);
  }

  const walletBal = await provider.getBalance(signer.address);
  console.log(`Số dư ví của bạn:    ${ethers.formatEther(walletBal)} RITUAL`);

  // 2. Nạp thêm phí TEE
  const depositAmount = ethers.parseEther('1.0'); // Nạp 1.0 RITUAL để đảm bảo đủ phí chạy TEE
  if (walletBal < depositAmount) {
    console.error(`\n❌ LỖI: Số dư ví không đủ 1.0 RITUAL để thực hiện nạp phí. Hãy faucet thêm RITUAL.`);
    process.exit(1);
  }

  const feeData = await provider.getFeeData();
  console.log(`\n1️⃣  Đang nạp 1.0 RITUAL vào ví Escrow...`);
  const depTx = await contract.depositForFees({
    value: depositAmount,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
  });
  console.log(`   TX Hash: ${depTx.hash}`);
  await depTx.wait();
  console.log("   ✅ Nạp tiền thành công!");

  const escrowBal = await contract.walletBalance();
  console.log(`   Số dư ví Escrow hiện tại: ${ethers.formatEther(escrowBal)} RITUAL`);

  // 3. Khởi động Agent với Schedule mới
  console.log(`\n2️⃣  Đang gửi lệnh kích hoạt chu kỳ mới (startAgent)...`);
  const frequency = 500;
  const numCalls = 5;
  const gasLimit = 900_000;
  const maxFeePerGas = ethers.parseUnits('20', 'gwei');

  const startTx = await contract.startAgent(frequency, numCalls, gasLimit, maxFeePerGas, {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit: 400_000
  });
  
  console.log(`   TX Hash: ${startTx.hash}`);
  const receipt = await startTx.wait();
  console.log(`   ✅ Tác nhân đã được kích hoạt tại block: ${receipt.blockNumber}`);

  // Đọc Schedule ID mới
  const newSchedId = await contract.activeScheduleId();
  console.log(`   New Schedule ID: #${newSchedId.toString()}`);

  // 4. Lưu lại thông tin deployment mới
  deployment.scheduleId = newSchedId.toString();
  deployment.startAgentTx = startTx.hash;
  deployment.deployedAt = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ Đã cập nhật file build/deployment.json!");
  console.log("\n🎉 HOÀN THÀNH! Tác nhân đã được kích hoạt lại với đủ phí. Hãy đợi tác nhân thực hiện TEE loop.");
}

main().catch(e => {
  console.error("\n❌ Gặp lỗi:", e.message || e);
});
