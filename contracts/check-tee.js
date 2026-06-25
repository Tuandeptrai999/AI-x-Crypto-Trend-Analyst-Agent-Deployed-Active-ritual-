const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  
  const TEE_FROM_SCREENSHOT = '0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C';
  const TEE_REGISTRY = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F';
  
  const deployment = JSON.parse(fs.readFileSync('./build/deployment.json', 'utf8'));
  
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║          KIỂM TRA TEE EXECUTOR ĐỒNG BỘ              ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log("TEE trong ảnh bạn cung cấp:");
  console.log("  →", TEE_FROM_SCREENSHOT);
  
  console.log("\nTEE được lưu trong deployment.json (dùng khi Deploy):");
  console.log("  →", deployment.executor);
  
  const match = TEE_FROM_SCREENSHOT.toLowerCase() === deployment.executor.toLowerCase();
  console.log("\n=== KẾT QUẢ ===");
  console.log(match 
    ? "✅ HOÀN TOÀN ĐỒNG BỘ! TEE Executor khớp 100% với tác nhân đã deploy."
    : "❌ KHÔNG KHỚP! TEE Executor trong ảnh khác với tác nhân đã deploy.");

  // Also query live from registry
  const registryAbi = [
    `function getServicesByCapability(uint8,bool) external view returns (
      tuple(
        tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node,
        bool isValid,
        bytes32 workloadId
      )[]
    )`
  ];
  
  const registry = new ethers.Contract(TEE_REGISTRY, registryAbi, provider);
  const services = await registry.getServicesByCapability(0, true);
  
  console.log("\n=== TEE REGISTRY TRỰC TIẾP TRÊN CHAIN ===");
  console.log(`Tổng số TEE Executor đang active: ${services.length}`);
  
  for (let i = 0; i < services.length; i++) {
    const addr = services[i].node.teeAddress;
    const isMatch = addr.toLowerCase() === TEE_FROM_SCREENSHOT.toLowerCase();
    console.log(`  [${i}] ${addr} ${isMatch ? '← ✅ ĐÚNG CÁI NÀY!' : ''}`);
  }

  console.log("\n=== TỔNG KẾT ĐẦY ĐỦ ===");
  console.log("Ví Deploy (Owner) :", "0xe63a4d9bB091659a47972980E91a087aF4430466");
  console.log("Contract Agent     :", deployment.contractAddress);
  console.log("TEE Executor       :", deployment.executor);
  console.log("Schedule ID        :", "#" + deployment.scheduleId);
  console.log("startAgent TX      :", deployment.startAgentTx);
  console.log("Deployed At        :", deployment.deployedAt);
  console.log("\n→ TEE trong ảnh khớp:", match ? "✅ YES" : "❌ NO");
}

main().catch(e => console.error(e.message));
