import {
  constructor,
  submit,
  approve,
  execute,
  revoke,
  setTimestamp,
  receiveCoins,
  changeRequirement,
  changeExecutionDelay,
  changeUpgradeDelay,
  getApprovals,
} from '../contracts/Multisig';
import {
  Storage,
  mockAdminContext,
  Address,
  generateEvent,
} from '@massalabs/massa-as-sdk';
import {
  mockBalance,
  mockScCall,
} from '@massalabs/massa-as-sdk/assembly/vm-mock';
import {
  Args,
  bytesToU64,
  bytesToI32,
  bytesToNativeTypeArray,
  bytesToSerializableObjectArray,
} from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';
import { Transaction } from '../structs/Transaction';
import { getApprovalCount, hasApproved } from '../contracts/multisig-internals';
import { getTransactions } from '../contracts/Multisig';
import { DELAY, REQUIRED } from '../storage/Multisig';

// address of the contract set in vm-mock. must match contractAddr of vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// default deployer used by the vm-mock (caller != callee so isDeployingContract is true)
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// multisig owners
const ownerA = 'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC';
const ownerB = 'AU125TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';
const ownerC = 'AU12LmTm4zRYkUQZusw7eevvV5ySzSwndJpENQ7EZHcmDbWafx96T';

// a well-formed user address that is not an owner
const nonOwner = 'AU1aMywGBgBywiL6WcbKR4ugxoBtdP9P3waBVi5e713uvj7F1DJL';

// EOA destination
const destination = 'AU155TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';

// smart-contract destination used to exercise execute()'s `call` branch
const scDestination = 'AS1uku77MYEHy3i12WeERtD2JQzeKePz5zmJjWCq6A8wWyZakccQ';

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

function switchToMultisig(): void {
  changeCallStack(contractAddr + ' , ' + contractAddr);
}

// Bootstraps a fresh 2-of-3 multisig with executionDelay = 0 and upgradeDelay = 0.
function setupMultisig(
  execDelay: u64 = u64(0),
  upgDelay: u64 = u64(0),
  reqd: i32 = i32(2),
): void {
  resetStorage();
  changeCallStack(deployerAddress + ' , ' + contractAddr);
  constructor(
    new Args()
      .add<Array<string>>([ownerA, ownerB, ownerC])
      .add(reqd)
      .add(upgDelay)
      .add(execDelay)
      .serialize(),
  );
}

// Submits + approves a transaction by `execDelay` owners so the validation
// threshold is reached. Returns the txId.
function submitAndValidate(tx: Transaction): u64 {
  switchUser(ownerA);
  const idBytes = submit(new Args().add(tx).serialize());
  const id = bytesToU64(idBytes);
  approve(new Args().add(id).serialize());
  switchUser(ownerB);
  approve(new Args().add(id).serialize());
  return id;
}

function newTransfer(to: string, value: u64): Transaction {
  return new Transaction(new Address(to), '', value, [], 0, false);
}

beforeAll(() => {
  resetStorage();
  mockAdminContext(true);
});

// ==========================================================================
// approve() — error paths
// ==========================================================================

