// The new HomoMimic v2 at 0x4D96A9f6A185da08c724EBC6a816f841F2E43A62
// Already has 0.5 RITUAL funded. Now we need to:
// 1. setRequest (it's empty - length=2 = '0x')
// 2. startAgent with TTL=5000
require('dotenv').config();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');

const RPC_URL     = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY in .env'); process.exit(1); }

const NEW_CONTRACT = '0x4D96A9f6A185da08c724EBC6a816f841F2E43A62';
const EXECUTOR     = '0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C';
const TEE_REGISTRY = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F';

const { abi } = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8'));

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
  console.log('  Initialize & Activate HomoMimic v2');
  console.log('=================================================\n');
  console.log(`Wallet    : ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`EOA Bal   : ${ethers.formatEther(balance)} RITUAL`);
  console.log(`Contract  : ${NEW_CONTRACT}`);
  
  const agent = new ethers.Contract(NEW_CONTRACT, abi, signer);
  const feeData = await provider.getFeeData();
  
  const escrowBal = await provider.call({ to: '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948', data: '0x70a08231000000000000000000000000' + NEW_CONTRACT.slice(2).toLowerCase() });
  const escrowETH = ethers.formatEther(BigInt(escrowBal));
  console.log(`Escrow Bal: ${escrowETH} RITUAL\n`);
  
  // 1. Get TEE public key
  console.log('Step 1: Getting TEE public key...');
  const registryAbi = [
    'function getServicesByCapability(uint8 capability, bool active) view returns (tuple(tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node, bool isValid, bytes32 workloadId)[])' 
  ];
  const registry = new ethers.Contract(TEE_REGISTRY, registryAbi, provider);
  const services = await registry.getServicesByCapability(0, true);
  const executorService = services.find(s => s.node.teeAddress.toLowerCase() === EXECUTOR.toLowerCase());
  const pubKeyHex = executorService ? executorService.node.publicKey : '0x04';
  console.log(`  PubKey length: ${pubKeyHex.length}\n`);
  
  // 2. Encode request
  console.log('Step 2: Building encoded request...');
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
  
  console.log(`  Encoded request: ${encodedRequest.length / 2} bytes`);
  
  // 3. setRequest
  console.log('\nStep 3: Calling setRequest()...');
  const setTx = await agent.setRequest(encodedRequest, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             3_000_000,
  });
  console.log(`  TX: ${setTx.hash}`);
  await setTx.wait();
  console.log('  ✅ setRequest done!');
  
  // 4. startAgent
  const frequency   = 10;
  const numCalls    = 2;   // 2 calls x 0.2 RITUAL = 0.4 RITUAL (within 0.5 escrow)
  const gasLimit    = 50_000_000;
  const maxFeePerGas = ethers.parseUnits('4', 'gwei');
  const ttl         = 5000;  // Large TTL!
  
  console.log('\nStep 4: Calling startAgent()...');
  console.log(`  frequency: ${frequency}`);
  console.log(`  numCalls:  ${numCalls}`);
  console.log(`  ttl:       ${ttl}`);
  
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
  
  // Save deployment info
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
  console.log('  🤖 HomoMimic v2 ACTIVATED!');
  console.log('══════════════════════════════════════════════');
  console.log(`  Contract : ${NEW_CONTRACT}`);
  console.log(`  Schedule : #${newSchedId}`);
  console.log(`  TTL      : ${ttl} blocks (LARGE - no premature expiry!)`);
  console.log('\n  Run: node wait-for-execution.js to monitor!');
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err.message || err);
  process.exit(1);
});
