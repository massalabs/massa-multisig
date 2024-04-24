import { stringToBytes } from '@massalabs/as-types';
import { PersistentMap } from '../libraries/PersistentMap';
import { Transaction } from '../structs/Transaction';

export const OWNERS = stringToBytes('owners');
export const DELAY = stringToBytes('delay');
export const REQUIRED = stringToBytes('required');
export const IS_OWNER = new PersistentMap<string, bool>('is_owner');
export const TRANSACTIONS = new PersistentMap<u64, Transaction>('transactions');
export const APPROVED = new PersistentMap<string, bool>('approved');
// @dev key is a combination of transaction id and owner address as string
