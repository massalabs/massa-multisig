import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Account,
  Args,
  ArrayTypes,
  JsonRpcProvider,
  Mas,
} from '@massalabs/massa-web3';

dotenv.config();

const rpcUrl = process.env.RPC_URL?.trim();

const account = await Account.fromEnv();
const provider = rpcUrl
  ? JsonRpcProvider.fromRPCUrl(rpcUrl, account)
  : JsonRpcProvider.buildnet(account);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const owners: string[] = [
  'AU1y3xaRuqAWdftK76F51B3BhpXEvH7QHEAc7ZTV3koUcPVgAzvr',
  'AU122a1FX59Ao5qNk5TUyjAKVx1WwtUPxxgqnVp2UnAub7T4vFtnP'
];
const required = 1n;
const upgradeDelay = 1000n;
const validationDelay = 1000n;

const constructorArgs = new Args()
  .addArray(owners, ArrayTypes.STRING)
  .addI32(required)
  .addU64(upgradeDelay)
  .addU64(validationDelay);

const multisig = await provider.deploySC({
  byteCode: Uint8Array.from(
    readFileSync(path.join(__dirname, 'build', 'Multisig.wasm')),
  ),
  parameter: constructorArgs,
  // Preserve the 1 MAS initial balance previously transferred by the deployer contract.
  coins: Mas.fromMas(1n),
  waitFinalExecution: true,
});

process.stdout.write(`Deployed multisig address: ${multisig.address}\n`);
