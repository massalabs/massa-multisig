import { Args, bytesToString, NoArg } from '@massalabs/as-types';
import {
  Address,
  call,
  createSC,
  fileToByteArray,
  generateEvent,
} from '@massalabs/massa-as-sdk';

export function constructor(_: StaticArray<u8>): void {}
