import {
  submit,
  approve,
  constructor,
  getTransactions,
} from '../contracts/Multisig';
import { mockAdminContext, Address } from '@massalabs/massa-as-sdk';
import {
  Args,
  u64ToBytes,
  bytesToSerializableObjectArray,
} from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';
import { Transaction } from '../structs/Transaction';
import {
  getApprovalCount,
  hasApproved,
  required,
  owners,
} from '../contracts/multisig-internals';

// address of the contract set in vm-mock. must match with contractAddr of @massalabs/massa-as-sdk/vm-mock/vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// default deployer address (caller != callee so Context.isDeployingContract() is true)
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// the single owner of the multisig
const soloOwner = 'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC';

// a non-owner for negative testing
const nonOwner = 'AU125TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

// destination for the dummy transaction
const destination = 'AU155TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

function retrieveOperation(opIndex: i32): Transaction {
  let operationList = bytesToSerializableObjectArray<Transaction>(
    getTransactions([]),
  ).unwrap();
  return operationList[opIndex];
}

beforeAll(() => {
  resetStorage();
  mockAdminContext(true);
});

describe('Single-owner multisig tests', () => {
  test('constructor rejects 0 owners', () => {
    expect(() => {
      const serializedArgs = new Args()
        .add<Array<string>>([])
        .add(i32(1))
        .add(u64(0))
        .add(u64(0))
        .serialize();
      constructor(serializedArgs);
    }).toThrow();
  });

  test('constructor accepts a single owner with required=1', () => {
    resetStorage();
    // Context.isDeployingContract() requires caller != callee.
    changeCallStack(deployerAddress + ' , ' + contractAddr);

    expect(() => {
      constructor(
        new Args()
          .add<Array<string>>([soloOwner])
          .add(i32(1))
          .add(u64(0))
          .add(u64(0))
          .serialize(),
      );
    }).not.toThrow();

    // check the owner list has exactly one entry matching soloOwner
    const storedOwners = owners();
    expect(storedOwners.length).toBe(1);
    expect(storedOwners[0]).toBe(soloOwner);

    // required number of confirmations is 1
    expect(required()).toBe(1);
  });

  test('non-owner cannot submit a transaction', () => {
    switchUser(nonOwner);
    expect(() => {
      submit(
        new Args()
          .add(
            new Transaction(
              new Address(destination),
              '',
              u64(15000),
              [],
              0,
              false,
            ),
          )
          .serialize(),
      );
    }).toThrow();
  });

  test('solo owner can submit and approve (single approval validates)', () => {
    switchUser(soloOwner);

    const tx = new Transaction(
      new Address(destination),
      '',
      u64(15000),
      [],
      0,
      false,
    );

    // submit returns txId 0 (first tx)
    const opId: u64 = 0;
    expect(submit(new Args().add(tx).serialize())).toStrictEqual(
      u64ToBytes(opId),
    );

    // before approval, timestamp is 0 and approval count is 0
    expect(retrieveOperation(i32(opId)).timestamp).toBe(0);
    expect(getApprovalCount(opId)).toBe(0);

    // solo owner approves
    approve(new Args().add(opId).serialize());

    // the owner's approval is recorded
    expect(hasApproved(opId, new Address(soloOwner))).toBe(true);

    // approval count equals the required threshold (1) so the tx is validated:
    // a non-zero timestamp must have been set for it.
    expect(getApprovalCount(opId)).toBe(required());
    expect(retrieveOperation(i32(opId)).timestamp).toBeGreaterThan(0);
  });

  test('solo owner cannot approve the same tx twice', () => {
    switchUser(soloOwner);
    const opId: u64 = 0;
    expect(() => {
      approve(new Args().add(opId).serialize());
    }).toThrow();
  });
});
