export * from './Multisig';

import { Args } from '@massalabs/as-types';
import { constructor as _constructor } from './Multisig';

export function constructor(_: StaticArray<u8>): void {
  const owners: string[] = [];
  const required = 2;
  const upgradeDelay = 86_400_000; // 1 day
  const executionDelay = 3_600_000; // 1 hour

  const args = new Args()
    .add(owners)
    .add(required)
    .add(upgradeDelay)
    .add(executionDelay);
  _constructor(args.serialize());
}
