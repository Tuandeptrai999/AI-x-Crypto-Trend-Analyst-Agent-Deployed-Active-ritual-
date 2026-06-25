const fs = require('fs');

async function verify() {
  const contractAddress = "0x9581a0f1710E42643393e9f1cDd9709447c21656";
  const jsonInput = fs.readFileSync('standard-json.json', 'utf8');

  const params = {
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: jsonInput,
    codeformat: 'solidity-standard-json-input',
    contractname: 'HomoMimic.sol:HomoMimic',
    compilerversion: 'v0.8.20+commit.a1b79de6'
  };

  const urlParams = new URLSearchParams(params).toString();
  
  console.log('Submitting verification request...');
  const res = await fetch('https://explorer.ritualfoundation.org/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: urlParams
  });
  
  const text = await res.text();
  console.log('Response text:', text.slice(0, 500));
}

verify().catch(console.error);
