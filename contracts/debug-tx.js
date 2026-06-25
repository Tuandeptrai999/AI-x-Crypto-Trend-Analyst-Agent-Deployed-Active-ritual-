const { ethers } = require('ethers');

async function main() {
  const TX = '0xf660d90d6f3228f9aa225a3c13bdea006e8100885dcd71bd0a5e0e980dd631c2';
  
  // Try multiple RPC endpoints
  const rpcs = [
    'https://rpc.ritualfoundation.org',
    'https://ritual-testnet-rpc.g.alchemy.com/v2/demo',
  ];

  for (const rpc of rpcs) {
    try {
      console.log(`\nThử RPC: ${rpc}`);
      const provider = new ethers.JsonRpcProvider(rpc, { chainId: 1979, name: 'ritual' });
      
      const tx = await provider.getTransaction(TX);
      const receipt = await provider.getTransactionReceipt(TX);
      
      if (tx) {
        console.log('✅ TÌM THẤY TX!');
        console.log('From   :', tx.from);
        console.log('To     :', tx.to);
        console.log('Block  :', tx.blockNumber);
        console.log('Nonce  :', tx.nonce);
        console.log('Status :', receipt?.status === 1 ? '✅ SUCCESS' : receipt?.status === 0 ? '❌ REVERT' : '⏳ Pending');
        console.log('Gas Used:', receipt?.gasUsed?.toString());
      } else {
        console.log('❌ Không tìm thấy TX trên RPC này');
      }
    } catch(e) {
      console.log('❌ Lỗi:', e.message.slice(0,100));
    }
  }

  // Check current contract state
  console.log('\n=== KIỂM TRA CONTRACT HIỆN TẠI ===');
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const contract = new ethers.Contract('0x02C96B18762BfA21AaB572D01cFD692608e93271', [
    "function activeScheduleId() view returns (uint256)",
    "function executionCount() view returns (uint256)",
    "function encodedRequest() view returns (bytes)"
  ], provider);

  const schedId = await contract.activeScheduleId();
  const execCount = await contract.executionCount();
  const encoded = await contract.encodedRequest();
  
  console.log('Active Schedule ID:', schedId.toString());
  console.log('Execution Count   :', execCount.toString());
  console.log('Encoded Request   :', encoded.length > 2 ? `${encoded.length/2} bytes (OK)` : 'TRỐNG!');
  
  if (schedId.toString() === '0') {
    console.log('\n⚠️  Schedule ID = 0 → Scheduler đã HẾT HẠN hoặc bị cancel!');
    console.log('   Cần gọi startAgent() lại!');
  } else {
    console.log('\n✅ Scheduler vẫn đang active với ID #' + schedId.toString());
  }
}

main().catch(e => console.error(e.message));
