import {
  Args,
  u64ToBytes,
  serializableObjectsArrayToBytes,
  i32ToBytes,
  nativeTypeArrayToBytes,
  bytesToU64,
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
import { DELAY, REQUIRED, TRANSACTIONS } from '../storage/Multisig';
import { Transaction } from '../structs/Transaction';
import { Upgradeable } from '../libraries/Upgradeable';
import { SafeMath } from '../libraries/SafeMath';

/**
 * @dev Contract constructor sets initial owners and required number of confirmations.
 * @param {StaticArray<u8>} bs - Byte string containing
 * - the list of initial owners
 * - required number of approvals
 * - the upgrade delay
 * - the execution delay
 */
export function constructor(bs: StaticArray<u8>): void {
  assert(Context.isDeployingContract(), 'already deployed');

  const args = new Args(bs);
  const owners: string[] = args.nextStringArray().expect('owners not found');
  const required = args.nextI32().expect('required not found');
  const upgradeDelay = args.nextU64().expect('upgradeDelay not found');
  const executionDelay = args.nextU64().expect('executionDelay not found');

  Upgradeable.__Upgradeable_init(upgradeDelay);
  assert(owners.length > 1, 'At least 2 owners required');
  assert(required > 0 && required <= owners.length, 'invalid required');

  for (let i = 0; i < owners.length; i++) {
    _addOwner(owners[i]);
  }
  Storage.set(REQUIRED, i32ToBytes(required));
  Storage.set(DELAY, u64ToBytes(executionDelay));
}

/**
 * @notice Function to receive coins
 * @param _ unused
 */
export function receiveCoins(_: StaticArray<u8>): void {
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

  if (getApprovalCount(txId) == required()) {
    const tx = TRANSACTIONS.getSome(txId);
    tx.timestamp = Context.timestamp();
    TRANSACTIONS.set(txId, tx);
  }

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

  assert(
    SafeMath.add(tx.timestamp, bytesToU64(Storage.get(DELAY))) <=
      Context.timestamp(),
    'delay not passed',
  );

  tx.executed = true;
  TRANSACTIONS.set(txId, tx);

  if (!isAddressEoa(tx.to.toString())) {
    call(tx.to, tx.method, new Args(tx.data), tx.value);
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

  if (getApprovalCount(txId) == required()) {
    const tx = TRANSACTIONS.getSome(txId);
    tx.timestamp = u64(0);
    TRANSACTIONS.set(txId, tx);
  }

  setApproval(txId, false);

  const event = createEvent('Revoke', [
    txId.toString(),
    Context.caller().toString(),
  ]);
  generateEvent(event);
}

export function setTimestamp(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const txId = args.nextU64().unwrap();

  _onlyOwner();
  _txExists(txId);
  _notExecuted(txId);

  if (getApprovalCount(txId) >= required()) {
    const tx = TRANSACTIONS.getSome(txId);
    assert(tx.timestamp == u64(0), 'timestamp already set');
    tx.timestamp = Context.timestamp();
    TRANSACTIONS.set(txId, tx);

    const event = createEvent('SetTimestamp', [txId.toString()]);
    generateEvent(event);
  }
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
  assert(
    owners().length - 1 >= required() && owners().length > 2,
    'cannot remove owner',
  );

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

/**
 * @dev Allows to change the delay necessary before the execution of a tx. Transaction has to be sent by wallet.
 * @param executionDelay time between the validation & the execution of a tx in ms.
 */
export function changeExecutionDelay(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const executionDelay = args.nextU64().unwrap();

  _isMultisig();

  Storage.set(DELAY, u64ToBytes(executionDelay));

  const event = createEvent('changeExecutionDelay', [
    executionDelay.toString(),
  ]);
  generateEvent(event);
}

/**
 * @dev Allows to change the delay necessary before a SC upgrade. Transaction has to be sent by wallet.
 * @param upgradeDelay time between the proposition & validation of an upgrade in ms.
 */
export function changeUpgradeDelay(bs: StaticArray<u8>): void {
  const args = new Args(bs);
  const upgradeDelay = args.nextU64().unwrap();

  _isMultisig();

  Upgradeable.__Upgradeable_setUpgradeDelay(upgradeDelay);

  const event = createEvent('changeUpgradeDelay', [upgradeDelay.toString()]);
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
