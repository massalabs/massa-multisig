# Massa Multisignature Wallet

The purpose of multisig wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners.

Features
Can hold Massa and all kinds of tokens
Integration with web3 wallets 
Interacting with any contracts
 @dev Most important concepts:
 *      Threshold/required: Number of required confirmations for a Multisig transaction.
 *      Owners: List of addresses that control the Multisig. They are the only ones that
        can submit, approve, and execute transactions.
 *      UpgradeDelay: Delay necessary between an upgrade proposition and the actual upgrade
 *      executionDelay: Delay necessary between the time the threshold is met for a specific transaction and its execution.
 *      Id: Each transaction has a different ID to prevent replay attacks.
 *      Signature: A valid signature of an owner of the Multisig for a transaction hash.
 *      Owners can only be added/removed by the multisig (same for changing the threshold
        and upgrading the contract)
 *      Change the owners, required,& upgradeDelay to your needs in src/deploy.ts 

The executionDelay starts once the threshold is met, and is not reset when another wallet approves the tx. It can be reset if a wallet revokes approval and the approval count goes below the threshold.

Anyone can send coins to the multisig using the receiveCoins functions.
Only owners can call submit, approve, execute & revoke functions.
Only the multisig itself can call addOwner, removeOwner, replaceOwner, changeRequirement, changeExecutionDelay, changeUpgradeDelay, proposeUpgrade & upgrade functions. Thus, they can only be called by submitting the call through the multisig, approving & executing it.

## Security

The code was fully audited for security by a third party professional security firm.
The report is publicly available as the [security_audit.pdf](security_audit.pdf) file at the root of the repository.

## Build

By default this will build all files in `assembly/contracts` directory.

```shell
npm run build
```

## Deploy the multisig

Prerequisites :

- You must add a `.env` file at the root of the repository with the following keys set to valid values:
- `PRIVATE_KEY="wallet_private_key"`
- `RPC_URL="https://..."` (optional, defaults to buildnet)

These keys will be the ones used by the deployment script to interact with the blockchain.

Adapt `required`, `owners` & `upgradeDelay` to your liking (cf. important concepts) in `src/deploy.ts`.

The following command will build contracts in `assembly/contracts` directory and execute the deployment script
`src/deploy.ts`. This script deploys `Multisig.wasm` directly and automatically runs its constructor.

```shell
npm run deploy
```

## Proposal lifecycle (important)

Submitting a proposal does **not** count as an approval for the proposing owner. The proposer must call approve separately if they want their confirmation included toward the threshold.

The approve flow only records confirmations. When the number of approvals reaches the threshold, the proposal is **not** executed automatically. Someone with the right to execute must call execute explicitly (and respect any `executionDelay` enforced on-chain after the threshold is met).

These behaviors are intentional in the current design. Automatically approving on behalf of the submitter, or automatically executing once the threshold is reached, could be explored as future improvements but are not implemented today.

## Create an add-member proposal

The repository also includes a helper script to submit a multisig proposal that adds a new owner.

```shell
npm run propose:add-member -- <multisig-address> <new-member-address>
```

The script uses the same `.env` configuration as deployment and prints the submitted operation id plus the final events emitted by the contract.

## Create a revoke-member proposal

The repository also includes a helper script to submit a multisig proposal that removes an existing owner.

```shell
npm run propose:revoke-member -- <multisig-address> <member-address>
```

The script uses the same `.env` configuration as deployment and prints the submitted operation id plus the final events emitted by the contract.

## Create a replace-member proposal

The repository also includes a helper script to submit a multisig proposal that replaces an existing owner with a new one.

```shell
npm run propose:replace-member -- <multisig-address> <current-member-address> <new-member-address>
```

The script uses the same `.env` configuration as deployment and prints the submitted operation id plus the final events emitted by the contract.

## Create a threshold proposal

The repository also includes a helper script to submit a multisig proposal that updates the required approval threshold.

```shell
npm run propose:threshold -- <multisig-address> <threshold>
```

The script uses the same `.env` configuration as deployment and prints the submitted operation id plus the final events emitted by the contract.

## Create an execution-delay proposal

The repository also includes a helper script to submit a multisig proposal that updates the execution delay.

```shell
npm run propose:execution-delay -- <multisig-address> <execution-delay>
```

The script uses the same `.env` configuration as deployment and prints the submitted operation id plus the final events emitted by the contract.

## Approve a proposal

The repository also includes a helper script to approve an existing multisig proposal by id.

```shell
npm run approve:proposal -- <multisig-address> <proposal-id>
```

The script uses the same `.env` configuration as deployment and prints the approval operation id plus the final events emitted by the contract.

## Execute a proposal

The repository also includes a helper script to execute an existing multisig proposal by id.

```shell
npm run execute:proposal -- <multisig-address> <proposal-id>
```

The script uses the same `.env` configuration as deployment and prints the execution operation id plus the final events emitted by the contract.

## List proposals

The repository also includes a read-only helper script to retrieve all multisig proposals and their current statuses.

```shell
npm run list:proposals -- <multisig-address>
```

The script prints a JSON array with each proposal's id, target, method, value, approvals, timestamp, execution flag, and derived status.

## Get multisig parameters

The repository also includes a read-only helper script to retrieve the multisig members, threshold, and execution delay directly from storage.

```shell
npm run get:multisig-parameters -- <multisig-address>
```

The script prints a JSON object containing the `members`, `threshold`, and `delay`.

## Unit tests

The test framework documentation is available here: [as-pect docs](https://as-pect.gitbook.io/as-pect)

```shell
npm run test
```

## Format code

```shell
npm run fmt
```
