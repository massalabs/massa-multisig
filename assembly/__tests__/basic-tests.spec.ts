import {
  submit,
  approve,
  constructor,
  getTransactions,
  execute,
  revoke,
} from '../contracts/Multisig';
import {
  Storage,
  mockAdminContext,
  Address,
  balanceOf,
} from '@massalabs/massa-as-sdk';
import { mockBalance } from '@massalabs/massa-as-sdk/assembly/vm-mock';
import {
  Args,
  u64ToBytes,
  stringToBytes,
  bytesToString,
  serializableObjectsArrayToBytes,
  bytesToSerializableObjectArray,
  Serializable,
  Result,
  bytesToU32,
} from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';
import { Transaction } from '../structs/Transaction';
import { getApprovalCount, hasApproved } from '../contracts/multisig-internals';
import { OWNERS, REQUIRED } from '../storage/Multisig';

// address of admin caller set in vm-mock. must match with adminAddress of @massalabs/massa-as-sdk/vm-mock/vm.js
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// address of the contract set in vm-mock. must match with contractAddr of @massalabs/massa-as-sdk/vm-mock/vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// nb of confirmations required
const nbConfirmations: i32 = 2;

// the multisig owners
const owners: Array<string> = [
  'A12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq',
  'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC',
  'AU125TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb',
];

// where operation funds are sent when a transaction operation is executed
const destination = 'AU155TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

// owners declared to the constructor for testing.
const ownerList = [owners[0], owners[1], owners[2]];

// transactions
const transactions: Array<Transaction> = [
  new Transaction(new Address(destination), '', u64(15000), [], 0, false),
  new Transaction(
    new Address(destination),
    'getValueAt',
    u64(15000),
    new Args().add(42).serialize(),
    0,
    false,
  ),
];

// ======================================================== //
// ====              HELPER FUNCTIONS                  ==== //
// ======================================================== //

function retrieveOperation(opIndex: i32): Transaction {
  let operationList = bytesToSerializableObjectArray<Transaction>(
    getTransactions([]),
  ).unwrap();
  return operationList[opIndex];
}

// string are not serializable by default, we need this helper class
class SerializableString implements Serializable {
  s: string;

  constructor(s: string = '') {
    this.s = s;
  }

  public serialize(): StaticArray<u8> {
    return stringToBytes(this.s);
  }

  public deserialize(data: StaticArray<u8>, _offset: i32): Result<i32> {
    this.s = bytesToString(data);
    return new Result<i32>(0);
  }
}

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

beforeAll(() => {
  resetStorage();
  mockAdminContext(true);
});

