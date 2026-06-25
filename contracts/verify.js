const fs = require('fs');

async function verify() {
  const contractAddress = "0x9581a0f1710E42643393e9f1cDd9709447c21656";
  const jsonInput = fs.readFileSync('standard-json.json', 'utf8');

  const params = new URLSearchParams();
  params.append('module', 'contract');
  params.append('action', 'verifysourcecode');
  params.append('contractaddress', contractAddress);
  params.append('sourceCode', jsonInput);
  params.append('codeformat', 'solidity-standard-json-input');
  params.append('contractname', 'HomoMimic.sol:HomoMimic');
  params.append('compilerversion', 'v0.8.20+commit.a1b79de6');

  console.log('Submitting verification request...');
  const res = await fetch('https://explorer.ritualfoundation.org/api', {
    method: 'POST',
    body: params
  });
  
  const data = await res.json();
  console.log('Response:', data);
}

verify().catch(console.error);
