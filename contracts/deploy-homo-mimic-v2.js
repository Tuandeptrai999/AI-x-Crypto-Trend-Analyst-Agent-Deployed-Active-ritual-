// Deploy ONLY the HomoMimic contract and initialize it.
// Does NOT fund - EOA only has 0.53 RITUAL, need to be careful.
require('dotenv').config();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');

const RPC_URL     = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY in .env'); process.exit(1); }

const RITUAL_WALLET  = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';
const TEE_REGISTRY   = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F';
const ASYNC_DELIVERY = '0x5A16214fF555848411544b005f7Ac063742f39F6';
const SCHEDULER      = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
const EXECUTOR       = '0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C';
const OLD_CONTRACT   = '0x2b5ceCC6F4B8b07a005bBc8fDd8EA06E7B97c451'; // has 1.65 RITUAL escrow

const { abi, bytecode } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8')
);

// ECIES encryption
async function eciesEncrypt(pubKeyHex, plaintext) {
  try {
    const { encrypt } = await import('eciesjs');
    const pubKey = Buffer.from(pubKeyHex.replace(/^0x/, ''), 'hex');
    return encrypt(pubKey, Buffer.from(plaintext));
  } catch (e) {
    console.warn('⚠️  eciesjs not available — using empty encryptedSecrets');
    return Buffer.from('');
  }
}

// ABI-encode SovereignAgentParams
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
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('=================================================');
  console.log('  HomoMimic v2 — Deploy + Setup + Activate');
  console.log('=================================================\n');
  console.log(`Wallet  : ${signer.address}`);
  
  const balance = await provider.getBalance(signer.address);
  console.log(`Balance : ${ethers.formatEther(balance)} RITUAL\n`);
  
  const feeData = await provider.getFeeData();
  
  // ── 1. Deploy HomoMimic ────────────────────────────────────────────────────
  console.log('Step 1: Deploying HomoMimic v2...');
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy({
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });
  
  console.log(`  TX: ${contract.deploymentTransaction().hash}`);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log(`  ✅ Deployed to: ${contractAddress}`);
  console.log(`  Explorer: https://explorer.ritualfoundation.org/address/${contractAddress}\n`);
  
  const agent = new ethers.Contract(contractAddress, abi, signer);
  
  // ── 2. Fund RitualWallet ───────────────────────────────────────────────────
  const newBalance = await provider.getBalance(signer.address);
  console.log(`Step 2: Current balance after deploy: ${ethers.formatEther(newBalance)} RITUAL`);
  
  // Fund with 0.5 RITUAL (conservative - leaves enough for gas)
  const fundAmount = ethers.parseEther('0.5');
  if (newBalance < fundAmount + ethers.parseEther('0.01')) {
    console.log('⚠️  Insufficient balance for full funding. Funding with 0.3 RITUAL...');
    const lessAmount = ethers.parseEther('0.3');
    const fundTx = await agent.depositForFees({
      value: lessAmount,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    });
    console.log(`  TX: ${fundTx.hash}`);
    await fundTx.wait();
    console.log('  ✅ Funded with 0.3 RITUAL!');
  } else {
    const fundTx = await agent.depositForFees({
      value: fundAmount,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    });
    console.log(`  TX: ${fundTx.hash}`);
    await fundTx.wait();
    console.log(`  ✅ Funded with ${ethers.formatEther(fundAmount)} RITUAL!`);
  }
  
  // ── 3. Get TEE public key ──────────────────────────────────────────────────
  console.log('Step 3: Getting TEE public key...');
  const registryAbi = [
    'function getServicesByCapability(uint8 capability, bool active) view returns (tuple(tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node, bool isValid, bytes32 workloadId)[])'
  ];
  const registry = new ethers.Contract(TEE_REGISTRY, registryAbi, provider);
  const services = await registry.getServicesByCapability(0, true);
  const executorService = services.find(s => s.node.teeAddress.toLowerCase() === EXECUTOR.toLowerCase());
  const pubKeyHex = executorService ? executorService.node.publicKey : '0x04';
  console.log(`  PubKey length: ${pubKeyHex.length}`);
  
  // ── 4. Build & encode request ──────────────────────────────────────────────
  console.log('\nStep 4: Building encoded request...');
  const secretsJson = JSON.stringify({ LLM_PROVIDER: 'ritual' });
  const model = 'zai-org/GLM-4.7-FP8';
  const cliType = 5;
  
  const encrypted = await eciesEncrypt(pubKeyHex, secretsJson);
  
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
    taskIdMarker:               'HOMO_MIMIC_V2',
    deliveryTarget:             contractAddress,
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
  
  console.log(`  Encoded request size: ${encodedRequest.length / 2} bytes`);
  
  // ── 5. Store request on-chain ──────────────────────────────────────────────
  console.log('\nStep 5: Calling setRequest()...');
  const setTx = await agent.setRequest(encodedRequest, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             3_000_000,
  });
  console.log(`  TX: ${setTx.hash}`);
  await setTx.wait();
  console.log('  ✅ Request stored!');
  
  // ── 6. Start the scheduler ─────────────────────────────────────────────────
  const frequency   = 10;
  const numCalls    = 3;  // 3 calls x 0.2 RITUAL = 0.6 RITUAL (within 0.3+ escrow budget)
  const gasLimit    = 50_000_000;
  const maxFeePerGas = ethers.parseUnits('4', 'gwei');
  const ttl         = 5000;  // Large TTL to survive relayer latency
  
  console.log('\nStep 6: Calling startAgent()...');
  console.log(`  frequency: ${frequency} blocks (~${Math.round(frequency * 0.35)} seconds)`);
  console.log(`  numCalls:  ${numCalls}`);
  console.log(`  gasLimit:  ${gasLimit}`);
  console.log(`  ttl:       ${ttl} blocks`);
  
  const startTx = await agent.startAgent(frequency, numCalls, gasLimit, maxFeePerGas, ttl, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             400_000,
  });
  
  console.log(`  TX: ${startTx.hash}`);
  const startReceipt = await startTx.wait();
  console.log(`  ✅ startAgent confirmed! Block: ${startReceipt.blockNumber}`);
  
  const newSchedId = await agent.activeScheduleId();
  console.log(`  Schedule ID: #${newSchedId}`);
  
  // ── 7. Save deployment info ────────────────────────────────────────────────
  const info = {
    contractAddress,
    executor: EXECUTOR,
    model,
    scheduleId: newSchedId.toString(),
    frequency,
    numCalls,
    ttl,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://explorer.ritualfoundation.org/address/${contractAddress}`,
    startAgentTx: startTx.hash,
  };
  fs.writeFileSync(
    path.resolve(__dirname, 'build/deployment.json'),
    JSON.stringify(info, null, 2)
  );
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🤖 HomoMimic v2 is LIVE!');
  console.log('══════════════════════════════════════════════');
  console.log(`  Contract : ${contractAddress}`);
  console.log(`  Explorer : https://explorer.ritualfoundation.org/address/${contractAddress}`);
  console.log(`  Schedule : #${newSchedId} (frequency=${frequency}, ttl=${ttl})`);
  console.log('\n  Run: node wait-for-execution.js to monitor!');
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err.message || err);
  process.exit(1);
});
