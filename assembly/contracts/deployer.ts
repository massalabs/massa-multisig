import {
  createSC,
  fileToByteArray,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IMultisig } from '../interfaces/IMultisig';
import { ONE_COIN } from '@dusalabs/core';
import { Args } from '@massalabs/as-types';

export function deploy(bs: StaticArray<u8>): void {
  const multisigWasm: StaticArray<u8> = fileToByteArray('build/Multisig.wasm');
  const multisig = new IMultisig(createSC(multisigWasm));
  transferCoins(multisig._origin, 1 * ONE_COIN);

  const args = new Args(bs);
  const owners = args.nextStringArray().unwrap();
  const required = args.nextI32().unwrap();
  multisig.init(owners, required);
}
