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

function parseCliArgs(): { multisigAddress: string; executionDelay: bigint } {
  const [multisigAddress, executionDelayRaw] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !executionDelayRaw) {
    throw new Error(
      'Usage: npm run propose:execution-delay -- <multisig-address> <execution-delay>',
    );
  }

  let executionDelay: bigint;

  try {
    executionDelay = BigInt(executionDelayRaw);
  } catch {
    throw new Error(`Invalid execution delay: ${executionDelayRaw}`);
  }

  if (executionDelay < 0n) {
    throw new Error('Execution delay must be a non-negative integer');
  }

  return { multisigAddress, executionDelay };
}

function buildExecutionDelayProposal(
  multisigAddress: string,
  executionDelay: bigint,
): Transaction {
  const changeExecutionDelayCallData = new Uint8Array(
    new Args().addU64(executionDelay).serialize(),
  );

  return new Transaction(
    multisigAddress,
    'changeExecutionDelay',
    1_000_000n,
    changeExecutionDelayCallData,
    0n,
    false,
  );
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, executionDelay } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const proposal = buildExecutionDelayProposal(multisigAddress, executionDelay);

console.log(
  `Submitting execution-delay proposal for ${multisigAddress} with new delay ${executionDelay}`,
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
