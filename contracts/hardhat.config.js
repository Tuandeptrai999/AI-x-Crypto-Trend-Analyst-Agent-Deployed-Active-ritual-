require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./src",
  },
  networks: {
    ritual: {
      url: "https://rpc.ritualfoundation.org",
      chainId: 1979,
    }
  },
  sourcify: {
    enabled: true,
    // Ritual testnet chain ID is 1979. We need to check if sourcify supports it.
  },
  etherscan: {
    apiKey: {
      ritual: "empty"
    },
    customChains: [
      {
        network: "ritual",
        chainId: 1979,
        urls: {
          apiURL: "https://explorer.ritualfoundation.org/api",
          browserURL: "https://explorer.ritualfoundation.org"
        }
      }
    ]
  }
};
