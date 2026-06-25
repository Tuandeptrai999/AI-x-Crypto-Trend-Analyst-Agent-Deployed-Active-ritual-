# AI x Crypto Trend Analyst Agent

An autonomous AI agent deployed on the **Ritual Chain (Testnet ID 1979)**. Powered by on-chain scheduling, the agent runs a recurring loop inside a TEE (Trusted Execution Environment) enclave to analyze AI + Crypto trends, propose product concepts, and store the output on-chain.

Includes a premium dark-mode React dashboard to monitor the agent state in real-time.

---

## 🚀 Deployed Agent Details

| Metric / Parameter | Value |
|--------------------|-------|
| **Smart Contract Address** | [0x02C96B18762BfA21AaB572D01cFD692608e93271](https://explorer.ritualfoundation.org/address/0x02C96B18762BfA21AaB572D01cFD692608e93271) |
| **Owner Wallet (User)** | `0x75E698390F225568510DB5b56B34EA4C94AA3b9d` |
| **Active Schedule ID** | `#2746781` |
| **TEE Executor** | `0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C` |
| **Model** | `zai-org/GLM-4.7-FP8` (Via native, free Ritual TEE Gateway) |
| **RitualWallet Escrow Balance** | `0.05 RITUAL` (For TEE execution gas/fees) |
| **Execution Frequency** | Every `500` blocks (~3 minutes) |

---

## 🛠️ Project Structure

```
├── .gitignore                   # Excludes sensitive secrets, node_modules, dist/
├── README.md                    # Root project documentation
├── package.json                 # Frontend dependencies (React + Vite + ethers)
├── src/                         # Frontend React components & styles
│   ├── App.tsx                  # Dashboard logic & RPC status queries
│   └── App.css                  # Glassmorphic dark styling
├── contracts/                   # Hardhat Solidity environment
│   ├── src/
│   │   └── HomoMimic.sol        # Main contract with withdraw and schedule logic
│   ├── deploy-and-start.js      # Deploy, fund, encode request & start schedule
│   ├── full-check.js            # Comprehensive health-check script
│   └── package.json             # Contract tools (Hardhat, ethers)
```

---

## ⚙️ Quick Start

### 1. Smart Contracts

Enter the contracts directory:
```bash
cd contracts
npm install
```

Configure `.env`:
```env
PRIVATE_KEY=your_private_key
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
```

Compile contracts:
```bash
node compile.js
```

Deploy and activate the agent:
```bash
node deploy-and-start.js
```

Check agent health & status on-chain:
```bash
node full-check.js
```

### 2. Frontend Dashboard

Return to the root directory and install dependencies:
```bash
npm install
```

Start the local development server:
```bash
npm run dev
```

Open `http://localhost:5173` (or `http://localhost:5174` if port 5173 is in use) to see your AI + Crypto Trend Analyst dashboard querying Ritual Chain RPC in real-time.

---

## 🔒 Security & Asset Safety

- **Asset Safety**: We implemented `withdrawFees(uint256)` and `withdrawNative(uint256)` in `HomoMimic.sol` so you can retrieve RITUAL tokens deposited in escrow once you decide to stop the agent's schedule.
- **Secrets Management**: All sensitive environment files (`.env`, `contracts/.env`), build folders, and dependency assets are ignored via the root `.gitignore` to prevent any credentials leak to public GitHub.
- **Privacy-Preserving Gateway**: The TEE uses `LLM_PROVIDER: "ritual"` which connects directly to the enshrined model inside the enclave, removing the need to supply Anthropic or OpenAI API keys in cleartext.
