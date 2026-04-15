/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  JsonRpcProvider,
  OperationStatus,
  SmartContract,
} from '@massalabs/massa-web3';
import { Transaction } from './serializable/Transaction.js';

dotenv.config();

function parseCliArgs(): { multisigAddress: string; memberAddress: string } {
  const [multisigAddress, memberAddress] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !memberAddress) {
    throw new Error(
      'Usage: npm run propose:revoke-member -- <multisig-address> <member-address>',
    );
  }

  return { multisigAddress, memberAddress };
}

function buildRemoveOwnerProposal(
  multisigAddress: string,
  memberAddress: string,
): Transaction {
  const removeOwnerCallData = new Uint8Array(
    new Args().addString(memberAddress).serialize(),
  );

  return new Transaction(
    multisigAddress,
    'removeOwner',
    1_000_000n,
    removeOwnerCallData,
    0n,
    false,
  );
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, memberAddress } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const proposal = buildRemoveOwnerProposal(multisigAddress, memberAddress);

console.log(
  `Submitting revoke-member proposal for ${memberAddress} to ${multisigAddress}`,
);

const operation = await multisig.call('submit', proposal.serialize());

console.log(`Operation id: ${operation.id}`);

const finalStatus = await operation.waitFinalExecution();
const finalEvents = await operation.getFinalEvents();

console.log(`Final status: ${OperationStatus[finalStatus]}`);

if (finalEvents.length > 0) {
  console.log('Final events:');
  for (const event of finalEvents) {
    console.log(`- ${event.data}`);
  }
}

if (finalStatus !== OperationStatus.Success) {
  throw new Error(
    `Proposal submission failed with status ${OperationStatus[finalStatus]}`,
  );
}
