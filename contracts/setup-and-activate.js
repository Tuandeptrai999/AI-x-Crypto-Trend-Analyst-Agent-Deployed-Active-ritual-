// Setup existing deployed contract at 0x66298EF668188C4faBEB87Af3CE0Cc43e887923b
// The contract was deployed but only got 0.01 RITUAL funded.
// This script: 1) Transfer old escrow, 2) Fund new contract, 3) setRequest, 4) startAgent
require('dotenv').config();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');

const RPC_URL     = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY in .env'); process.exit(1); }

const OLD_CONTRACT = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451'; // Has 1.65 RITUAL escrow
const NEW_CONTRACT = '0x66298EF668188C4faBEB87Af3CE0Cc43e887923b'; // New contract with fixed code
const EXECUTOR     = '0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C';
const RITUAL_WALLET= '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';
const TEE_REGISTRY = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F';

const { abi, bytecode } = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8'));

// ECIES encryption (pure JS)
async function eciesEncrypt(pubKeyHex, plaintext) {
  try {
    const { encrypt } = await import('eciesjs');
    const pubKey = Buffer.from(pubKeyHex.replace(/^0x/, ''), 'hex');
    const plain  = Buffer.from(plaintext);
    return encrypt(pubKey, plain);
  } catch (e) {
    console.warn('⚠️  eciesjs not available — using empty encryptedSecrets');
    return Buffer.from('');
  }
}

