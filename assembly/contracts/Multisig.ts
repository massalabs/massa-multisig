import {
  Args,
  Result,
  Serializable,
  bytesToFixedSizeArray,
  fixedSizeArrayToBytes,
  i32ToBytes,
  stringToBytes,
  bytesToI32,
} from '@massalabs/as-types';
import {
  Address,
  Context,
  Storage,
  call,
  createEvent,
  generateEvent,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { PersistentMap } from '../libraries/PersistentMap';

// STORAGE

const OWNERS = stringToBytes('owners');
const IS_OWNER = new PersistentMap<string, bool>('is_owner');
const REQUIRED = stringToBytes('required');
const TRANSACTIONS = new PersistentMap<u64, Transaction>('transactions');
const APPROVED = new PersistentMap<string, bool>('approved'); // @dev key is a combination of transaction id and owner address

// STRUCT

class Transaction implements Serializable {
  constructor(
    public to: Address = new Address(''),
    public value: u64 = 0,
    public data: StaticArray<u8> = [],
    public executed: bool = false,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.to)
      .add(this.value)
      .add(this.data)
      .add(this.executed)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    this.to = new Address(args.nextString().unwrap());
    this.value = args.nextU64().unwrap();
    this.data = args.nextBytes().unwrap();
    this.executed = args.nextBool().unwrap();
    return new Result(args.offset);
  }
}

// INTERFACE

export class IMultisig {
  constructor(public _origin: Address) {}

  init(owners: string[], required: i32): void {
    call(this._origin, 'constructor', new Args().add(owners).add(required), 0);
  }

  submit(to: string, value: u64, data: StaticArray<u8>): void {
    call(this._origin, 'submit', new Args().add(to).add(value).add(data), 0);
  }

  approve(txId: u64): void {
    call(this._origin, 'approve', new Args().add(txId), 0);
  }

  execute(txId: u64): void {
    call(this._origin, 'execute', new Args().add(txId), 0);
  }

  revoke(txId: u64): void {
    call(this._origin, 'revoke', new Args().add(txId), 0);
  }
}

// ENDPOINTS

export function constructor(bs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'already deployed');

  const args = new Args(bs);
  const owners = args.nextFixedSizeArray<string>().unwrap();
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

export function submit(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const to = new Address(args.nextString().unwrap());
  const value = args.nextU64().unwrap();
  const data = args.nextBytes().unwrap();

  _onlyOwner();

  const id = addTransaction(to, value, data);

  const event = createEvent('Submit', [
    id.toString(),
    to.toString(),
    value.toString(),
    data.toString(),
  ]);
  generateEvent(event);
}

export function approve(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notApproved(txId);
  _notExecuted(txId);

  APPROVED.set(buildApprovalKey(txId, Context.caller()), true);

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

  transferCoins(tx.to, tx.value);
  // OR
  // call(tx.to, 'receive', new Args().add(tx.data), tx.value);

  const event = createEvent('Execute', [txId.toString()]);
  generateEvent(event);
}

export function revoke(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notExecuted(txId);

  const key = buildApprovalKey(txId, Context.caller());
  assert(APPROVED.contains(key), 'tx not approved');
  APPROVED.set(key, false);

  const event = createEvent('Revoke', [
    Context.caller().toString(),
    txId.toString(),
  ]);
  generateEvent(event);
}

// MODIFIERS

function _onlyOwner(): void {
  assert(IS_OWNER.contains(Context.caller().toString()), 'not owner');
}

function _txExists(txId: u64): void {
  assert(TRANSACTIONS.contains(txId), 'tx does not exist');
}

function _notApproved(txId: u64): void {
  const key = buildApprovalKey(txId, Context.caller());
  assert(
    !APPROVED.contains(key) || !APPROVED.getSome(key),
    'tx already approved',
  );
}

function _notExecuted(txId: u64): void {
  assert(!TRANSACTIONS.getSome(txId).executed, 'tx already executed');
}

// GETTERS

function getApprovalCount(txId: u64): i32 {
  let count = 0;
  for (let i = 0; i < owners().length; i++) {
    if (APPROVED.contains(buildApprovalKey(txId, new Address(owners()[i])))) {
      count++;
    }
  }
  return count;
}

function owners(): string[] {
  return Storage.has(OWNERS)
    ? bytesToFixedSizeArray<string>(Storage.get(OWNERS))
    : [];
}

function required(): i32 {
  return bytesToI32(Storage.get(REQUIRED));
}

// HELPERS

function buildApprovalKey(txId: u64, owner: Address): string {
  return txId.toString() + owner.toString();
}

function addTransaction(to: Address, value: u64, data: StaticArray<u8>): u64 {
  const transaction = new Transaction(to, value, data, false);
  const id = TRANSACTIONS.size();
  TRANSACTIONS.set(id, transaction);
  return id;
}

function addOwner(owner: string): void {
  assert(!IS_OWNER.contains(owner), 'already owner');

  IS_OWNER.set(owner, true);

  const _owners = owners();
  _owners.push(owner);
  setOwners(_owners);
}

function removeOwner(owner: string): void {
  assert(IS_OWNER.contains(owner), 'not owner');

  IS_OWNER.delete(owner);

  const _owners = owners();
  const index = _owners.indexOf(owner);
  _owners.splice(index, 1);
  setOwners(_owners);
}

function setOwners(owners: string[]): void {
  Storage.set(OWNERS, fixedSizeArrayToBytes(owners));
}
