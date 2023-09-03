import { Args, bytesToString, NoArg } from '@massalabs/as-types';
import {
  Address,
  call,
  Context,
  createSC,
  fileToByteArray,
  generateEvent,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IMultisig } from './Multisig';

const ONE_MASSA = 1 * 10 ** 9;

export function constructor(_: StaticArray<u8>): void {
  // deploy multisig
  const owners = [
    Context.caller().toString(),
    'AU12jWU88jCx8Pr5gptgM3EUfYuoA5g2jCauFRLZyWzEB7WtByTod',
  ];
  const bytes: StaticArray<u8> = fileToByteArray('build/Multisig.wasm');
  const multisig = new IMultisig(createSC(bytes));
  transferCoins(multisig._origin, ONE_MASSA);
  multisig.init(owners, 2);

  // submit transaction
  const id = multisig.submit(
    'AU1LhKv5T3Dp1kSGJvgRSTZbXcRx51L5i8GeTddakXyhDMcaihcn',
    5 * ONE_MASSA,
    [],
  );

  // try executing transaction (should fail)
  multisig.execute(id);
}
