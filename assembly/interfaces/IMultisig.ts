import { Args, NoArg, bytesToU64 } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';

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
}