describe('Multisig contract tests', () => {
  test('constructor', () => {
    // ---------------------------
    // check invalid constructors

    // 0 confirmations
    expect(() => {
      const serializedArgs = new Args()
        .add<Array<string>>(ownerList)
        .add(i32(0))
        .add(u64(0))
        .add(u64(0))
        .serialize();
      constructor(serializedArgs);
    }).toThrow();

    // no owners
    expect(() => {
      const serializedArgs = new Args()
        .add<Array<string>>([])
        .add(i32(1))
        .add(u64(0))
        .add(u64(0))
        .serialize();
      constructor(serializedArgs);
    }).toThrow();

    // no Delay
    expect(() => {
      const serializedArgs = new Args()
        .add<Array<string>>([])
        .add(i32(1))
        .add(u64(0))
        .serialize();
      constructor(serializedArgs);
    }).toThrow();

    // invalid args
    expect(() => {
      constructor([]);
    }).toThrow();

    resetStorage();

    // -------------------------------------------------------
    // define a valid constructor for a 2:4 multisig
    const serializedArgs = new Args()
      .add<Array<string>>(ownerList)
      .add(nbConfirmations)
      .add(u64(0))
      .add(u64(0))
      .serialize();
    constructor(serializedArgs);

    // check the nb of confirmations required is properly stored
    expect(bytesToU32(Storage.get(REQUIRED))).toBe(nbConfirmations);

    // compare the array of addresses as string to the array of Address in storage
    let serializableStringList: Array<SerializableString> = [];
    for (let i = 0; i < ownerList.length; ++i)
      serializableStringList.push(new SerializableString(ownerList[i]));
    let ownersFromStorage = new Args(Storage.get(OWNERS))
      .nextStringArray()
      .unwrap();
    let serializableOwnerStringList: Array<SerializableString> = [];
    for (let i = 0; i < ownersFromStorage.length; ++i)
      serializableOwnerStringList.push(
        new SerializableString(ownersFromStorage[i].toString()),
      );
    expect(
      serializableObjectsArrayToBytes<SerializableString>(
        serializableOwnerStringList,
      ),
    ).toStrictEqual(
      serializableObjectsArrayToBytes<SerializableString>(
        serializableStringList,
      ),
    );

    // check that there are no operation registered yet
    let operationList = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap();
    expect(operationList.length).toBe(0);
  });

  test('submit operation by non owner', () => {
    // expect the operation submission to fail
    expect(() => {
      submit(new Args().add(transactions[0]).serialize());
    }).toThrow();
  });

  test('submit transaction operation', () => {
    // pick owners[1] as the operation creator
    switchUser(owners[1]);

    // expect the operation index to be 1
    expect(submit(new Args().add(transactions[0]).serialize())).toStrictEqual(
      u64ToBytes(0),
    );

    let transaction = retrieveOperation(0);

    // check the transaction content
    expect(transaction.to).toBe(new Address(destination));
    expect(transaction.value).toBe(u64(15000));
    expect(transaction.executed).toBe(false);
  });

  // non validated operation
  test('confirm transaction operation [owners[0]]', () => {
    // pick owners[1] as the operation creator
    switchUser(owners[1]);

    let confirmingOwnersIndexes: Array<u8>;
    let opIndex: u64;

    confirmingOwnersIndexes = [0];
    opIndex = 1;

    expect(submit(new Args().add(transactions[0]).serialize())).toStrictEqual(
      u64ToBytes(opIndex),
    );

    let ownerAddress = owners[confirmingOwnersIndexes[0]];
    switchUser(ownerAddress);
    approve(new Args().add(opIndex).serialize());

    switchUser(deployerAddress);
    expect(hasApproved(opIndex, new Address(ownerAddress)));
    expect(retrieveOperation(1).timestamp).toBe(0);
  });

  // validated operation
  test('confirm transaction operation [owners[1], owners[2]]', () => {
    // pick owners[1] as the operation creator
    switchUser(owners[1]);

    let confirmingOwnersIndexes: Array<u8>;
    let opIndex: u64;

    confirmingOwnersIndexes = [1, 2];
    opIndex = 2;

    expect(submit(new Args().add(transactions[0]).serialize())).toStrictEqual(
      u64ToBytes(opIndex),
    );

    for (let i = 0; i < confirmingOwnersIndexes.length; ++i) {
      let ownerAddress = owners[confirmingOwnersIndexes[i]];
      switchUser(ownerAddress);
      approve(new Args().add(opIndex).serialize());

      expect(hasApproved(opIndex, new Address(ownerAddress)));
    }

    switchUser(deployerAddress);
    expect(getApprovalCount(opIndex)).toBe(2);
    expect(retrieveOperation(2).timestamp).toBeGreaterThan(0);
  });

  // validated operation 2
  test('confirm transaction operation [owners[1], owners[2]]', () => {
    // pick owners[1] as the operation creator
    switchUser(owners[1]);

    let confirmingOwnersIndexes: Array<u8>;
    let opIndex: u64;

    confirmingOwnersIndexes = [1, 2];
    opIndex = 3;

    expect(submit(new Args().add(transactions[0]).serialize())).toStrictEqual(
      u64ToBytes(opIndex),
    );

    for (let i = 0; i < confirmingOwnersIndexes.length; ++i) {
      let ownerAddress = owners[confirmingOwnersIndexes[i]];
      switchUser(ownerAddress);
      approve(new Args().add(opIndex).serialize());

      expect(hasApproved(opIndex, new Address(ownerAddress)));
    }

    switchUser(deployerAddress);
    expect(getApprovalCount(opIndex)).toBe(2);
    expect(retrieveOperation(3).timestamp).toBeGreaterThan(0);
  });

  // test of the call operation constructor
  test('submit call operation', () => {
    // pick owners[1] as the operation creator
    switchUser(owners[1]);

    expect(submit(new Args().add(transactions[1]).serialize())).toStrictEqual(
      u64ToBytes(4),
    );

    // check that the operation is correctly stored
    let transaction = retrieveOperation(4);

    // check the operation content
    expect(transaction.to).toBe(new Address(destination));
    expect(transaction.value).toBe(u64(15000));
    expect(transaction.method).toBe('getValueAt');
    expect(transaction.data).toStrictEqual(new Args().add(42).serialize());
  });

  // operation 2 is validated, let's execute it
  test('execute transaction operation with success', () => {
    // Fund the multisig so transferCoins in execute() has balance to move.
    // The multisig has two validated 15000-coin transactions (op 2 and op 3)
    // but only op 2 will actually be executed in this test, so 15000 is enough.
    mockBalance(contractAddr, u64(15000));

    const initDestinationBalance = balanceOf(destination);
    const initContractBalance = balanceOf(contractAddr);

    switchUser(owners[1]);
    execute(new Args().add(u64(2)).serialize());

    // op 2 is marked as executed
    const transaction = retrieveOperation(i32(2));
    expect(transaction.executed).toBe(true);

    // the coins were actually transferred from the multisig to the destination
    expect(balanceOf(destination)).toBe(initDestinationBalance + u64(15000));
    expect(balanceOf(contractAddr) + u64(15000)).toBe(initContractBalance);
  });

  // operation 1 is not validated (only 1/2 approvals), let's try to execute it
  test('execute transaction operation with failure', () => {
    const initDestinationBalance = balanceOf(destination);
    const initContractBalance = balanceOf(contractAddr);

    switchUser(owners[1]);

    // execute must revert because op 1 doesn't meet the required threshold
    expect(() => {
      execute(new Args().add(u64(1)).serialize());
    }).toThrow();

    // the operation is still in storage
    expect(() => {
      retrieveOperation(i32(1));
    }).not.toThrow();

    // no funds moved
    expect(balanceOf(destination)).toBe(initDestinationBalance);
    expect(balanceOf(contractAddr)).toBe(initContractBalance);
  });

  // operation 3 is validated by owners[1] & owners[2].
  // now owners[1] will revoke it and we will try to execute it.
  test('revoke operation', () => {
    const initOperationListLength = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap().length;

    const initDestinationBalance = balanceOf(destination);
    const initContractBalance = balanceOf(contractAddr);

    // owners[1] revokes his approval on op 3. op 3 now has only 1 approval,
    // which is below the required threshold.
    switchUser(owners[1]);
    revoke(new Args().add(u64(3)).serialize());

    // the approval threshold is no longer met, so execute must revert.
    expect(() => {
      execute(new Args().add(u64(3)).serialize());
    }).toThrow();

    // the operation list is untouched (nothing gets deleted)
    const operationList = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap();
    expect(operationList.length).toBe(initOperationListLength);

    // op 3 is still present in storage, not executed, and the revocation
    // reset its validation timestamp back to 0.
    const operation = retrieveOperation(i32(3));
    expect(operation.to).toBe(new Address(destination));
    expect(operation.value).toBe(u64(15000));
    expect(operation.executed).toBe(false);
    expect(operation.timestamp).toBe(u64(0));

    // no funds moved
    expect(balanceOf(destination)).toBe(initDestinationBalance);
    expect(balanceOf(contractAddr)).toBe(initContractBalance);
  });

  test('check operation list', () => {
    let operationList = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap();
    expect(operationList.length).toBe(5);
  });
});
