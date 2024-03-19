# Massa Multisignature Wallet

The purpose of multisig wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners.

Features
Can hold Massa and all kind of tokens
Integration with web3 wallets 
Interacting with any contracts
 @dev Most important concepts:
 *      - Threshold: Number of required confirmations for a Multisig transaction.
 *      - Owners: List of addresses that control the Multisig. They are the only ones that can submit,
 *        approve and execute transactions.
 *      - UpgradeDelay: Delay necessary between an upgrade propostition and the actual upgrade
 *      - Id: Each transaction have a different id to prevent replay attacks.
 *      - Signature: A valid signature of an owner of the Multisig for a transaction hash.
 *      - Owners can only be added/removed by the multisig (same for chaning the threshold
 *        and upgrading the contract)
 *      - Change the owners, required, and upgradeDelay to your needs in src/deploy.ts when deploying 

## Build

By default this will build all files in `assembly/contracts` directory.

```shell
npm run build
```

## Deploy a smart contract

Prerequisites :

- You must add a `.env` file at the root of the repository with the following keys set to valid values :
  - WALLET_PRIVATE_KEY="wallet_private_key"
  - JSON_RPC_URL_PUBLIC=<https://test.massa.net/api/v2:33035>

These keys will be the ones used by the deployer script to interact with the blockchain.

The following command will build contracts in `assembly/contracts` directory and execute the deployment script
`src/deploy.ts`. This script will deploy on the node specified in the `.env` file.

```shell
npm run deploy
```

You can modify `src/deploy.ts` to change the smart contract being deployed, and to pass arguments to the constructor
function:

- line 31: specify what contract you want to deploy
- line 33: create the `Args` object to pass to the constructor of the contract you want to deploy

When the deployment operation is executed on-chain, the
[constructor](https://github.com/massalabs/massa-sc-toolkit/blob/main/packages/sc-project-initializer/commands/init/assembly/contracts/main.ts#L14)
function of the smart contract being deployed will
be called with the arguments provided in the deployment script.

The deployment script uses [massa-sc-deployer library](https://www.npmjs.com/package/@massalabs/massa-sc-deployer)
to deploy smart contracts.

You can edit this script and use [massa-web3 library](https://www.npmjs.com/package/@massalabs/massa-web3)
to create advanced deployment procedure.

For more information, please visit our ReadTheDocs about
[Massa smart-contract development](https://docs.massa.net/en/latest/web3-dev/smart-contracts.html).

## Unit tests

The test framework documentation is available here: [as-pect docs](https://as-pect.gitbook.io/as-pect)

```shell
npm run test
```

## Format code

```shell
npm run fmt
```
