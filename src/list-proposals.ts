/* eslint-disable no-console */
import {
  Args,
  ArrayTypes,
  JsonRpcProvider,
  SmartContract,
} from '@massalabs/massa-web3';
import { Transaction } from './serializable/Transaction.js';

type ProposalStatus =
  | 'submitted'
  | 'pending-approvals'
  | 'approved'
  | 'executed';

type ProposalSummary = {
  id: number;
  to: string;
  method: string;
  value: string;
  approvals: string[];
  approvalsCount: number;
  status: ProposalStatus;
  timestamp: string;
  executed: boolean;
};

const STORAGE_KEYS = {
  owners: new TextEncoder().encode('owners'),
} as const;

function parseCliArgs(): { multisigAddress: string } {
  const [multisigAddress] = process.argv.slice(2).map((value) => value.trim());

  if (!multisigAddress) {
    throw new Error('Usage: npm run list:proposals -- <multisig-address>');
  }

  return { multisigAddress };
}

function getProposalStatus(
  transaction: Transaction,
  approvalsCount: number,
): ProposalStatus {
  if (transaction.executed) {
    return 'executed';
  }

  if (transaction.timestamp > 0n) {
    return 'approved';
  }

  if (approvalsCount > 0) {
    return 'pending-approvals';
  }

  return 'submitted';
}

function deserializeTransactions(data: Uint8Array): Transaction[] {
  const transactions: Transaction[] = [];
  let offset = 0;

  while (offset < data.length) {
    const result = new Transaction().deserialize(data, offset);
    transactions.push(result.instance);
    offset = result.offset;
  }

  return transactions;
}

function deserializeStringArray(data: Uint8Array): string[] {
  return new Args(data).nextArray<string>(ArrayTypes.STRING);
}

function buildApprovalStorageKey(txId: number, owner: string): Uint8Array {
  return new TextEncoder().encode(`approved::${txId}${owner}`);
}

function expectStorageValue(value: Uint8Array | null, fieldName: string): Uint8Array {
  if (!value) {
    throw new Error(`Missing "${fieldName}" in multisig storage`);
  }

  return value;
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress } = parseCliArgs();

const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl)
  : JsonRpcProvider.buildnet();

const multisig = new SmartContract(provider, multisigAddress);
const [ownersBytes] = await provider.readStorage(
  multisigAddress,
  [STORAGE_KEYS.owners],
  true,
);
const owners = deserializeStringArray(expectStorageValue(ownersBytes, 'owners'));

const transactionsResult = await multisig.read('getTransactions', new Args());

if (transactionsResult.info.error) {
  throw new Error(
    `Failed to retrieve proposals: ${transactionsResult.info.error}`,
  );
}

const transactions = deserializeTransactions(transactionsResult.value);

const proposals = await Promise.all(
  transactions.map(async (transaction, id): Promise<ProposalSummary> => {
    const approvalKeys = owners.map((owner) => buildApprovalStorageKey(id, owner));
    const approvalValues = await provider.readStorage(
      multisigAddress,
      approvalKeys,
      true,
    );
    const approvals = owners.filter((owner, ownerIndex) => {
      const approvalValue = approvalValues[ownerIndex];
      return approvalValue !== null && approvalValue[0] !== 0;
    });

    return {
      id,
      to: transaction.to,
      method: transaction.method,
      value: transaction.value.toString(),
      approvals,
      approvalsCount: approvals.length,
      status: getProposalStatus(transaction, approvals.length),
      timestamp: transaction.timestamp.toString(),
      executed: transaction.executed,
    };
  }),
);

console.log(JSON.stringify(proposals, null, 2));
