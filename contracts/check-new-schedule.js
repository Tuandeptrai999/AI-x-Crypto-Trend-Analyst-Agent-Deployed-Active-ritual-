const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const callId = parseInt(deployment.scheduleId);
  console.log(`Querying Scheduler for Call ID: #${callId}...`);
  
  // Custom raw call to decode the calls struct manually since the standard ABI was throwing decode errors
  const iface = new ethers.Interface(["function calls(uint256) view returns (bytes)"]);
  const calldata = iface.encodeFunctionData("calls", [callId]);
  
  try {
    const rawResult = await provider.call({
      to: schedulerAddr,
      data: calldata
    });
    
    // Split raw result into 32-byte chunks (64 hex characters)
    const stripped = rawResult.slice(2); // remove 0x
    const chunks = [];
    for (let i = 0; i < stripped.length; i += 64) {
      chunks.push(stripped.slice(i, i + 64));
    }
    
    if (chunks.length < 15) {
      console.log("Raw result length too short:", rawResult);
      return;
    }
    
    const target = "0x" + chunks[0].slice(24);
    const payer = "0x" + chunks[1].slice(24);
    const startBlock = BigInt("0x" + chunks[2]);
    const numCalls = BigInt("0x" + chunks[3]);
    const frequency = BigInt("0x" + chunks[4]);
    const gas = BigInt("0x" + chunks[5]);
    const ttl = BigInt("0x" + chunks[6]);
    const callsMade = BigInt("0x" + chunks[7]);
    const maxFeePerGas = BigInt("0x" + chunks[8]);
    const maxPriorityFeePerGas = BigInt("0x" + chunks[9]);
    const value = BigInt("0x" + chunks[10]);
    const cancelled = BigInt("0x" + chunks[14]) !== 0n;
    
    console.log("\n=== SCHEDULER CALL INFO ===");
    console.log("Target:             ", target);
    console.log("Payer:              ", payer);
    console.log("Start Block:        ", startBlock.toString());
    console.log("Num Calls:          ", numCalls.toString());
    console.log("Frequency:          ", frequency.toString());
    console.log("Gas Limit:          ", gas.toString());
    console.log("TTL:                ", ttl.toString());
    console.log("Calls Made:         ", callsMade.toString());
    console.log("Max Fee Per Gas:    ", ethers.formatUnits(maxFeePerGas, 'gwei'), "gwei");
    console.log("Max Priority Fee:   ", maxPriorityFeePerGas.toString());
    console.log("Value:              ", value.toString());
    console.log("Cancelled:          ", cancelled);
    
    const currentBlock = await provider.getBlockNumber();
    console.log("\n=== NETWORK STATUS ===");
    console.log("Current Block:      ", currentBlock);
    
    const maxEndBlock = startBlock + (frequency * numCalls);
    console.log("Lifespan End Block: ", maxEndBlock.toString());
    
    if (currentBlock > maxEndBlock) {
      console.log("⚠️  Trạng thái: Lịch trình đã chạy hết thời gian hiệu lực (Lifespan expired)!");
    } else {
      console.log("🟢 Trạng thái: Lịch trình vẫn đang trong thời gian hiệu lực.");
    }
  } catch (e) {
    console.error("Failed to query raw data:", e);
  }
}

main();
