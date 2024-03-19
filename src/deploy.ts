import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deploySC, WalletClient, ISCData } from '@massalabs/massa-sc-deployer';
import {
  Args,
  ArrayTypes,
  BUILDNET_CHAIN_ID,
  DefaultProviderUrls,
  MAX_GAS_DEPLOYMENT,
  MassaUnits,
} from '@massalabs/massa-web3';

dotenv.config();

const publicApi = DefaultProviderUrls.BUILDNET;

const privKey = process.env.WALLET_PRIVATE_KEY;
if (!privKey) {
  throw new Error('Missing WALLET_PRIVATE_KEY in .env file');
}

const deployerAccount = await WalletClient.getAccountFromSecretKey(privKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const ONE_DAY = 86_400_000n; // 24 * 60 * 60 * 1000

// Change the owners, required, and upgradeDelay to your needs
const owners: string[] = [
  'AU10000000000000000000000000000000000000000000000000',
  'AU10000000000000000000000000000000000000000000000001',
  'AU10000000000000000000000000000000000000000000000002',
];
const required = 2;
const upgradeDelay = ONE_DAY;

(async () => {
  await deploySC(
    publicApi,
    deployerAccount,
    [
      {
        data: readFileSync(path.join(__dirname, 'build', 'deployer.wasm')),
        coins: 10n * MassaUnits.oneMassa,
        args: new Args()
          .addArray(owners, ArrayTypes.STRING)
          .addI32(required)
          .addU64(upgradeDelay),
      } as ISCData,
    ],
    BUILDNET_CHAIN_ID,
    0n,
    MAX_GAS_DEPLOYMENT,
    true,
  );
})();
