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

function parseCliArgs(): { multisigAddress: string; newMemberAddress: string } {
  const [multisigAddress, newMemberAddress] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !newMemberAddress) {
    throw new Error(
      'Usage: npm run propose:add-member -- <multisig-address> <new-member-address>',
    );
  }

  return { multisigAddress, newMemberAddress };
}

function buildAddOwnerProposal(
  multisigAddress: string,
  newMemberAddress: string,
): Transaction {
  const addOwnerCallData = new Uint8Array(
    new Args().addString(newMemberAddress).serialize(),
  );

  return new Transaction(
    multisigAddress,
    'addOwner',
    1_000_000n,
    addOwnerCallData,
    0n,
    false,
  );
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, newMemberAddress } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const proposal = buildAddOwnerProposal(multisigAddress, newMemberAddress);

console.log(
  `Submitting add-member proposal for ${newMemberAddress} to ${multisigAddress}`,
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