describe('approve: error paths', () => {
  test('reverts on a non-existent transaction id', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      approve(new Args().add(u64(42)).serialize());
    }).toThrow();
  });

  test('reverts when called by a non-owner', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());

    switchUser(nonOwner);
    expect(() => {
      approve(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test('reverts when the transaction has already been executed', () => {
    setupMultisig();
    mockBalance(contractAddr, u64(1000));
    const id = submitAndValidate(newTransfer(destination, u64(1000)));

    // execute so the tx becomes `executed = true`
    switchUser(ownerA);
    execute(new Args().add(id).serialize());

    // ownerC now tries to approve - should revert on `_notExecuted`
    switchUser(ownerC);
    expect(() => {
      approve(new Args().add(u64(0)).serialize());
    }).toThrow();
  });
});

// ==========================================================================
// execute() — error paths and branches
// ==========================================================================

describe('execute: error paths and branches', () => {
  test('reverts on a non-existent transaction id', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      execute(new Args().add(u64(99)).serialize());
    }).toThrow();
  });

  test('reverts when the transaction has already been executed', () => {
    setupMultisig();
    mockBalance(contractAddr, u64(1000));
    const id = submitAndValidate(newTransfer(destination, u64(1000)));

    switchUser(ownerA);
    execute(new Args().add(id).serialize());

    // second execute call must fail (already executed)
    expect(() => {
      execute(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test("reverts with 'delay not passed' when the execution delay hasn't elapsed", () => {
    // use a huge execution delay so now() + huge delay > Context.timestamp()
    setupMultisig(u64(1_000_000_000_000));
    mockBalance(contractAddr, u64(1000));
    submitAndValidate(newTransfer(destination, u64(1000)));

    switchUser(ownerA);
    expect(() => {
      execute(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test('executes the call-branch when the destination is a smart contract', () => {
    setupMultisig();
    mockBalance(contractAddr, u64(500));

    // Call a method on a smart-contract destination with some payload
    const tx = new Transaction(
      new Address(scDestination),
      'doSomething',
      u64(500),
      new Args().add(u64(123)).serialize(),
      0,
      false,
    );

    // execute() reaches the `!isAddressEoa(...) -> call(...)` branch for SC
    // destinations; the vm-mock needs a mocked return value for that call.
    // If the transferCoins branch were hit by mistake, vm-mock would throw
    // because `scDestination` has no bytecode registered.
    mockScCall([]);
    const id = submitAndValidate(tx);

    switchUser(ownerA);
    execute(new Args().add(id).serialize());

    // the transaction is marked executed — the call branch didn't revert
    const operationList = bytesToSerializableObjectArray<Transaction>(
      getTransactions([]),
    ).unwrap();
    expect(operationList[i32(id)].executed).toBe(true);
  });
});

// ==========================================================================
// revoke() — error paths and behavior
// ==========================================================================

describe('revoke: error paths and behavior', () => {
  test('reverts on a non-existent transaction id', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      revoke(new Args().add(u64(99)).serialize());
    }).toThrow();
  });

  test('reverts when the transaction has already been executed', () => {
    setupMultisig();
    mockBalance(contractAddr, u64(1000));
    const id = submitAndValidate(newTransfer(destination, u64(1000)));

    switchUser(ownerA);
    execute(new Args().add(id).serialize());

    expect(() => {
      revoke(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test('reverts when the caller has not approved the tx', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());
    // ownerA never approved — revoking must fail
    expect(() => {
      revoke(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test('resets the approval count after a revoke below the threshold', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());
    approve(new Args().add(u64(0)).serialize());

    expect(getApprovalCount(u64(0))).toBe(1);
    expect(hasApproved(u64(0), new Address(ownerA))).toBe(true);

    revoke(new Args().add(u64(0)).serialize());

    expect(getApprovalCount(u64(0))).toBe(0);
    expect(hasApproved(u64(0), new Address(ownerA))).toBe(false);
  });
});

// ==========================================================================
// changeRequirement()
// ==========================================================================

describe('changeRequirement', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      changeRequirement(new Args().add(i32(1)).serialize());
    }).toThrow();
  });

  test('reverts when the new value is 0', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      changeRequirement(new Args().add(i32(0)).serialize());
    }).toThrow();
  });

  test('reverts when the new value exceeds the owner count', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      // 3 owners → required = 4 is invalid
      changeRequirement(new Args().add(i32(4)).serialize());
    }).toThrow();
  });

  test('updates REQUIRED storage on a valid call', () => {
    setupMultisig();
    switchToMultisig();
    changeRequirement(new Args().add(i32(3)).serialize());
    expect(bytesToI32(Storage.get(REQUIRED))).toBe(3);
  });
});

