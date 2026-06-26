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

  // 2. Kiểm tra số dư Escrow hiện tại và nạp thêm nếu cần
  let escrowBal = await contract.walletBalance();
  console.log(`Số dư ví Escrow hiện tại: ${ethers.formatEther(escrowBal)} RITUAL`);

  const feeData = await provider.getFeeData();
  const MIN_ESCROW_BAL = ethers.parseEther('0.1'); // Cần tối thiểu 0.1 RITUAL trong escrow

  if (escrowBal < MIN_ESCROW_BAL) {
    const depositAmount = ethers.parseEther('0.1'); // Nạp thêm 0.1 RITUAL
    console.log(`\n1️⃣  Số dư Escrow thấp (${ethers.formatEther(escrowBal)} RITUAL). Đang nạp thêm 0.5 RITUAL...`);
    if (walletBal < depositAmount) {
      console.error(`❌ LỖI: Số dư ví không đủ 0.5 RITUAL để thực hiện nạp phí. Hãy faucet thêm RITUAL.`);
      process.exit(1);
    }
    
    const depTx = await contract.depositForFees({
      value: depositAmount,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    });
    console.log(`   TX Hash: ${depTx.hash}`);
    await depTx.wait();
    console.log("   ✅ Nạp tiền thành công!");
    escrowBal = await contract.walletBalance();
    console.log(`   Số dư ví Escrow mới: ${ethers.formatEther(escrowBal)} RITUAL`);
  } else {
    console.log(`\n1️⃣  Số dư Escrow hiện tại (${ethers.formatEther(escrowBal)} RITUAL) đã đủ dùng. Bỏ qua bước nạp tiền.`);
  }

  // 3. Hủy bỏ Schedule cũ nếu có
  const activeSchedId = await contract.activeScheduleId();
  if (activeSchedId.toString() !== '0') {
    console.log(`\n2️⃣  Phát hiện Schedule ID cũ #${activeSchedId.toString()} đang hoạt động. Đang hủy...`);
    const stopTx = await contract.stopAgent({
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      gasLimit: 300_000
    });
    console.log(`   TX Hash: ${stopTx.hash}`);
    await stopTx.wait();
    console.log("   ✅ Đã hủy chu kỳ cũ thành công!");
  }

  // 4. Khởi động Agent với Schedule mới
  console.log(`\n3️⃣  Đang gửi lệnh kích hoạt chu kỳ mới (startAgent)...`);
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
