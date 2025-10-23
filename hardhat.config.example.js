import "@nomicfoundation/hardhat-toolbox";

// ВАЖНО: Создай файл hardhat.config.js и добавь свой приватный ключ
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";

export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    megaeth: {
      url: "https://carrot.megaeth.com/rpc",
      chainId: 6342,
      accounts: [PRIVATE_KEY]
    }
  }
};