// ABI-encode the SovereignAgentParams
function encodeRequest({
  executor, ttl, userPublicKey, pollIntervalBlocks, maxPollBlock,
  taskIdMarker, deliveryTarget, deliverySelector, deliveryGasLimit,
  deliveryMaxFeePerGas, deliveryMaxPriorityFeePerGas, cliType, prompt,
  encryptedSecrets, convoHistory, output, skills, systemPromptRef,
  model, tools, maxTurns, maxTokens, rpcUrls,
}) {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address','uint256','bytes','uint256','uint256',
      'string','address','bytes4','uint256',
      'uint256','uint256','uint8','string',
      'bytes','string[]','string[]','string[]','string[]',
      'string','string[]','uint256','uint256','string',
    ],
    [
      executor, ttl, userPublicKey, pollIntervalBlocks, maxPollBlock,
      taskIdMarker, deliveryTarget, deliverySelector, deliveryGasLimit,
      deliveryMaxFeePerGas, deliveryMaxPriorityFeePerGas, cliType, prompt,
      encryptedSecrets, convoHistory, output, skills, systemPromptRef,
      model, tools, maxTurns, maxTokens, rpcUrls,
    ]
  );
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 1979, name: 'ritual' });
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('==============================================');
  console.log('  Setup & Activate New Agent Contract');
  console.log('==============================================\n');
  console.log(`Wallet: ${signer.address}`);
  
  const walletBal = await provider.getBalance(signer.address);
  console.log(`EOA Balance: ${ethers.formatEther(walletBal)} RITUAL`);
  
  const newAgent = new ethers.Contract(NEW_CONTRACT, abi, signer);
  const feeData = await provider.getFeeData();
  
  // 1. Check new contract's current state
  let escrowBal = await newAgent.walletBalance();
  console.log(`\nNew contract (${NEW_CONTRACT}) escrow: ${ethers.formatEther(escrowBal)} RITUAL`);
  
  // 2. Determine how much to fund
  const NEEDED = ethers.parseEther('1.0'); // 1.0 RITUAL for 5 calls x 0.2 each
  if (escrowBal < NEEDED) {
    const toFund = NEEDED - escrowBal;
    console.log(`\nFunding new contract with ${ethers.formatEther(toFund)} RITUAL...`);
    if (walletBal < toFund) {
      console.error(`❌ Insufficient balance! Have ${ethers.formatEther(walletBal)}, need ${ethers.formatEther(toFund)}`);
      process.exit(1);
    }
    const fundTx = await newAgent.depositForFees({
      value: toFund,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    });
    console.log(`  TX: ${fundTx.hash}`);
    await fundTx.wait();
    escrowBal = await newAgent.walletBalance();
    console.log(`  ✅ New escrow balance: ${ethers.formatEther(escrowBal)} RITUAL`);
  } else {
    console.log(`New contract already funded: ${ethers.formatEther(escrowBal)} RITUAL`);
  }
  
  // 3. Get TEE executor's public key  
  const registryAbi = [
    "function getServices(address[] calldata executors) view returns (tuple(address node, bytes publicKey, string url, string model, uint256 fee, bool active)[])"
  ];
  const registry = new ethers.Contract(TEE_REGISTRY, registryAbi, provider);
  const services = await registry.getServices([EXECUTOR]);
  const pubKeyHex = services[0].publicKey;
  console.log(`\nTEE Public Key Length: ${pubKeyHex.length}`);
  
  // 4. Build encrypted secrets
  let secretsJson = JSON.stringify({ LLM_PROVIDER: 'ritual' });
  let model = 'zai-org/GLM-4.7-FP8';
  let cliType = 5;
  console.log('Using Ritual Gateway model (no API key needed)');
  
  const encrypted = await eciesEncrypt(pubKeyHex, secretsJson);
  
  // 5. Encode SovereignAgentParams
  const deliverySelector = ethers.keccak256(
    ethers.toUtf8Bytes('onSovereignAgentResult(bytes32,bytes)')
  ).slice(0, 10);
  
  const PROMPT = `You are a Trend AI x Crypto Analysis Agent running on Ritual Network.
Your mission:
1. Observe real-world data and reason deeply (wrap reasoning in <think> tags).
2. Analyze the latest trends in the intersection of AI and Cryptocurrencies.
3. Propose 3 innovative product ideas at this intersection.
Be specific, structured, and output your reasoning and proposed product ideas clearly.`;
  
  const encodedRequest = encodeRequest({
    executor:                   EXECUTOR,
    ttl:                        500,
    userPublicKey:              '0x',
    pollIntervalBlocks:         5,
    maxPollBlock:               6000,
    taskIdMarker:               'HOMO_MIMIC_AGENT',
    deliveryTarget:             NEW_CONTRACT,
    deliverySelector,
    deliveryGasLimit:           3_000_000,
    deliveryMaxFeePerGas:       ethers.parseUnits('2', 'gwei'),
    deliveryMaxPriorityFeePerGas: 0n,
    cliType,
    prompt:                     PROMPT,
    encryptedSecrets:           encrypted,
    convoHistory:               ['', '', ''],
    output:                     ['', '', ''],
    skills:                     [],
    systemPromptRef:            ['', '', ''],
    model,
    tools:                      [],
    maxTurns:                   50,
    maxTokens:                  8192,
    rpcUrls:                    '',
  });
  
  console.log('\nEncoded request size:', encodedRequest.length / 2, 'bytes');
  
  // 6. Store request on-chain
  console.log('\nCalling setRequest()...');
  const currentReq = await newAgent.encodedRequest();
  if (currentReq && currentReq.length > 2) {
    console.log('setRequest already done (encoded request exists). Skipping.');
  } else {
    const setTx = await newAgent.setRequest(encodedRequest, {
      maxFeePerGas:         feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      gasLimit:             3_000_000,
    });
    console.log(`  TX: ${setTx.hash}`);
    await setTx.wait();
    console.log('  ✅ Request stored!');
  }
  
  // 7. Stop any existing schedule
  const activeSchedId = await newAgent.activeScheduleId();
  if (activeSchedId.toString() !== '0') {
    console.log(`\nStopping old schedule #${activeSchedId}...`);
    const stopTx = await newAgent.stopAgent({
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      gasLimit: 300_000
    });
    await stopTx.wait();
    console.log('  ✅ Old schedule stopped!');
  }
  
  // 8. Start the agent scheduler
  const frequency   = 10;
  const numCalls    = 5;
  const gasLimit    = 50_000_000;
  const maxFeePerGas = ethers.parseUnits('4', 'gwei');
  const ttl         = 5000; // Large TTL to survive relayer latency
  
  console.log('\nCalling startAgent()...');
  console.log('  frequency :', frequency, 'blocks (~', Math.round(frequency * 0.35), 'seconds)');
  console.log('  numCalls  :', numCalls);
  console.log('  gasLimit  :', gasLimit);
  console.log('  ttl       :', ttl, 'blocks');
  
  const startTx = await newAgent.startAgent(frequency, numCalls, gasLimit, maxFeePerGas, ttl, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             400_000,
  });
  
  console.log(`  TX: ${startTx.hash}`);
  const startReceipt = await startTx.wait();
  console.log(`  ✅ startAgent confirmed! Block: ${startReceipt.blockNumber}`);
  
  const newSchedId = await newAgent.activeScheduleId();
  console.log(`  Schedule ID: #${newSchedId}`);
  
  // 9. Save deployment info
  const info = {
    contractAddress: NEW_CONTRACT,
    executor: EXECUTOR,
    model,
    scheduleId: newSchedId.toString(),
    frequency,
    numCalls,
    ttl,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://explorer.ritualfoundation.org/address/${NEW_CONTRACT}`,
    startAgentTx: startTx.hash,
  };
  fs.writeFileSync(
    path.resolve(__dirname, 'build/deployment.json'),
    JSON.stringify(info, null, 2)
  );
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🤖 Agent is NOW LIVE! Monitoring for execution...');
  console.log('══════════════════════════════════════════════');
  console.log(`  Contract : ${NEW_CONTRACT}`);
  console.log(`  Explorer : https://explorer.ritualfoundation.org/address/${NEW_CONTRACT}`);
  console.log(`  Schedule : #${newSchedId} (frequency=${frequency}, ttl=${ttl})`);
  console.log('\n  Run: node wait-for-execution.js to monitor!');
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err.message || err);
  process.exit(1);
});
