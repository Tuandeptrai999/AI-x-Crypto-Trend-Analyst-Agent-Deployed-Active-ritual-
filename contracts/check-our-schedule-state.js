const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const schedulerAddr = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
  const fs = require('fs');
  const path = require('path');
  const deployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/deployment.json'), 'utf8'));
  const scheduleId = BigInt(deployment.scheduleId);

  const abi = [
    "function calls(uint256) view returns (address target, address payer, uint32 startBlock, uint32 numCalls, uint32 frequency, uint32 gas, uint32 ttl, uint32 callsMade, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value, bytes data, bool cancelled)"
  ];

  const scheduler = new ethers.Contract(schedulerAddr, abi, provider);

  try {
    const callInfo = await scheduler.calls(scheduleId);
    console.log(`Our Schedule #${scheduleId} Info:`);
    console.log(`  Target:             `, callInfo.target);
    console.log(`  Payer:              `, callInfo.payer);
    console.log(`  Start Block:        `, callInfo.startBlock.toString());
    console.log(`  Num Calls:          `, callInfo.numCalls.toString());
    console.log(`  Frequency:          `, callInfo.frequency.toString());
    console.log(`  Calls Made:         `, callInfo.callsMade.toString());
    console.log(`  Max Fee Per Gas:    `, ethers.formatUnits(callInfo.maxFeePerGas, 'gwei'), "gwei");
    console.log(`  Max Priority Fee:   `, ethers.formatUnits(callInfo.maxPriorityFeePerGas, 'gwei'), "gwei");
    console.log(`  Cancelled:          `, callInfo.cancelled);
  } catch (e) {
    console.log(`Our Schedule #${scheduleId} Query Failed:`, e.message);
  }
}

main();
