import { constructor, proposeUpgrade, upgrade } from '../contracts/Multisig';
import { mockAdminContext } from '@massalabs/massa-as-sdk';
import {
  mockBalance,
  mockTimestamp,
} from '@massalabs/massa-as-sdk/assembly/vm-mock';
import { Args } from '@massalabs/as-types';
import {
  changeCallStack,
  resetStorage,
} from '@massalabs/massa-as-sdk/assembly/vm-mock/storage';

// address of the contract set in vm-mock. must match contractAddr of vm.js
const contractAddr = 'AS12BqZEQ6sByhRLyEuf0YbQmcF2PsDdkNNG1akBJu9XcjZA1eT';

// default deployer used so Context.isDeployingContract() is true
const deployerAddress = 'AU12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

// multisig owner
const ownerA = 'AU1qDAxGJ387ETi9JRQzZWSPKYq4YPXrFvdiE4VoXUaiAt38JFEC';

// An arbitrary non-empty payload used as "new bytecode" for proposeUpgrade.
const newBytecode: StaticArray<u8> = [1, 2, 3, 4];

const UPGRADE_DELAY: u64 = 1_000; // 1 second, in ms

function switchUser(user: string): void {
  changeCallStack(user + ' , ' + contractAddr);
}

function switchToMultisig(): void {
  changeCallStack(contractAddr + ' , ' + contractAddr);
}

function setupMultisig(upgDelay: u64 = UPGRADE_DELAY): void {
  resetStorage();
  mockTimestamp(u64(1_000_000)); // deterministic starting time
  // Seed the contract address in the ledger so setBytecode can write to it.
  mockBalance(contractAddr, u64(0));
  changeCallStack(deployerAddress + ' , ' + contractAddr);
  constructor(
    new Args()
      .add<Array<string>>([ownerA])
      .add(i32(1))
      .add(upgDelay)
      .add(u64(0))
      .serialize(),
  );
}

beforeAll(() => {
  mockAdminContext(true);
});

describe('Upgradeable: access control', () => {
  test('proposeUpgrade reverts when not called by the multisig itself', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      proposeUpgrade(newBytecode);
    }).toThrow();
  });

  test('upgrade reverts when not called by the multisig itself', () => {
    setupMultisig();
    switchUser(ownerA);
    expect(() => {
      upgrade([]);
    }).toThrow();
  });
});

// ==========================================================================
// islocked() / upgrade() - timelock semantics
//
// A timelock must *block* upgrades until the configured delay has elapsed
// after a proposal, and then *allow* them. The current implementation of
// `Upgradeable.islocked()` (see assembly/libraries/Upgradeable.ts) has its
// comparison inverted, so `upgrade()` is allowed while the delay has not
// yet passed and blocked after. These tests document the correct behaviour
// and therefore fail against the buggy implementation.
// ==========================================================================

describe('Upgradeable: timelock semantics', () => {
  test('upgrade reverts when called before the upgrade delay has elapsed', () => {
    setupMultisig(UPGRADE_DELAY);

    switchToMultisig();
    proposeUpgrade(newBytecode);

    // Only part of the delay has passed - still locked.
    mockTimestamp(u64(1_000_000) + UPGRADE_DELAY / 2);

    expect(() => {
      upgrade([]);
    }).toThrow('upgrade should be blocked while the timelock is active');
  });

  test('upgrade succeeds once the upgrade delay has elapsed', () => {
    setupMultisig(UPGRADE_DELAY);

    switchToMultisig();
    proposeUpgrade(newBytecode);

    // Advance time strictly past the delay.
    mockTimestamp(u64(1_000_000) + UPGRADE_DELAY + 1);

    // Should not throw.
    upgrade([]);
  });

  test('upgrade reverts if no upgrade has been proposed (after delay)', () => {
    setupMultisig(UPGRADE_DELAY);

    // No proposeUpgrade() call. Still advance time so that the timelock
    // check cannot mask the "no proposal" error.
    mockTimestamp(u64(1_000_000) + UPGRADE_DELAY + 1);

    switchToMultisig();
    expect(() => {
      upgrade([]);
    }).toThrow('upgrade should revert when no proposal exists');
  });
});
