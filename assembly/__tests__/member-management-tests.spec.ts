import {
  constructor,
  addOwner,
  removeOwner,
  replaceOwner,
} from '../contracts/Multisig';
import { mockAdminContext } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';
import { owners, required } from '../contracts/multisig-internals';

// address of the contract set in vm-mock. must match with contractAddr of @massalabs/massa-as-sdk/vm-mock/vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// multisig owners
const ownerA = 'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC';
const ownerB = 'AU125TiSrnD2YatYfEyRAWnBdD7TEuVbvGFkFgDuaYc2bdKyqKtb';
const ownerC = 'A12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// additional / replacement addresses
const newOwner = 'AU1NewOwnerAddressForTestingPurposesOnlyXXXXXXXXXXX';
const otherOwner = 'AU1OtherNewOwnerForTestingPurposesOnlyXXXXXXXXXXXXX';

// a plain user that is not an owner and not the contract itself
const randomCaller = 'AU1RandomUserNotAnOwnerXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Default deployer address used by the vm-mock (caller != callee so
// Context.isDeployingContract() is true). Must match the mock vm default caller.
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// Simulate the multisig calling itself (required by _isMultisig):
// Context.caller() == Context.callee() == contractAddr.
function switchToMultisig(): void {
  changeCallStack(contractAddr + ' , ' + contractAddr);
}

// Simulate an external caller: Context.caller() == user, Context.callee() == contractAddr
function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

// Helper that bootstraps a 2-of-3 multisig with ownerA/B/C.
function setupMultisig(required_: i32 = i32(2)): void {
  resetStorage();
  // Context.isDeployingContract() requires caller != callee, so make sure
  // the call stack is set to a deployer context before calling constructor.
  changeCallStack(deployerAddress + ' , ' + contractAddr);
  constructor(
    new Args()
      .add<Array<string>>([ownerA, ownerB, ownerC])
      .add(required_)
      .add(u64(0))
      .add(u64(0))
      .serialize(),
  );
}

beforeAll(() => {
  resetStorage();
  mockAdminContext(true);
});

describe('addOwner', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      addOwner(new Args().add(newOwner).serialize());
    }).toThrow();
  });

  test('reverts when the address is already an owner', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      addOwner(new Args().add(ownerA).serialize());
    }).toThrow();
  });

  test('adds a new owner when called by the multisig itself', () => {
    setupMultisig();
    switchToMultisig();

    expect(() => {
      addOwner(new Args().add(newOwner).serialize());
    }).not.toThrow();

    const storedOwners = owners();
    expect(storedOwners.length).toBe(4);
    expect(storedOwners.includes(newOwner)).toBe(true);
    // Adding an owner must not change the required threshold
    expect(required()).toBe(2);
  });
});

describe('removeOwner', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      removeOwner(new Args().add(ownerB).serialize());
    }).toThrow();
  });

  test('removes an existing owner when called by the multisig itself', () => {
    // 2-of-3 → drop one, leaving 2-of-2
    setupMultisig();
    switchToMultisig();

    expect(() => {
      removeOwner(new Args().add(ownerC).serialize());
    }).not.toThrow();

    const storedOwners = owners();
    expect(storedOwners.length).toBe(2);
    expect(storedOwners.includes(ownerC)).toBe(false);
    expect(storedOwners.includes(ownerA)).toBe(true);
    expect(storedOwners.includes(ownerB)).toBe(true);
    expect(required()).toBe(2);
  });

  test('reverts when removing would drop owners below the required threshold', () => {
    // 3-of-3 → cannot remove any owner without breaking the threshold
    setupMultisig(i32(3));
    switchToMultisig();

    expect(() => {
      removeOwner(new Args().add(ownerC).serialize());
    }).toThrow();

    // state unchanged
    expect(owners().length).toBe(3);
  });

  test('reverts when trying to remove an address that is not an owner', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      removeOwner(new Args().add(randomCaller).serialize());
    }).toThrow();
  });

  test('reverts when removing would leave the multisig with zero owners', () => {
    // 1-of-1 → cannot drop the last owner
    resetStorage();
    changeCallStack(deployerAddress + ' , ' + contractAddr);
    constructor(
      new Args()
        .add<Array<string>>([ownerA])
        .add(i32(1))
        .add(u64(0))
        .add(u64(0))
        .serialize(),
    );
    switchToMultisig();

    expect(() => {
      removeOwner(new Args().add(ownerA).serialize());
    }).toThrow();

    expect(owners().length).toBe(1);
  });
});

describe('replaceOwner', () => {
  test('reverts when called by a non-multisig caller', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      replaceOwner(new Args().add(ownerC).add(newOwner).serialize());
    }).toThrow();
  });

  test('reverts when the old owner does not exist', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      replaceOwner(new Args().add(randomCaller).add(newOwner).serialize());
    }).toThrow();
  });

  test('reverts when the new owner is already an owner', () => {
    setupMultisig();
    switchToMultisig();
    expect(() => {
      // try to replace ownerA with ownerB (already present)
      replaceOwner(new Args().add(ownerA).add(ownerB).serialize());
    }).toThrow();
  });

  test('replaces an owner without changing the owner count or threshold', () => {
    setupMultisig();
    switchToMultisig();

    expect(() => {
      replaceOwner(new Args().add(ownerC).add(otherOwner).serialize());
    }).not.toThrow();

    const storedOwners = owners();
    expect(storedOwners.length).toBe(3);
    expect(storedOwners.includes(ownerC)).toBe(false);
    expect(storedOwners.includes(otherOwner)).toBe(true);
    expect(storedOwners.includes(ownerA)).toBe(true);
    expect(storedOwners.includes(ownerB)).toBe(true);
    expect(required()).toBe(2);
  });
});
