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

function parseCliArgs(): {
  multisigAddress: string;
  currentMemberAddress: string;
  newMemberAddress: string;
} {
  const [multisigAddress, currentMemberAddress, newMemberAddress] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !currentMemberAddress || !newMemberAddress) {
    throw new Error(
      'Usage: npm run propose:replace-member -- <multisig-address> <current-member-address> <new-member-address>',
    );
  }

  return { multisigAddress, currentMemberAddress, newMemberAddress };
}

function buildReplaceOwnerProposal(
  multisigAddress: string,
  currentMemberAddress: string,
  newMemberAddress: string,
): Transaction {
  const replaceOwnerCallData = new Uint8Array(
    new Args().addString(currentMemberAddress).addString(newMemberAddress).serialize(),
  );

  return new Transaction(
    multisigAddress,
    'replaceOwner',
    1_000_000n,
    replaceOwnerCallData,
    0n,
    false,
  );
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, currentMemberAddress, newMemberAddress } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const proposal = buildReplaceOwnerProposal(
  multisigAddress,
  currentMemberAddress,
  newMemberAddress,
);

console.log(
  `Submitting replace-member proposal on ${multisigAddress}: ${currentMemberAddress} -> ${newMemberAddress}`,
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
