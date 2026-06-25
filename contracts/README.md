# HomoMimic - Autonomous Sovereign Agent on Ritual Testnet

This repository contains the smart contracts and deployment scripts for **HomoMimic**, an autonomous AI agent deployed on the Ritual testnet.

## Overview
HomoMimic uses the Ritual Sovereign Agent precompile (`0x080C`) to run a recurring execution loop. Driven by on-chain scheduling, the agent wakes up, runs a `See -> Think -> Do` inference loop inside a Trusted Execution Environment (TEE), and delivers its actions back on-chain.

### Key Components
- **`src/HomoMimic.sol`**: The main Solidity smart contract. It handles the scheduling logic, funds the `RitualWallet` for execution fees, and processes Phase 2 asynchronous deliveries from the agent.
- **`deploy-and-start.js`**: A comprehensive deployment script that:
  - Discovers an active TEE executor.
  - Deploys the `HomoMimic` contract.
  - Funds the RitualWallet.
  - ABI-encodes the Sovereign Agent payload (including ECIES-encrypted LLM API keys).
  - Stores the request on-chain.
  - Starts the autonomous scheduler loop.
- **`compile.js`**: Script to compile the Solidity contracts using `solc`.
- **`check-status.js`**: Script to check the live on-chain status of the agent.
- **`full-check.js`**: Script to run a full health check of the agent.

## On-Chain Information
The agent is actively running on the Ritual Testnet:

| Field | Value |
|-------|-------|
| **Contract Address** | `0x02C96B18762BfA21AaB572D01cFD692608e93271` |
| **Owner Wallet** | `0xe63a4d9bB091659a47972980E91a087aF4430466` |
| **TEE Executor** | `0x9dc11412391Dc3EDF59811FC9Ee7bEbFD41c8b4C` |
| **Schedule ID** | `#2730709` |
| **startAgent TX** | `0x8b61f15bd857dec84e8d42a6e55f6c1386f557933b9eadd00bd0de33f87533fd` |
| **Frequency** | Every 500 blocks (~3 minutes) |
| **Total Calls** | 5 iterations |
| **Model** | `gemini-2.5-flash` |
| **Network** | Ritual Testnet (Chain ID: 1979) |
| **Explorer** | [View Contract](https://explorer.ritualfoundation.org/address/0x02C96B18762BfA21AaB572D01cFD692608e93271) |

## Compiler & Verification Info
| Field | Value |
|-------|-------|
| **Solidity Version** | `v0.8.20+commit.a1b79de6` |
| **Optimizer** | Enabled, 200 runs |
| **EVM Version** | Shanghai |
| **viaIR** | false |
| **License** | MIT |

## Setup & Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory:
   ```env
   PRIVATE_KEY=your_private_key_here
   RITUAL_RPC_URL=https://rpc.ritualfoundation.org
   GEMINI_API_KEY=your_gemini_api_key_here # Or OPENAI_API_KEY / ANTHROPIC_API_KEY
   ```

3. Compile the contracts:
   ```bash
   node compile.js
   ```

4. Deploy and start the agent:
   ```bash
   node deploy-and-start.js
   ```

5. Check agent status:
   ```bash
   node full-check.js
   ```

## How It Works
1. **Schedule**: The Scheduler contract calls `wakeUp()` every 500 blocks.
2. **See → Think → Do**: The Sovereign Agent precompile (`0x080C`) runs the AI inference loop inside a TEE.
3. **Deliver**: The result is delivered back on-chain via `onSovereignAgentResult()`.
4. **Store**: The agent's `lastThought` and `lastAction` are stored on-chain for anyone to read.
