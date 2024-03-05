import {
  createSC,
  fileToByteArray,
  generateEvent,
  transferCoins,
  createEvent,
} from '@massalabs/massa-as-sdk';
import { IMultisig } from '../interfaces/IMultisig';
import { Args } from '@massalabs/as-types';

const ONE_COIN = u64(10 ** 9);

export function deploy(bs: StaticArray<u8>): void {
  const multisigWasm: StaticArray<u8> = fileToByteArray('build/Multisig.wasm');
  const multisig = new IMultisig(createSC(multisigWasm));
  transferCoins(multisig._origin, 1 * ONE_COIN);

  const args = new Args(bs);
  const owners = args.nextStringArray().unwrap();
  const required = args.nextI32().unwrap();
  multisig.init(owners, required);

  generateEvent(createEvent('NEW_MULTISIG', [multisig._origin.toString()]));
}
