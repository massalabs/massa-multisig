import {
  Args,
  bytesToFixedSizeArray,
  bytesToI32,
  bytesToU64,
  u64ToBytes,
} from '@massalabs/as-types';
import { IS_OWNER, OWNERS, REQUIRED, constructor } from '../contracts/Multisig';
import {
  Address,
  Context,
  Storage,
  changeCallStack,
  generateEvent,
  mockAdminContext,
  mockScCall,
  resetStorage,
} from '@massalabs/massa-as-sdk';

// const user1 = generateDumbAddress();
// const user2 = generateDumbAddress();
// const user3 = generateDumbAddress();
// const owners = [user1, user2, user3];
const owners = ['user1', 'user2'];

beforeEach(() => {
  resetStorage();
  mockAdminContext(true);
  const required = 2;
  const args = new Args().add(owners).add(required).serialize();
  constructor(args);
  mockAdminContext(false);
});

describe('MasterChef', () => {
  it('Should be correctly initialized', () => {
    generateEvent('checking some shit');
    generateEvent(Storage.has(OWNERS).toString());
    const _owners = bytesToFixedSizeArray<string>(Storage.get(OWNERS));
    expect(_owners.length).toBe(3);

    const _required = bytesToI32(Storage.get(REQUIRED));
    expect(_required).toBe(2);

    // const isOwner = IS_OWNER.getSome(user1);
    // expect(isOwner).toBe(true);
  });
});

// ==================================================== //
// ====                 HELPERS                    ==== //
// ==================================================== //

function getCallStack(): string[] {
  return Context.addressStack().map<string>((a) => a.toString());
}

function setCaller(address: string): void {
  const currentStack = getCallStack();
  currentStack[0] = address;
  changeCallStack(currentStack.join(','));
}

function printCallStack(): void {
  const stack = getCallStack();
  generateEvent(stack.join(' -> '));
}

function mixRandomChars(length: i32): string {
  let result = '';
  let characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(
      i32(Math.floor(Math.random() * f64(charactersLength))),
    );
  }
  return result;
}

function generateDumbAddress(): string {
  return 'A12' + mixRandomChars(47);
}
