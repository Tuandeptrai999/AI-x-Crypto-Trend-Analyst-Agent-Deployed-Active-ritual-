const { ethers } = require('ethers');

async function main() {
  const rpcs = [
    'https://rpc.ritualfoundation.org',
    'https://ritual-testnet.rpc.thirdweb.com'
  ];

  let provider;
  for (const rpc of rpcs) {
    try {
      const tempProvider = new ethers.JsonRpcProvider(rpc, { chainId: 1979, name: 'ritual' });
      await tempProvider.getNetwork();
      provider = tempProvider;
      console.log(`Connected to ${rpc}`);
      break;
    } catch (e) {
      console.log(`Failed to connect to ${rpc}`);
    }
  }

  if (!provider) {
    console.error("Could not connect to any RPC");
    return;
  }

  const CONTRACT = '0x6032697f3445F8157f3CFdF86d224d67341Ee43f';
  const TX_HASH = '0x8b61f15bd857dec84e8d42a6e55f6c1386f557933b9eadd00bd0de33f87533fd';

  console.log(`Checking Contract Address: ${CONTRACT}`);
  try {
    const code = await provider.getCode(CONTRACT);
    if (code === '0x') {
      console.log('Contract NOT deployed at this address.');
    } else {
      console.log(`Contract DEPLOYED successfully. Code length: ${code.length}`);
    }
  } catch (e) {
    console.error('Error fetching code:', e.message);
  }

  console.log(`\nChecking startAgent TX: ${TX_HASH}`);
  try {
    const tx = await provider.getTransaction(TX_HASH);
    if (tx) {
      console.log(`TX found in mempool or block. Block number: ${tx.blockNumber}`);
      const receipt = await provider.getTransactionReceipt(TX_HASH);
      if (receipt) {
        console.log(`TX Receipt status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
        console.log(`TX confirmed in block: ${receipt.blockNumber}`);
      } else {
        console.log('TX is pending (no receipt yet).');
      }
    } else {
      console.log('TX NOT found.');
    }
  } catch (e) {
    console.error('Error fetching TX:', e.message);
  }
}

main();
