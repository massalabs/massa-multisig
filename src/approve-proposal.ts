/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import {
  Account,
  Args,
  JsonRpcProvider,
  OperationStatus,
  SmartContract,
} from '@massalabs/massa-web3';

dotenv.config();

function parseCliArgs(): { multisigAddress: string; proposalId: bigint } {
  const [multisigAddress, proposalIdRaw] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !proposalIdRaw) {
    throw new Error(
      'Usage: npm run approve:proposal -- <multisig-address> <proposal-id>',
    );
  }

  let proposalId: bigint;

  try {
    proposalId = BigInt(proposalIdRaw);
  } catch {
    throw new Error(`Invalid proposal id: ${proposalIdRaw}`);
  }

  if (proposalId < 0n) {
    throw new Error('Proposal id must be a non-negative integer');
  }

  return { multisigAddress, proposalId };
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, proposalId } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const approveArgs = new Args().addU64(proposalId).serialize();

console.log(`Approving proposal ${proposalId} on ${multisigAddress}`);

const operation = await multisig.call('approve', approveArgs);

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
    `Proposal approval failed with status ${OperationStatus[finalStatus]}`,
  );
}
