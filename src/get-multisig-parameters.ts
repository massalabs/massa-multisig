/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import { Args, ArrayTypes, JsonRpcProvider } from '@massalabs/massa-web3';

dotenv.config();

const STORAGE_KEYS = {
  owners: new TextEncoder().encode('owners'),
  required: new TextEncoder().encode('required'),
  delay: new TextEncoder().encode('delay'),
} as const;

type MultisigParameters = {
  members: string[];
  threshold: number;
  delay: string;
};

function stringifyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) =>
      typeof currentValue === 'bigint'
        ? currentValue.toString()
        : currentValue,
    2,
  );
}

function parseCliArgs(): { multisigAddress: string } {
  const [multisigAddress] = process.argv.slice(2).map((value) => value.trim());

  if (!multisigAddress) {
    throw new Error(
      'Usage: npm run get:multisig-parameters -- <multisig-address>',
    );
  }

  return { multisigAddress };
}

function expectStorageValue(
  value: Uint8Array | null,
  fieldName: keyof typeof STORAGE_KEYS,
): Uint8Array {
  if (!value) {
    throw new Error(`Missing "${fieldName}" in multisig storage`);
  }

  return value;
}

const rpcUrl = process.env.RPC_URL?.trim();
const { multisigAddress } = parseCliArgs();

const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl)
  : JsonRpcProvider.buildnet();

const [ownersBytes, requiredBytes, delayBytes] = await provider.readStorage(
  multisigAddress,
  [STORAGE_KEYS.owners, STORAGE_KEYS.required, STORAGE_KEYS.delay],
  true,
);

const parameters: MultisigParameters = {
  members: new Args(expectStorageValue(ownersBytes, 'owners')).nextArray<string>(
    ArrayTypes.STRING,
  ),
  threshold: Number(
    new Args(expectStorageValue(requiredBytes, 'required')).nextI32(),
  ),
  delay: new Args(expectStorageValue(delayBytes, 'delay')).nextU64().toString(),
};

console.log(stringifyJson(parameters));
