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

function parseCliArgs(): { multisigAddress: string; threshold: number } {
  const [multisigAddress, thresholdRaw] = process.argv
    .slice(2)
    .map((value) => value.trim());

  if (!multisigAddress || !thresholdRaw) {
    throw new Error(
      'Usage: npm run propose:threshold -- <multisig-address> <threshold>',
    );
  }

  const threshold = Number(thresholdRaw);

  if (!Number.isInteger(threshold) || threshold <= 0) {
    throw new Error(`Invalid threshold: ${thresholdRaw}`);
  }

  if (threshold > 2_147_483_647) {
    throw new Error(
      `Threshold is too large for i32 encoding: ${thresholdRaw}`,
    );
  }

  return { multisigAddress, threshold };
}

function buildThresholdProposal(
  multisigAddress: string,
  threshold: number,
): Transaction {
  const changeRequirementCallData = new Uint8Array(
    new Args().addI32(threshold).serialize(),
  );

  return new Transaction(
    multisigAddress,
    'changeRequirement',
    1_000_000n,
    changeRequirementCallData,
    0n,
    false,
  );
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress, threshold } = parseCliArgs();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const multisig = new SmartContract(provider, multisigAddress);
const proposal = buildThresholdProposal(multisigAddress, threshold);

console.log(
  `Submitting threshold proposal for ${multisigAddress} with new threshold ${threshold}`,
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
