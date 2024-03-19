import {
  Args,
  u64ToBytes,
  serializableObjectsArrayToBytes,
  i32ToBytes,
  nativeTypeArrayToBytes,
} from '@massalabs/as-types';
import {
  Address,
  Context,
  Storage,
  call,
  createEvent,
  generateEvent,
  isAddressEoa,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import {
  _notApproved,
  _notExecuted,
  _onlyOwner,
  _txExists,
  addOwner as _addOwner,
  addTransaction,
  getApprovalCount,
  hasApproved,
  required,
  removeOwner as _removeOwner,
  setApproval,
  owners,
  _isMultisig,
} from './multisig-internals';
import { REQUIRED, TRANSACTIONS } from '../storage/Multisig';
import { Transaction } from '../structs/Transaction';
import { Upgradeable } from '../libraries/Upgradeable';

/**
 * @dev Contract constructor sets initial owners and required number of confirmations.
 * @param {StaticArray<u8>} bs - Byte string containing the list of initial owners and required number of approvals
 */
export function constructor(bs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'already deployed');

  const args = new Args(bs);
  const owners: string[] = args.nextStringArray().unwrap();
  const required = args.nextI32().unwrap();
  assert(owners.length > 0, 'owners required');
  assert(required > 0 && required <= owners.length, 'invalid required');

  for (let i = 0; i < owners.length; i++) {
    _addOwner(owners[i]);
  }
  Storage.set(REQUIRED, i32ToBytes(required));
}

/**
 * @notice Function to receive coins
 * @param _ unused
 */
export function receive(_: StaticArray<u8>): void {
  const event = createEvent('Deposit', [
    Context.caller().toString(),
    Context.transferredCoins().toString(),
  ]);
  generateEvent(event);
}

/**
 * @dev Allows an owner to submit and confirm a transaction.
 * @param {StaticArray<u8>} bs - Byte string containing the transaction to submit
 * @returns Returns transaction ID.
 */
export function submit(bs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(bs);
  const tx = args.nextSerializable<Transaction>().unwrap();

  _onlyOwner();

  const id = addTransaction(tx);

  const event = createEvent('Submit', [id.toString()]);
  generateEvent(event);

  return u64ToBytes(id);
}

/**
 * @dev Allows an owner to confirm a transaction.
 * @param {StaticArray<u8>} bs - Byte string containing the transaction ID to approve
 */
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

/**
 * @dev Allows an owner to execute a confirmed transaction.
 * @param {StaticArray<u8>} bs - Byte string containing the transaction ID to execute
 */
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

  if (!isAddressEoa(tx.to.toString())) {
    call(tx.to, tx.method, new Args().add(tx.data), tx.value);
  } else {
    transferCoins(tx.to, tx.value);
  }

  const event = createEvent('Execute', [txId.toString()]);
  generateEvent(event);
}

/**
 * @dev Allows an owner to revoke a transaction.
 * @param {StaticArray<u8>} bs - Byte string containing the transaction ID to revoke
 */
export function revoke(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notExecuted(txId);

  assert(hasApproved(txId, Context.caller()), 'tx not approved');
  setApproval(txId, false);

  const event = createEvent('Revoke', [
    txId.toString(),
    Context.caller().toString(),
  ]);
  generateEvent(event);
}

// ======================================
// ===========  MULTISIG  ===============
// ======================================

/**
 * @dev Allows to add a new owner. Transaction has to be sent by the multisig contract itself.
 * @param bs byte string containing the owner Address of new owner.
 */
export function addOwner(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const owner = args.nextString().unwrap();

  _isMultisig();

  _addOwner(owner);

  const event = createEvent('AddOwner', [owner]);
  generateEvent(event);
}

/**
 * @dev Allows to remove an owner. Transaction has to be sent by the multisig contract itself.
 * @param bs byte string containing the owner Address of the owner to remove.
 */
export function removeOwner(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const owner = args.nextString().unwrap();

  _isMultisig();
  assert(owners().length - 1 >= required(), 'cannot remove owner');

  _removeOwner(owner);

  const event = createEvent('RemoveOwner', [owner]);
  generateEvent(event);
}

/**
 * @dev Allows to replace an owner. Transaction has to be sent by the multisig contract itself.
 * @param bs byte string containing the owner Address of the owner to replace and the Address of the new owner.
 */
export function replaceOwner(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const oldOwner = args.nextString().unwrap();
  const newOwner = args.nextString().unwrap();

  _isMultisig();

  _removeOwner(oldOwner);
  _addOwner(newOwner);

  const event = createEvent('ReplaceOwner', [oldOwner, newOwner]);
  generateEvent(event);
}

/**
 * @dev Allows to change the number of required confirmations. Transaction has to be sent by wallet.
 * @param _required Number of required confirmations.
 */
export function changeRequirement(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const required = args.nextI32().unwrap();

  _isMultisig();
  assert(required > 0 && required <= owners().length, 'invalid required');

  Storage.set(REQUIRED, i32ToBytes(required));

  const event = createEvent('ChangeRequirement', [required.toString()]);
  generateEvent(event);
}

export function proposeUpgrade(newImplementation: StaticArray<u8>): void {
  _isMultisig();
  Upgradeable.proposeUpgrade(newImplementation);
}

export function upgrade(_: StaticArray<u8>): void {
  _isMultisig();
  Upgradeable.upgrade();
}

// ======================================
// ============  VIEW  ==================
// ======================================

/**
 * @param _ unused
 * @returns the list of txs.
 */
export function getTransactions(_: StaticArray<u8>): StaticArray<u8> {
  const txs: Transaction[] = [];

  for (let i: usize = 0; i < TRANSACTIONS.size(); i++) {
    const tx = TRANSACTIONS.getSome(i);
    txs.push(tx);
  }

  return serializableObjectsArrayToBytes(txs);
}

/**
 * @param bs byte string containing the transaction ID.
 * @returns the addresses that approved the transaction.
 */
export function getApprovals(bs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  const approvals: string[] = [];
  const _owners = owners();

  for (let i = 0; i < owners.length; i++) {
    const owner = _owners[i];
    if (hasApproved(txId, new Address(owner))) {
      approvals.push(owner);
    }
  }

  return nativeTypeArrayToBytes(approvals);
}
