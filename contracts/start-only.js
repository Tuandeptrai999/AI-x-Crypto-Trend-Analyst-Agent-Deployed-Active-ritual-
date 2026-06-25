require('dotenv').config();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');

const RPC_URL     = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = '0x6032697f3445F8157f3CFdF86d224d67341Ee43f';

const { abi } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8')
);

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 1979, name: 'ritual' });
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  const agent    = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  console.log('Contract:', CONTRACT_ADDRESS);

  const feeData = await provider.getFeeData();
  const frequency   = 500;
  const numCalls    = 5;
  const gasLimit    = 900_000;
  const maxFeePerGas = ethers.parseUnits('20', 'gwei');

  console.log('\nCalling startAgent()...');
  const startTx = await agent.startAgent(frequency, numCalls, gasLimit, maxFeePerGas, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             400_000,
  });

  console.log('TX sent:', startTx.hash);
  const startReceipt = await startTx.wait();
  console.log('✅ startAgent confirmed! Block:', startReceipt.blockNumber);

  const schedId = await agent.activeScheduleId();
  console.log('Active schedule ID:', schedId.toString());

  // Update deployment.json
  const deployFile = path.resolve(__dirname, 'build/deployment.json');
  const deployInfo = JSON.parse(fs.readFileSync(deployFile, 'utf8'));
  deployInfo.startAgentTx = startTx.hash;
  deployInfo.scheduleId = schedId.toString();
  fs.writeFileSync(deployFile, JSON.stringify(deployInfo, null, 2));
  console.log('Updated deployment.json with new TX and Schedule ID');
}

main().catch(console.error);