// ==========================================================================
// changeExecutionDelay()
// ==========================================================================

describe('changeExecutionDelay', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      changeExecutionDelay(new Args().add(u64(5000)).serialize());
    }).toThrow();
  });

  test('updates DELAY storage on a valid call', () => {
    setupMultisig();
    switchToMultisig();
    changeExecutionDelay(new Args().add(u64(123456)).serialize());
    expect(bytesToU64(Storage.get(DELAY))).toBe(u64(123456));
  });

  test('after raising the delay, execute() becomes subject to the delay gate', () => {
    setupMultisig();
    mockBalance(contractAddr, u64(1000));
    const id = submitAndValidate(newTransfer(destination, u64(1000)));

    // raise the execution delay after the tx has already been validated
    switchToMultisig();
    changeExecutionDelay(new Args().add(u64(1_000_000_000_000)).serialize());

    // now the delay gate should trip
    switchUser(ownerA);
    expect(() => {
      execute(new Args().add(u64(0)).serialize());
    }).toThrow();
    // silence "unused id" warning
    generateEvent(id.toString());
  });
});

// ==========================================================================
// changeUpgradeDelay()
// ==========================================================================

describe('changeUpgradeDelay', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      changeUpgradeDelay(new Args().add(u64(10000)).serialize());
    }).toThrow();
  });

  test('does not throw when called by the multisig itself', () => {
    setupMultisig();
    switchToMultisig();
    changeUpgradeDelay(new Args().add(u64(10000)).serialize());
  });
});

// ==========================================================================
// setTimestamp()
// ==========================================================================

describe('setTimestamp', () => {
  test('reverts when called by a non-owner', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());

    switchUser(nonOwner);
    expect(() => {
      setTimestamp(new Args().add(u64(0)).serialize());
    }).toThrow();
  });

  test('reverts on a non-existent transaction id', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      setTimestamp(new Args().add(u64(99)).serialize());
    }).toThrow();
  });

  test('is a no-op when the approval threshold has not been reached', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());
    approve(new Args().add(u64(0)).serialize());
    // only 1/2 approvals — setTimestamp must leave the timestamp untouched
    setTimestamp(new Args().add(u64(0)).serialize());
  });

  test('reverts when the timestamp is already set (threshold reached via approve)', () => {
    setupMultisig();
    submitAndValidate(newTransfer(destination, u64(1000)));
    // approve() already set tx.timestamp, so setTimestamp must revert
    switchUser(ownerA);
    expect(() => {
      setTimestamp(new Args().add(u64(0)).serialize());
    }).toThrow();
  });
});

// ==========================================================================
// receiveCoins()
// ==========================================================================

describe('receiveCoins', () => {
  test('does not throw', () => {
    setupMultisig();
    switchUser(ownerA);
    receiveCoins([]);
  });
});

// ==========================================================================
// getApprovals()
// ==========================================================================

describe('getApprovals', () => {
  test('returns the list of owners that approved a transaction', () => {
    setupMultisig();

    // submit, then have ownerA and ownerC approve (skipping ownerB)
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());
    approve(new Args().add(u64(0)).serialize());
    switchUser(ownerC);
    approve(new Args().add(u64(0)).serialize());

    const raw = getApprovals(new Args().add(u64(0)).serialize());
    const approvers = bytesToNativeTypeArray<string>(raw);

    expect(approvers.length).toBe(2);
    expect(approvers.includes(ownerA)).toBe(true);
    expect(approvers.includes(ownerC)).toBe(true);
    expect(approvers.includes(ownerB)).toBe(false);
  });

  test('returns an empty list for a transaction with no approvals', () => {
    setupMultisig();
    switchUser(ownerA);
    submit(new Args().add(newTransfer(destination, u64(1000))).serialize());

    const raw = getApprovals(new Args().add(u64(0)).serialize());
    const approvers = bytesToNativeTypeArray<string>(raw);
    expect(approvers.length).toBe(0);
  });
});
