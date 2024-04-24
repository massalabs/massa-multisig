import { Args, bytesToI32 } from '@massalabs/as-types';
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
  const _owners = owners();
  let count = 0;
  for (let i = 0; i < _owners.length; i++) {
    if (hasApproved(txId, new Address(_owners[i]))) {
      count++;
    }
  }
  return count;
}

export function owners(): string[] {
  return Storage.has(OWNERS)
    ? new Args(Storage.get(OWNERS)).nextStringArray().unwrap()
    : [];
}

export function required(): i32 {
  return bytesToI32(Storage.get(REQUIRED));
}

export function hasApproved(txId: u64, owner: Address): bool {
  return (
    APPROVED.contains(buildApprovalKey(txId, owner)) &&
    APPROVED.getSome(buildApprovalKey(txId, owner))
  );
}

export function setApproval(txId: u64, approved: bool): void {
  APPROVED.set(buildApprovalKey(txId, Context.caller()), approved);
}

// MODIFIERS

export function _onlyOwner(): void {
  assert(IS_OWNER.contains(Context.caller().toString()), 'not owner');
}

export function _txExists(txId: u64): void {
  assert(TRANSACTIONS.contains(txId), 'tx does not exist');
}

export function _notApproved(txId: u64): void {
  assert(!hasApproved(txId, Context.caller()), 'tx already approved');
}

export function _notExecuted(txId: u64): void {
  assert(!TRANSACTIONS.getSome(txId).executed, 'tx already executed');
}

export function _isMultisig(): void {
  assert(Context.callee() == Context.caller(), 'not multisig');
}

// HELPERS

export function buildApprovalKey(txId: u64, owner: Address): string {
  return txId.toString() + owner.toString();
}

export function addTransaction(transaction: Transaction): u64 {
  const id = TRANSACTIONS.size();
  // ensure timestamp was not wrongly set
  transaction.timestamp = 0;
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
  Storage.set(OWNERS, new Args().add(owners).serialize());
}
