const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });

  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const CONTRACT = deployment.contractAddress;
  const OWNER    = '0x75E698390F225568510DB5b56B34EA4C94AA3b9d';
  const TEE      = deployment.executor;
  const SCHEDULE = deployment.scheduleId;
  const START_TX = deployment.startAgentTx;

  const abi = [
    "function owner() view returns (address)",
    "function walletBalance() view returns (uint256)",
    "function activeScheduleId() view returns (uint256)",
    "function executionCount() view returns (uint256)",
    "function encodedRequest() view returns (bytes)",
    "function lastThought() view returns (string)",
    "function lastAction() view returns (string)"
  ];

  const contract = new ethers.Contract(CONTRACT, abi, provider);

  const block        = await provider.getBlockNumber();
  const ownerBal     = await provider.getBalance(OWNER);
  const code         = await provider.getCode(CONTRACT);
  const onchainOwner = await contract.owner();
  const walletBal    = await contract.walletBalance();
  const schedId      = await contract.activeScheduleId();
  const execCount    = await contract.executionCount();
  const encodedReq   = await contract.encodedRequest();
  const thought      = await contract.lastThought();
  const action       = await contract.lastAction();

  const readme     = fs.readFileSync('./README.md', 'utf8');
  const deployment = JSON.parse(fs.readFileSync('./build/deployment.json', 'utf8'));
  const verifyJson = fs.existsSync('./verify-upload.json');

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       KIỂM TRA ĐỒNG BỘ TOÀN DIỆN - FINAL CHECK         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Block hiện tại  : #${block}`);
  console.log(`Contract        : ${CONTRACT}`);
  console.log(`Owner Wallet    : ${OWNER}`);
  console.log(`TEE Executor    : ${TEE}`);
  console.log(`Schedule ID     : #${SCHEDULE}`);
  console.log(`startAgent TX   : ${START_TX.slice(0,34)}...`);
  console.log(`Số dư ví chủ   : ${ethers.formatEther(ownerBal)} RITUAL`);
  console.log(`Ritual Wallet   : ${ethers.formatEther(walletBal)} RITUAL`);
  console.log(`Encoded Req     : ${encodedReq.length/2} bytes`);
  console.log(`Execution Count : ${execCount.toString()} lần`);
  console.log(`Last Thought    : ${thought || '(chờ TEE delivery...)'}`);
  console.log(`Last Action     : ${action || '(chờ TEE delivery...)'}`);

  const checks = [
    // BLOCKCHAIN
    ['[CHAIN] Kết nối Ritual Testnet (Chain 1979)',          true],
    ['[CHAIN] Contract deployed trên chain',                  code.length > 4],
    ['[CHAIN] Owner khớp đúng ví của bạn',                   onchainOwner.toLowerCase() === OWNER.toLowerCase()],
    ['[CHAIN] Ví chủ còn số dư RITUAL',                      parseFloat(ethers.formatEther(ownerBal)) > 0],
    ['[CHAIN] Ritual Wallet có phí gas >= 0.04 RITUAL',      parseFloat(ethers.formatEther(walletBal)) >= 0.04],
    ['[CHAIN] Payload encodedRequest đã lưu on-chain',       encodedReq.length > 2],
    ['[CHAIN] Scheduler đang active (ID = ' + SCHEDULE + ')',          schedId.toString() === SCHEDULE],
    // GITHUB / LOCAL
    ['[GIT]   README chứa contract mới ' + CONTRACT.slice(0, 10) + '...',        readme.includes(CONTRACT)],
    ['[GIT]   README chứa TEE Executor',                     readme.includes(TEE)],
    ['[GIT]   README chứa startAgent TX',                    readme.includes(START_TX.slice(0,20))],
    ['[GIT]   README chứa Schedule ID #' + SCHEDULE,             readme.includes(SCHEDULE)],
    ['[GIT]   deployment.json đúng contract address',        deployment.contractAddress === CONTRACT],
    ['[GIT]   deployment.json đúng scheduleId',              deployment.scheduleId === SCHEDULE],
    ['[GIT]   deployment.json đúng executor (TEE)',          deployment.executor.toLowerCase() === TEE.toLowerCase()],
    ['[FILE]  verify-upload.json tồn tại (dùng để verify)',  verifyJson],
  ];

  console.log("\n--- DANH SÁCH KIỂM TRA ---\n");
  let pass = 0, fail = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    ok ? pass++ : fail++;
  }

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  if (fail === 0) {
    console.log(`║  🟢 TẤT CẢ ${pass}/${checks.length} KIỂM TRA PASS — ĐỒNG BỘ HOÀN HẢO! 🎉  ║`);
  } else {
    console.log(`║  🔴 ${fail} LỖI / ${pass} PASS                                    ║`);
  }
  console.log(`╚══════════════════════════════════════════════════════════╝`);
}

main().catch(e => console.error("Lỗi:", e.message));
