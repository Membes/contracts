
require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-etherscan')

const { DEPLOYMENT_PRIVATE_KEY, BSC_SCAN_API_KEY } = require('./.env.json')

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545'
    },
    hardhat: {
    },
    testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [DEPLOYMENT_PRIVATE_KEY]
    },
    mainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [DEPLOYMENT_PRIVATE_KEY]
    }
  },
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    apiKey: BSC_SCAN_API_KEY
  }
}
