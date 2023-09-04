import {
  bytesToFixedSizeArray,
  bytesToI32,
  fixedSizeArrayToBytes,
} from '@massalabs/as-types';
import { Address, Context, Storage } from '@massalabs/massa-as-sdk';
import { Transaction } from '../structs/Transaction';
import {
  APPROVED,
  OWNERS,
  REQUIRED,
  IS_OWNER,
  TRANSACTIONS,
} from '../storage/Multisig';

// GETTERS

export function getApprovalCount(txId: u64): i32 {
  let count = 0;
  for (let i = 0; i < owners().length; i++) {
    if (APPROVED.contains(buildApprovalKey(txId, new Address(owners()[i])))) {
      count++;
    }
  }
  return count;
}

export function owners(): string[] {
  return Storage.has(OWNERS)
    ? bytesToFixedSizeArray<string>(Storage.get(OWNERS))
    : [];
}

export function required(): i32 {
  return bytesToI32(Storage.get(REQUIRED));
}

// MODIFIERS

export function _onlyOwner(): void {
  assert(IS_OWNER.contains(Context.caller().toString()), 'not owner');
}

export function _txExists(txId: u64): void {
  assert(TRANSACTIONS.contains(txId), 'tx does not exist');
}

export function _notApproved(txId: u64): void {
  const key = buildApprovalKey(txId, Context.caller());
  assert(
    !APPROVED.contains(key) || !APPROVED.getSome(key),
    'tx already approved',
  );
}

export function _notExecuted(txId: u64): void {
  assert(!TRANSACTIONS.getSome(txId).executed, 'tx already executed');
}

// HELPERS
export function buildApprovalKey(txId: u64, owner: Address): string {
  return txId.toString() + owner.toString();
}

export function addTransaction(
  to: Address,
  value: u64,
  data: StaticArray<u8>,
): u64 {
  const transaction = new Transaction(to, value, data, false);
  const id = TRANSACTIONS.size();
  TRANSACTIONS.set(id, transaction);
  return id;
}

export function addOwner(owner: string): void {
  assert(!IS_OWNER.contains(owner), 'already owner');

  IS_OWNER.set(owner, true);

  const _owners = owners();
  _owners.push(owner);
  setOwners(_owners);
}

export function removeOwner(owner: string): void {
  assert(IS_OWNER.contains(owner), 'not owner');

  IS_OWNER.delete(owner);

  const _owners = owners();
  const index = _owners.indexOf(owner);
  _owners.splice(index, 1);
  setOwners(_owners);
}

export function setOwners(owners: string[]): void {
  Storage.set(OWNERS, fixedSizeArrayToBytes(owners));
}
