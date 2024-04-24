import {
  Context,
  Storage,
  caller,
  createEvent,
  generateEvent,
  setBytecode,
} from '@massalabs/massa-as-sdk';
import { u64ToBytes, stringToBytes, bytesToU64 } from '@massalabs/as-types';
import { SafeMath } from './SafeMath';

/**
 * @dev Make sure no other modules are using the same storage keys
 */
const PERIOD: StaticArray<u8> = stringToBytes('upgradeable_period');
const TIMELOCK: StaticArray<u8> = stringToBytes('upgradeable_timelock');
const UPGRADE: StaticArray<u8> = stringToBytes('upgradeable_upgrade');

/**
 * @dev Contract that allows to propose and execute upgrades
 * The contract can be upgraded only after the locked period has passed
 * Thoses function should only be callable by the owner
 */
export class Upgradeable {
  /**
   * @dev Initializes the contract with the timelock period
   */
  static __Upgradeable_init(timelock: u64): void {
    assert(!Storage.has(PERIOD), 'Upgradeable__AlreadyInitialized');

    this.__Upgradeable_setUpgradeDelay(timelock);
  }

  /**
   * @dev Update the upgrade delay
   */
  static __Upgradeable_setUpgradeDelay(timelock: u64): void {
    Storage.set(PERIOD, u64ToBytes(timelock));
  }

  /**
   * @dev Returns true if the contract is locked
   */
  static islocked(): bool {
    return (
      SafeMath.add(this.timelock(), bytesToU64(Storage.get(PERIOD))) <
      Context.timestamp()
    );
  }

  /**
   * @dev Returns the timelock timestamp
   */
  static timelock(): u64 {
    return bytesToU64(Storage.get(TIMELOCK));
  }

  /**
   * @dev Proposes an upgrade, should be only callable by the owner
   * @param newCode - The new contract code
   */
  static proposeUpgrade(newCode: StaticArray<u8>): void {
    Storage.set(TIMELOCK, u64ToBytes(Context.timestamp()));
    Storage.set(UPGRADE, newCode);
    generateEvent(createEvent('UpgradeProposed', [caller().toString()]));
  }

  /**
   * @dev Upgrades the contract, should be only callable by the owner
   *
   * reverts if the locked period has not passed
   */
  static upgrade(): void {
    assert(!this.islocked(), 'Upgradeable__Timelock');
    assert(Storage.has(UPGRADE), 'Upgradeable__NoUpgreadeProposed');
    const newCode = Storage.get(UPGRADE);
    Storage.del(UPGRADE);
    setBytecode(newCode);
    generateEvent(createEvent('Upgraded', [caller().toString()]));
  }
}
