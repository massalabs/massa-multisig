import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deploySC, WalletClient, ISCData } from '@massalabs/massa-sc-deployer';
import { MassaUnits } from '@massalabs/massa-web3';

dotenv.config();

const publicApi = 'https://node.dusa.io/testnet';

const privKey = process.env.WALLET_PRIVATE_KEY;
if (!privKey) {
  throw new Error('Missing WALLET_PRIVATE_KEY in .env file');
}

const deployerAccount = await WalletClient.getAccountFromSecretKey(privKey);

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(path.dirname(__filename));

(async () => {
  await deploySC(
    publicApi,
    deployerAccount,
    [
      {
        data: readFileSync(path.join(__dirname, 'build', 'main.wasm')),
        coins: BigInt(15) * MassaUnits.oneMassa,
      } as ISCData,
    ],
    BigInt(0),
    BigInt(4_200_000_000),
    true,
  );
})();
