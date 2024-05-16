import {
  Args,
  NoArg,
  byteToBool,
  bytesToI32,
  bytesToU64,
  stringToBytes,
} from '@massalabs/as-types';
import { Address, call, Storage } from '@massalabs/massa-as-sdk';
import { DELAY, OWNERS, REQUIRED } from '../storage/Multisig';
import { buildApprovalKey } from '../contracts/multisig-internals';

const APPROVED = 'approved';
export class IMultisig {
  constructor(public _origin: Address) {}

  init(
    owners: string[],
    required: i32,
    upgradeDelay: u64,
    validationDelay: u64,
  ): void {
    call(
      this._origin,
      'constructor',
      new Args()
        .add(owners)
        .add(required)
        .add(upgradeDelay)
        .add(validationDelay),
      0,
    );
  }

  submit(to: string, method: string, value: u64, data: StaticArray<u8>): u64 {
    const res = call(
      this._origin,
      'submit',
      new Args().add(to).add(method).add(value).add(data),
      0,
    );
    return bytesToU64(res);
  }

  receiveCoins(value: u64): void {
    call(this._origin, 'receiveCoins', NoArg, value);
  }

  approve(txId: u64): void {
    call(this._origin, 'approve', new Args().add(txId), 0);
  }

  execute(txId: u64): void {
    call(this._origin, 'execute', new Args().add(txId), 0);
  }

  revoke(txId: u64): void {
    call(this._origin, 'revoke', new Args().add(txId), 0);
  }

  getApprovalCount(txId: u64): i32 {
    const _owners = this.owners();
    let count = 0;
    for (let i = 0; i < _owners.length; i++) {
      if (this.hasApproved(txId, new Address(_owners[i]))) {
        count++;
      }
    }
    return count;
  }

  owners(): string[] {
    return Storage.hasOf(this._origin, OWNERS)
      ? new Args(Storage.getOf(this._origin, OWNERS)).nextStringArray().unwrap()
      : [];
  }

  required(): i32 {
    return bytesToI32(Storage.getOf(this._origin, REQUIRED));
  }

  delay(): i32 {
    return bytesToU64(Storage.getOf(this._origin, DELAY));
  }

  hasApproved(txId: u64, owner: Address): bool {
    return (
      Storage.hasOf(
        this._origin,
        stringToBytes(APPROVED + '::' + buildApprovalKey(txId, owner)),
      ) &&
      byteToBool(
        Storage.getOf(
          this._origin,
          stringToBytes(APPROVED + '::' + buildApprovalKey(txId, owner)),
        ),
      )
    );
  }
}
