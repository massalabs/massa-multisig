import {
  submit,
  approve,
  constructor,
  getTransactions,
} from '../contracts/Multisig';
import { Storage, mockAdminContext, Address } from '@massalabs/massa-as-sdk';
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
  new Transaction(new Address(destination), '', u64(15000), [], false),
  new Transaction(
    new Address(destination),
    'getValueAt',
    u64(15000),
    new Args().add(42).serialize(),
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
        .serialize();
      constructor(serializedArgs);
    }).toThrow();

    // no owners
    expect(() => {
      const serializedArgs = new Args()
        .add<Array<string>>([])
        .add(i32(1))
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

  // TODO: can't test transferCoins & call operation on massa for now
  // // operation 2 is validated, let's execute it
  // test('execute transaction operation with success', () => {
  //   let destinationBalance = Coins.balanceOf(destination);
  //   let contractBalance = Coins.balanceOf(contractAddr);
  //   let initDestinationBalance = destinationBalance;
  //   let initContractBalance = contractBalance;

  //   switchUser(owners[1]);
  //   generateEvent(
  //     createEvent('BALANCES BEFORE', [
  //       initDestinationBalance.toString(),
  //       initContractBalance.toString(),
  //     ]),
  //   );

  //   expect(() => {
  //     execute(new Args().add(u64(2)).serialize());
  //   }).not.toThrow();

  //   // retrieve the operation and check that it is marked as executed
  //   let transaction = retrieveOperation(i32(2));
  //   expect(transaction.executed).toBe(true);

  //   destinationBalance = Coins.balanceOf(destination);
  //   contractBalance = Coins.balanceOf(contractAddr);
  //   generateEvent(
  //     createEvent('BALANCES AFTER', [
  //       destinationBalance.toString(),
  //       contractBalance.toString(),
  //     ]),
  //   );

  //   // check that the transfer has been done
  //   expect(destinationBalance).toBe(initDestinationBalance + 15000);
  //   expect(contractBalance + 15000).toBe(initContractBalance);
  // });

  //   // operation 1 is not validated, let's try to execute it
  //   test('execute transaction operation with failure', () => {
  //     let destinationBalance = Coins.balanceOf(destination);
  //     let contractBalance = Coins.balanceOf(contractAddr);
  //     let initDestinationBalance = destinationBalance;
  //     let initContractBalance = contractBalance;

  //     switchUser(owners[1]);
  //     generateEvent(
  //       createEvent('BALANCES BEFORE', [
  //         initDestinationBalance.toString(),
  //         initContractBalance.toString(),
  //       ]),
  //     );

  //     expect(() => {
  //       execute(new Args().add(u64(1)).serialize());
  //     }).toThrow();

  //     // the operation is not supposed to be deleted
  //     expect(() => {
  //       retrieveOperation(i32(1));
  //     }).not.toThrow();

  //     destinationBalance = Coins.balanceOf(destination);
  //     contractBalance = Coins.balanceOf(contractAddr);
  //     generateEvent(
  //       createEvent('BALANCES AFTER', [
  //         destinationBalance.toString(),
  //         contractBalance.toString(),
  //       ]),
  //     );

  //     // check that the transfer has not been done
  //     expect(destinationBalance).toBe(initDestinationBalance);
  //     expect(contractBalance).toBe(initContractBalance);
  //   });

  //   // operation 3 is validated by owners[1] & owners[2].
  //   // now owners[1] will revoke it and we will try to execute it.
  //   test('revoke operation', () => {
  //     let operationListLenght = bytesToSerializableObjectArray<Transaction>(
  //       getTransactions([]),
  //     ).unwrap().length;

  //     let destinationBalance = Coins.balanceOf(destination);
  //     let contractBalance = Coins.balanceOf(contractAddr);
  //     let initDestinationBalance = destinationBalance;
  //     let initContractBalance = contractBalance;

  //     switchUser(owners[1]);
  //     expect(() => {
  //       revoke(new Args().add(u64(3)).serialize());
  //     }).not.toThrow();

  //     switchUser(deployerAddress);
  //     generateEvent(
  //       createEvent('BALANCES BEFORE', [
  //         initDestinationBalance.toString(),
  //         initContractBalance.toString(),
  //       ]),
  //     );

  //     expect(() => {
  //       execute(new Args().add(u64(3)).serialize());
  //     }).toThrow();

  //     // the operation should not have been deleted
  //     let operationList = bytesToSerializableObjectArray<Transaction>(
  //       getTransactions([]),
  //     ).unwrap();
  //     expect(operationList.length).toBe(operationListLenght);

  //     // retrieve the operation in its current state in Storage
  //     let operation = retrieveOperation(i32(3));

  //     expect(operation.to).toBe(new Address(destination));
  //     expect(operation.value).toBe(u64(15000));
  //     expect(operation.executed).toBe(false);

  //     destinationBalance = Coins.balanceOf(destination);
  //     contractBalance = Coins.balanceOf(contractAddr);
  //     generateEvent(
  //       createEvent('BALANCES AFTER', [
  //         destinationBalance.toString(),
  //         contractBalance.toString(),
  //       ]),
  //     );

  //     // check that the transfer has not been done
  //     expect(destinationBalance).toBe(initDestinationBalance);
  //     expect(contractBalance).toBe(initContractBalance);
  //   });

  test('check operation list', () => {
    let operationList = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap();
    expect(operationList.length).toBe(5);
  });
});
