require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Ritual system contracts
const SCHEDULER_ADDRESS = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
const RITUAL_WALLET = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';

if (!PRIVATE_KEY) {
  console.error('ERROR: Set PRIVATE_KEY in .env file');
  process.exit(1);
}

// ─── Load compiled artifact ───────────────────────────────────────────────────
const buildPath = path.resolve(__dirname, 'build', 'AutonomousAgent.json');
if (!fs.existsSync(buildPath)) {
  console.error('ERROR: Build artifact not found. Run: npm run compile');
  process.exit(1);
}

const { abi, bytecode } = JSON.parse(fs.readFileSync(buildPath, 'utf8'));

async function main() {
  console.log('=================================================');
  console.log('  HomoMimic Autonomous Agent — Ritual Testnet');
  console.log('=================================================\n');

  // ─── Set up provider & signer ────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: 1979,
    name: 'ritual',
  });

  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const deployerAddress = signer.address;

  console.log(`Deployer: ${deployerAddress}`);

  // ─── Check balance ────────────────────────────────────────────────────────
  const balance = await provider.getBalance(deployerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} RITUAL`);

  if (balance === 0n) {
    console.error('\nERROR: Zero balance. Get testnet RITUAL from:');
    console.error('  https://faucet.ritualfoundation.org\n');
    process.exit(1);
  }

  // ─── Get current gas price ────────────────────────────────────────────────
  const feeData = await provider.getFeeData();
  console.log(`Gas price: ${ethers.formatUnits(feeData.maxFeePerGas || feeData.gasPrice, 'gwei')} gwei\n`);

  // ─── Deploy AutonomousAgent ───────────────────────────────────────────────
  console.log('Deploying AutonomousAgent...');
  console.log(`  Constructor arg: scheduler = ${SCHEDULER_ADDRESS}`);

  const factory = new ethers.ContractFactory(abi, bytecode, signer);

  const contract = await factory.deploy(SCHEDULER_ADDRESS, {
    // EIP-1559 transaction (required by Ritual)
    maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei'),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei'),
  });

  console.log(`\nTransaction sent: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('\n✅ CONTRACT DEPLOYED!');
  console.log('─────────────────────────────────────────────────');
  console.log(`  Address:  ${contractAddress}`);
  console.log(`  Explorer: https://explorer.ritualfoundation.org/address/${contractAddress}`);
  console.log('─────────────────────────────────────────────────\n');

  // ─── Fund RitualWallet for async fees ────────────────────────────────────
  const fundAmount = ethers.parseEther('0.01');
  console.log(`Funding RitualWallet with ${ethers.formatEther(fundAmount)} RITUAL for async fees...`);

  const agentContract = new ethers.Contract(contractAddress, abi, signer);
  const fundTx = await agentContract.depositForFees({
    value: fundAmount,
    maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei'),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei'),
  });

  console.log(`  Funding tx: ${fundTx.hash}`);
  await fundTx.wait();
  console.log('  ✅ RitualWallet funded!\n');

  // ─── Save deployment info ─────────────────────────────────────────────────
  const deployInfo = {
    contractAddress,
    deployerAddress,
    schedulerAddress: SCHEDULER_ADDRESS,
    ritualWallet: RITUAL_WALLET,
    deployedAt: new Date().toISOString(),
    chainId: 1979,
    rpcUrl: RPC_URL,
    explorerUrl: `https://explorer.ritualfoundation.org/address/${contractAddress}`,
    txHash: contract.deploymentTransaction().hash,
  };

  const deployInfoPath = path.resolve(__dirname, 'build', 'deployment.json');
  fs.writeFileSync(deployInfoPath, JSON.stringify(deployInfo, null, 2));
  console.log(`Deployment info saved to: build/deployment.json`);

  // ─── Print next steps ─────────────────────────────────────────────────────
  console.log('\n📋 NEXT STEPS:');
  console.log('─────────────────────────────────────────────────');
  console.log('1. Start the agent loop by calling startAgent():');
  console.log(`   Contract: ${contractAddress}`);
  console.log('   Function: startAgent(executor, url, systemPrompt, frequency, numCalls, gasLimit, maxFeePerGas)');
  console.log('\n2. Update the frontend .env:');
  console.log(`   VITE_AGENT_CONTRACT=${contractAddress}`);
  console.log('\n3. View on explorer:');
  console.log(`   ${deployInfo.explorerUrl}`);

  return contractAddress;
}

main().catch((err) => {
  console.error('\nDeployment FAILED:', err.message || err);
  process.exit(1);
});
