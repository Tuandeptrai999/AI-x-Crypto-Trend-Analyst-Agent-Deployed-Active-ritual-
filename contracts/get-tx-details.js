const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ritualfoundation.org', { chainId: 1979, name: 'ritual' });
  const txHash = '0xe8d6e6f4e0338c66b9623927b81ae9b481614b8c897b67dbca2779395016b7b5';

  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log(`Transaction details for success call:`);
    console.log(`  From:         `, tx.from);
    console.log(`  To:           `, tx.to);
    console.log(`  Gas Limit:    `, tx.gasLimit.toString());
    console.log(`  Gas Used:     `, receipt.gasUsed.toString());
    console.log(`  Gas Price:    `, ethers.formatUnits(tx.gasPrice, 'gwei'), "gwei");
    console.log(`  Status:       `, receipt.status === 1 ? "Success" : "Failed");
    console.log(`  Number of logs:`, receipt.logs.length);
    
    receipt.logs.forEach((log, index) => {
      console.log(`  Log #${index}: address=${log.address}, topics=${log.topics}`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();
