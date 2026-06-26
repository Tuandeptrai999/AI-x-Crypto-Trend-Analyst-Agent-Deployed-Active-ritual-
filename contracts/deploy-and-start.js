/**
 * deploy-and-start.js
 * Deploys HomoMimic contract, builds the Sovereign Agent request payload
 * (with ECIES-encrypted secrets), calls setRequest(), then startAgent().
 *
 * Usage:
 *   node deploy-and-start.js
 *
 * Required .env:
 *   PRIVATE_KEY, RITUAL_RPC_URL
 *   Plus ONE of: ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC_URL     = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const RITUAL_WALLET  = '0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948';
const TEE_REGISTRY   = '0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F';
const ASYNC_DELIVERY = '0x5A16214fF555848411544b005f7Ac063742f39F6';
const SCHEDULER      = '0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B';
const ASYNC_TRACKER  = '0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5';

if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY in .env'); process.exit(1); }

// ─── Load build artifact ──────────────────────────────────────────────────────
const { abi, bytecode } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'build/HomoMimic.json'), 'utf8')
);

// ─── ECIES encryption (pure JS — no Python needed) ───────────────────────────
// We use the same ECIES params as the Ritual TEE: secp256k1, AES-256-GCM, nonce=12
async function eciesEncrypt(pubKeyHex, plaintext) {
  // Dynamic import of eciesjs (if installed), fallback to empty bytes with warning
  try {
    const { encrypt } = await import('eciesjs');
    const pubKey = Buffer.from(pubKeyHex.replace(/^0x/, ''), 'hex');
    const plain  = Buffer.from(plaintext);
    const encrypted = encrypt(pubKey, plain);
    return encrypted;
  } catch (e) {
    console.warn('⚠️  eciesjs not available — using empty encryptedSecrets (no LLM key encryption)');
    console.warn('   Install with: npm install eciesjs');
    return Buffer.from('');
  }
}

// ─── ABI-encode the SovereignAgentParams (23 fields) ─────────────────────────
function encodeRequest({
  executor, ttl, userPublicKey, pollIntervalBlocks, maxPollBlock,
  taskIdMarker, deliveryTarget, deliverySelector, deliveryGasLimit,
  deliveryMaxFeePerGas, deliveryMaxPriorityFeePerGas, cliType, prompt,
  encryptedSecrets, convoHistory, output, skills, systemPromptRef,
  model, tools, maxTurns, maxTokens, rpcUrls,
}) {
  const storageEmpty = ['', '', ''];

  return ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'address',   // executor
      'uint256',   // ttl
      'bytes',     // userPublicKey
      'uint64',    // pollIntervalBlocks
      'uint64',    // maxPollBlock
      'string',    // taskIdMarker
      'address',   // deliveryTarget
      'bytes4',    // deliverySelector
      'uint256',   // deliveryGasLimit
      'uint256',   // deliveryMaxFeePerGas
      'uint256',   // deliveryMaxPriorityFeePerGas
      'uint16',    // cliType (5=crush, 0=claude_code, 6=zeroclaw)
      'string',    // prompt
      'bytes',     // encryptedSecrets
      'tuple(string,string,string)',   // convoHistory
      'tuple(string,string,string)',   // output
      'tuple(string,string,string)[]', // skills
      'tuple(string,string,string)',   // systemPrompt
      'string',    // model
      'string[]',  // tools
      'uint16',    // maxTurns
      'uint32',    // maxTokens
      'string',    // rpcUrls
    ],
    [
      executor,
      ttl,
      userPublicKey,
      pollIntervalBlocks,
      maxPollBlock,
      taskIdMarker,
      deliveryTarget,
      deliverySelector,
      deliveryGasLimit,
      deliveryMaxFeePerGas,
      deliveryMaxPriorityFeePerGas,
      cliType,
      prompt,
      encryptedSecrets,
      convoHistory    || storageEmpty,
      output          || storageEmpty,
      skills          || [],
      systemPromptRef || storageEmpty,
      model,
      tools           || [],
      maxTurns,
      maxTokens,
      rpcUrls,
    ]
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  HomoMimic — Deploy & Activate on Ritual');
  console.log('══════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 1979, name: 'ritual' });
  const signer   = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('Deployer:', signer.address);
  const balance = await provider.getBalance(signer.address);
  console.log('Balance :', ethers.formatEther(balance), 'RITUAL\n');

  if (balance < ethers.parseEther('0.1')) {
    console.error('Need at least 0.1 RITUAL. Get from https://faucet.ritualfoundation.org');
    process.exit(1);
  }

  // ── 1. Get executor from TEEServiceRegistry ────────────────────────────────
  console.log('Discovering TEE executor...');
  const registryAbi = [
    `function getServicesByCapability(uint8,bool) external view returns (
      tuple(
        tuple(address paymentAddress, address teeAddress, uint8 teeType, bytes publicKey, string endpoint, bytes32 certPubKeyHash, uint8 capability) node,
        bool isValid,
        bytes32 workloadId
      )[]
    )`
  ];
  const registry  = new ethers.Contract(TEE_REGISTRY, registryAbi, provider);
  const services  = await registry.getServicesByCapability(0, true);
  if (!services.length) { console.error('No executors found!'); process.exit(1); }

  const node      = services[0].node;
  const executor  = node.teeAddress;
  const pubKeyHex = node.publicKey;
  console.log('Executor  :', executor);
  console.log('PubKey len:', pubKeyHex.length, '\n');

  // ── 2. Deploy HomoMimic ────────────────────────────────────────────────────
  console.log('Deploying HomoMimic contract...');
  const feeData = await provider.getFeeData();
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy({
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });

  console.log('TX:', contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('✅ Deployed to:', contractAddress);
  console.log('   Explorer  :', `https://explorer.ritualfoundation.org/address/${contractAddress}\n`);

  const agent = new ethers.Contract(contractAddress, abi, signer);

  // ── 3. Fund RitualWallet ───────────────────────────────────────────────────
  const fundAmount = ethers.parseEther('1.5'); // 1.5 RITUAL for async TEE fees
  console.log(`Funding RitualWallet with ${ethers.formatEther(fundAmount)} RITUAL...`);
  const fundTx = await agent.depositForFees({ value: fundAmount, maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas });
  await fundTx.wait();
  console.log('✅ Funded! TX:', fundTx.hash, '\n');

  // ── 4. Build & encrypt secrets ─────────────────────────────────────────────
  let secretsJson = '{}';
  let model       = 'claude-sonnet-4-5-20250929';
  let cliType     = 5; // crush

  if (process.env.ANTHROPIC_API_KEY) {
    secretsJson = JSON.stringify({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY });
    model       = 'claude-sonnet-4-5-20250929';
    cliType     = 0; // claude_code
    console.log('Using Anthropic / Claude');
  } else if (process.env.OPENAI_API_KEY) {
    secretsJson = JSON.stringify({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: process.env.OPENAI_API_KEY });
    model       = 'gpt-4o-mini';
    cliType     = 5;
    console.log('Using OpenAI / GPT-4o-mini');
  } else if (process.env.GEMINI_API_KEY) {
    secretsJson = JSON.stringify({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: process.env.GEMINI_API_KEY });
    model       = 'gemini-2.5-flash';
    cliType     = 5;
    console.log('Using Gemini Flash');
  } else {
    console.log('Using Ritual Gateway (No API Key Required)');
    secretsJson = JSON.stringify({ LLM_PROVIDER: 'ritual' });
    model       = 'zai-org/GLM-4.7-FP8';
    cliType     = 5;
  }

  const pubKeyBytes   = Buffer.from(pubKeyHex.replace(/^0x/, ''), 'hex');
  const encrypted     = await eciesEncrypt(pubKeyHex, secretsJson);

  // ── 5. Encode SovereignAgentParams ────────────────────────────────────────
  const deliverySelector = ethers.keccak256(
    ethers.toUtf8Bytes('onSovereignAgentResult(bytes32,bytes)')
  ).slice(0, 10); // first 4 bytes = 10 hex chars including 0x

  const PROMPT = `You are a Trend AI x Crypto Analysis Agent.
Your mission:
1. Observe real-world data and reason deeply (wrap reasoning in <think> tags).
2. Analyze the latest trends in the intersection of AI and Cryptocurrencies.
3. Propose 3 innovative product ideas at this intersection.
Be specific, structured, and output your reasoning and proposed product ideas clearly.`;

  const encodedRequest = encodeRequest({
    executor,
    ttl:                        500,
    userPublicKey:              '0x',
    pollIntervalBlocks:         5,
    maxPollBlock:               6000,
    taskIdMarker:               'HOMO_MIMIC_AGENT',
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

  console.log('\nEncoded request size:', encodedRequest.length / 2, 'bytes');

  // ── 6. Store request on-chain ──────────────────────────────────────────────
  console.log('\nCalling setRequest() on contract...');
  const setTx = await agent.setRequest(encodedRequest, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             3_000_000,
  });
  await setTx.wait();
  console.log('✅ Request stored! TX:', setTx.hash);

  // ── 7. Start the agent scheduler ──────────────────────────────────────────
  // frequency=10 blocks, numCalls=5, gasLimit=50_000_000, TTL=5000 (large for relayer latency)
  const frequency   = 10;
  const numCalls    = 5;
  const gasLimit    = 50_000_000;
  const maxFeePerGas = ethers.parseUnits('4', 'gwei'); // 4 gwei
  const ttl         = 5000; // large TTL so relayer has time to execute

  console.log('\nCalling startAgent()...');
  console.log('  frequency :', frequency, 'blocks (~', Math.round(frequency * 0.35), 'seconds)');
  console.log('  numCalls  :', numCalls, '(total loop iterations)');
  console.log('  gasLimit  :', gasLimit);
  console.log('  ttl       :', ttl, 'blocks');

  const startTx = await agent.startAgent(frequency, numCalls, gasLimit, maxFeePerGas, ttl, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit:             400_000,
  });

  console.log('TX sent:', startTx.hash);
  const startReceipt = await startTx.wait();
  console.log('✅ startAgent confirmed! Block:', startReceipt.blockNumber);

  // Transfer ownership to user's wallet address
  const USER_WALLET = '0x75E698390F225568510DB5b56B34EA4C94AA3b9d';
  console.log(`\nTransferring contract ownership to user wallet ${USER_WALLET}...`);
  const transferTx = await agent.transferOwnership(USER_WALLET, {
    maxFeePerGas:         feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });
  await transferTx.wait();
  console.log('✅ Ownership transferred to:', USER_WALLET);

  // Read schedule ID
  const schedId = await agent.activeScheduleId();
  console.log('\nActive schedule ID:', schedId.toString());

  // ── 8. Save deployment info ────────────────────────────────────────────────
  const info = {
    contractAddress,
    executor,
    model,
    scheduleId: schedId.toString(),
    frequency,
    numCalls,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://explorer.ritualfoundation.org/address/${contractAddress}`,
    startAgentTx: startTx.hash,
  };
  fs.writeFileSync(
    path.resolve(__dirname, 'build/deployment.json'),
    JSON.stringify(info, null, 2)
  );

  console.log('\n══════════════════════════════════════════════');
  console.log('  🤖 HomoMimic is LIVE and RUNNING!');
  console.log('══════════════════════════════════════════════');
  console.log(`  Contract : ${contractAddress}`);
  console.log(`  Explorer : ${info.explorerUrl}`);
  console.log(`  Schedule : #${schedId} (${numCalls} iterations, every ${frequency} blocks)`);
  console.log(`  Model    : ${model}`);
  console.log('\n  The agent will autonomously:');
  console.log('  1. Wake up every ~3 min (500 blocks)');
  console.log('  2. Execute See→Think→Do loop in Ritual TEE');
  console.log('  3. Deliver results back on-chain via AsyncDelivery');
  console.log('\n  Watch results:');
  console.log(`  → lastThought / lastAction readable via contract view calls`);
}

main().catch(e => { console.error('\nFAILED:', e.message || e); process.exit(1); });
