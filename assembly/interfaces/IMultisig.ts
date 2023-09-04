import { Args, bytesToU64 } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';

export class IMultisig {
  constructor(public _origin: Address) {}

  init(owners: string[], required: i32): void {
    call(this._origin, 'constructor', new Args().add(owners).add(required), 0);
  }

  submit(to: string, value: u64, data: StaticArray<u8>): u64 {
    const res = call(
      this._origin,
      'submit',
      new Args().add(to).add(value).add(data),
      0,
    );
    return bytesToU64(res);
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

  addOwner(owner: string): void {
    call(this._origin, 'addOwner', new Args().add(owner), 0);
  }

  removeOwner(owner: string): void {
    call(this._origin, 'removeOwner', new Args().add(owner), 0);
  }
}
