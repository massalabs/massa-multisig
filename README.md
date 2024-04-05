# Massa Multisignature Wallet

The purpose of multisig wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners.

Features
Can hold Massa and all kind of tokens
Integration with web3 wallets 
Interacting with any contracts
 @dev Most important concepts:
 *      Threshold/required: Number of required confirmations for a Multisig transaction.
 *      Owners: List of addresses that control the Multisig. They are the only ones that
        can submit, approve and execute transactions.
 *      UpgradeDelay: Delay necessary between an upgrade propostition and the actual upgrade
 *      Id: Each transaction have a different id to prevent replay attacks.
 *      Signature: A valid signature of an owner of the Multisig for a transaction hash.
 *      Owners can only be added/removed by the multisig (same for chaning the threshold
        and upgrading the contract)
 *      Change the owners, required,& upgradeDelay to your needs in src/deploy.ts 

## Build

By default this will build all files in `assembly/contracts` directory.

```shell
npm run build
```

## Deploy the multisig

Prerequisites :

- You must add a `.env` file at the root of the repository with the following keys set to valid values :
  - WALLET_PRIVATE_KEY="wallet_private_key"
  - JSON_RPC_URL_PUBLIC=<https://test.massa.net/api/v2:33035>

These keys will be the ones used by the deployer script to interact with the blockchain.

Adapt `required`, `owners` & `upgradeDelay` to your liking (cf. important concepts) in `src/deploy.ts`.

The following command will build contracts in `assembly/contracts` directory and execute the deployment script
`src/deploy.ts`. This script will deploy on the node specified in the `.env` file.

```shell
npm run deploy
```

## Unit tests

The test framework documentation is available here: [as-pect docs](https://as-pect.gitbook.io/as-pect)

```shell
npm run test
```

## Format code

```shell
npm run fmt
```
