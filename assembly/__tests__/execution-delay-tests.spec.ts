import {
  constructor,
  submit,
  approve,
  execute,
  getTransactions,
} from '../contracts/Multisig';
import {
  Storage,
  mockAdminContext,
  Address,
  Context,
  balanceOf,
} from '@massalabs/massa-as-sdk';
import { mockBalance } from '@massalabs/massa-as-sdk/assembly/vm-mock';
import {
  Args,
  bytesToU64,
  bytesToSerializableObjectArray,
} from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';
import { Transaction } from '../structs/Transaction';
import { SafeMath } from '../libraries/SafeMath';
import { DELAY } from '../storage/Multisig';

// address of the contract set in vm-mock. must match with contractAddr of @massalabs/massa-as-sdk/vm-mock/vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// default deployer (caller != callee so Context.isDeployingContract() is true)
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// multisig owners
const ownerA = 'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC';
const ownerB = 'AU125TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

// destination for the dummy transaction
const destination = 'AU155TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

function retrieveOperation(opIndex: i32): Transaction {
  const operationList = bytesToSerializableObjectArray<Transaction>(
    getTransactions([]),
  ).unwrap();
  return operationList[opIndex];
}

beforeAll(() => {
  resetStorage();
  mockAdminContext(true);
});

describe('Zero-ms execution delay', () => {
  test('constructor accepts executionDelay = 0 and stores it as zero', () => {
    resetStorage();
    changeCallStack(deployerAddress + ' , ' + contractAddr);

    expect(() => {
      constructor(
        new Args()
          .add<Array<string>>([ownerA, ownerB])
          .add(i32(2))
          // upgradeDelay
          .add(u64(0))
          // executionDelay = 0 ms (no wait between approval and execution)
          .add(u64(0))
          .serialize(),
      );
    }).not.toThrow();

    // DELAY must be stored as u64(0)
    expect(bytesToU64(Storage.get(DELAY))).toBe(u64(0));
  });

  test('once approved, a transaction is immediately eligible for execution (delay check passes)', () => {
    resetStorage();
    changeCallStack(deployerAddress + ' , ' + contractAddr);
    constructor(
      new Args()
        .add<Array<string>>([ownerA, ownerB])
        .add(i32(2))
        .add(u64(0))
        .add(u64(0))
        .serialize(),
    );

    const tx = new Transaction(
      new Address(destination),
      '',
      u64(0),
      [],
      0,
      false,
    );

    // submit + reach the required threshold (2 approvals)
    switchUser(ownerA);
    const opIdBytes = submit(new Args().add(tx).serialize());
    const opId = bytesToU64(opIdBytes);
    approve(new Args().add(opId).serialize());

    switchUser(ownerB);
    approve(new Args().add(opId).serialize());

    // With a 0 ms execution delay, the gate enforced by execute()
    //   SafeMath.add(tx.timestamp, DELAY) <= Context.timestamp()
    // must already be satisfied as soon as the threshold is reached.
    const storedTx = retrieveOperation(i32(opId));
    const delay = bytesToU64(Storage.get(DELAY));
    expect(delay).toBe(u64(0));
    expect(storedTx.timestamp).toBeGreaterThan(u64(0));
    expect(SafeMath.add(storedTx.timestamp, delay)).toBeLessThanOrEqual(
      Context.timestamp(),
    );
  });

  test('execute() succeeds immediately after approval with executionDelay = 0', () => {
    resetStorage();
    changeCallStack(deployerAddress + ' , ' + contractAddr);
    constructor(
      new Args()
        .add<Array<string>>([ownerA, ownerB])
        .add(i32(2))
        .add(u64(0))
        .add(u64(0))
        .serialize(),
    );

    // Fund the multisig so transferCoins in execute() has balance to move.
    const transferAmount: u64 = 15000;
    mockBalance(contractAddr, transferAmount);

    const tx = new Transaction(
      new Address(destination),
      '',
      transferAmount,
      [],
      0,
      false,
    );

    switchUser(ownerA);
    const opIdBytes = submit(new Args().add(tx).serialize());
    const opId = bytesToU64(opIdBytes);
    approve(new Args().add(opId).serialize());

    switchUser(ownerB);
    approve(new Args().add(opId).serialize());

    const destinationBalanceBefore = balanceOf(destination);
    const contractBalanceBefore = balanceOf(contractAddr);
    expect(contractBalanceBefore).toBe(transferAmount);

    // Immediately execute - with executionDelay = 0 no waiting is required.
    // Calling execute() directly (not via a closure) because AssemblyScript
    // closures cannot capture local variables like opId.
    switchUser(ownerA);
    execute(new Args().add(opId).serialize());

    // tx is flagged as executed
    const storedTx = retrieveOperation(i32(opId));
    expect(storedTx.executed).toBe(true);

    // coins actually moved from the multisig to the destination
    expect(balanceOf(destination)).toBe(
      destinationBalanceBefore + transferAmount,
    );
    expect(balanceOf(contractAddr)).toBe(
      contractBalanceBefore - transferAmount,
    );
  });
});
