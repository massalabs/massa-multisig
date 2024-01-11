import {
  Args,
  u64ToBytes,
  serializableObjectsArrayToBytes,
  i32ToBytes,
} from '@massalabs/as-types';
import {
  Address,
  Context,
  Storage,
  call,
  createEvent,
  generateEvent,
  getBytecodeOf,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import {
  _notApproved,
  _notExecuted,
  _onlyOwner,
  _txExists,
  addOwner,
  addTransaction,
  getApprovalCount,
  hasApproved,
  required,
  setApproval,
} from './multisig-internals';
import { REQUIRED, APPROVED, TRANSACTIONS } from '../storage/Multisig';
import { Transaction } from '../structs/Transaction';

export function constructor(bs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'already deployed');

  const args = new Args(bs);
  const owners: string[] = args.nextStringArray().unwrap();
  const required = args.nextI32().unwrap();
  assert(owners.length > 0, 'owners required');
  assert(required > 0 && required <= owners.length, 'invalid required');

  for (let i = 0; i < owners.length; i++) {
    addOwner(owners[i]);
  }
  Storage.set(REQUIRED, i32ToBytes(required));
}

export function receive(_: StaticArray<u8>): void {
  const event = createEvent('Deposit', [
    Context.caller().toString(),
    Context.transferredCoins().toString(),
  ]);
  generateEvent(event);
}

export function submit(bs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(bs);
  const to = new Address(args.nextString().unwrap());
  const method = args.nextString().unwrap();
  const value = args.nextU64().unwrap();
  const data = args.nextBytes().unwrap();

  _onlyOwner();

  const id = addTransaction(to, method, value, data);

  const event = createEvent('Submit', [
    id.toString(),
    to.toString(),
    value.toString(),
    data.toString(),
  ]);
  generateEvent(event);

  return u64ToBytes(id);
}

export function approve(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notApproved(txId);
  _notExecuted(txId);

  setApproval(txId, true);

  const event = createEvent('Approve', [
    txId.toString(),
    Context.caller().toString(),
  ]);
  generateEvent(event);
}

export function execute(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notExecuted(txId);

  assert(getApprovalCount(txId) >= required(), 'not enough approvals');

  const tx = TRANSACTIONS.getSome(txId);
  tx.executed = true;
  TRANSACTIONS.set(txId, tx);

  if (getBytecodeOf(tx.to).length > 0) {
    // is contract
    call(tx.to, 'receive', new Args().add(tx.data), tx.value);
  } else {
    transferCoins(tx.to, tx.value);
  }

  const event = createEvent('Execute', [txId.toString()]);
  generateEvent(event);
}

export function revoke(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notExecuted(txId);

  assert(hasApproved(txId, Context.caller()), 'tx not approved');
  setApproval(txId, false);

  const event = createEvent('Revoke', [
    Context.caller().toString(),
    txId.toString(),
  ]);
  generateEvent(event);
}

// ======================================
// ============  VIEW  ==================
// ======================================

// TODO: include approvals

export function getTransactions(_: StaticArray<u8>): StaticArray<u8> {
  const txs: Transaction[] = [];

  for (let i: usize = 0; i < TRANSACTIONS.size(); i++) {
    const tx = TRANSACTIONS.getSome(i);
    txs.push(tx);
  }

  return serializableObjectsArrayToBytes(txs);
}
