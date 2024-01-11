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

const owners: string[] = [
  'AU1cBirTno1FrMVpUMT96KiQ97wBqqM1z9uJLr3XZKQwJjFLPEar',
  'AU12jWU88jCx8Pr5gptgM3EUfYuoA5g2jCauFRLZyWzEB7WtByTod',
  'AU1LhKv5T3Dp1kSGJvgRSTZbXcRx51L5i8GeTddakXyhDMcaihcn',
];
const required = 2;

(async () => {
  await deploySC(
    publicApi,
    deployerAccount,
    [
      {
        data: readFileSync(path.join(__dirname, 'build', 'deployer.wasm')),
        coins: 10n * MassaUnits.oneMassa,
      },
    ],
    BUILDNET_CHAIN_ID,
    0n,
    4_200_000_000n,
    true,
  );
})();
