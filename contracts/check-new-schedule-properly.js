const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const callId = parseInt(deployment.scheduleId);
  console.log(`Querying Scheduler for Call ID: #${callId}...`);
  
  const abi = [
    "function calls(uint256) view returns (address target, address payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint32 callsMade, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data, bool cancelled)"
  ];
  
  const scheduler = new ethers.Contract(schedulerAddr, abi, provider);
  
  try {
    const callInfo = await scheduler.calls(callId);
    console.log("\n=== SCHEDULER CALL INFO ===");
    console.log("Target:             ", callInfo.target);
    console.log("Payer:              ", callInfo.payer);
    console.log("Start Block:        ", callInfo.startBlock.toString());
    console.log("Num Calls:          ", callInfo.numCalls.toString());
    console.log("Frequency:          ", callInfo.frequency.toString());
    console.log("Gas Limit:          ", callInfo.gas.toString());
    console.log("TTL:                ", callInfo.ttl.toString());
    console.log("Calls Made:         ", callInfo.callsMade.toString());
    console.log("Max Fee Per Gas:    ", ethers.formatUnits(callInfo.maxFeePerGas, 'gwei'), "gwei");
    console.log("Max Priority Fee:   ", callInfo.maxPriorityFeePerGas.toString());
    console.log("Value:              ", callInfo.value.toString());
    console.log("Data Length:        ", callInfo.data.length);
    console.log("Cancelled:          ", callInfo.cancelled);
    
    const currentBlock = await provider.getBlockNumber();
    console.log("\n=== NETWORK STATUS ===");
    console.log("Current Block:      ", currentBlock);
    
    const maxEndBlock = parseInt(callInfo.startBlock) + (parseInt(callInfo.frequency) * parseInt(callInfo.numCalls));
    console.log("Lifespan End Block: ", maxEndBlock.toString());
    
    if (currentBlock > maxEndBlock) {
      console.log("⚠️  Trạng thái: Lịch trình đã chạy hết thời gian hiệu lực (Lifespan expired)!");
    } else {
      console.log("🟢 Trạng thái: Lịch trình vẫn đang trong thời gian hiệu lực.");
    }
  } catch (e) {
    console.error("Failed to query scheduler info:", e.message);
  }
}

main();
