import {
  Args,
  bytesToFixedSizeArray,
  bytesToI32,
  bytesToU64,
  fixedSizeArrayToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import { APPROVED, IS_OWNER, OWNERS, REQUIRED } from '../storage/Multisig';
import {
  Address,
  Context,
  Storage,
  balance,
  balanceOf,
  changeCallStack,
  generateEvent,
  mockAdminContext,
  mockScCall,
  resetStorage,
} from '@massalabs/massa-as-sdk';
import { approve, execute, submit } from '../contracts/Multisig';
import { Transaction } from '../structs/Transaction';
import {
  _notApproved,
  buildApprovalKey,
  getApprovalCount,
} from '../contracts/utils';

const user1 = generateDumbAddress();
const user2 = generateDumbAddress();
const user3 = generateDumbAddress();
const user4 = generateDumbAddress();
const owners = [user1, user2, user3];

describe('Multisig', () => {
  beforeEach(() => {
    resetStorage();
    // mockAdminContext(true);
    // const required = 2;
    // const args = new Args().add(owners).add(required);
    // constructor(args.serialize());
    // mockAdminContext(false);
    Storage.set(OWNERS, fixedSizeArrayToBytes(owners));
    Storage.set(REQUIRED, u64ToBytes(2));
    for (let i = 0; i < owners.length; i++) {
      IS_OWNER.set(owners[i], true);
    }
  });
  it('Should be correctly initialized', () => {
    const _owners = bytesToFixedSizeArray<string>(Storage.get(OWNERS));
    expect(_owners.length).toBe(3);

    const _required = bytesToI32(Storage.get(REQUIRED));
    expect(_required).toBe(2);

    const isOwner1 = IS_OWNER.get(user1, false);
    expect(isOwner1).toBe(true);
    const isOwner2 = IS_OWNER.get(user2, false);
    expect(isOwner2).toBe(true);
    const isOwner3 = IS_OWNER.get(user3, false);
    expect(isOwner3).toBe(true);
  });

  it('should not be able to submit when caller isnt owner', () => {
    throws('only owners can submit', () => {
      const id = _submit(user4);
    });
  });
  it('should be able to submit when caller is owner', () => {
    const id = _submit(user1);
    expect(id).toBe(0);
  });
  it('should not be able to approve when caller isnt owner', () => {
    throws('only owners can approve', () => {
      const id = _submit(user1);
      _approve(user4, id);
    });
  });
  it('should be able to approve when caller is owner', () => {
    const id = _submit(user1);
    _approve(user1, id);

    expect(getApprovalCount(id)).toBe(1);
    const key = buildApprovalKey(id, new Address(user1));
    expect(APPROVED.get(key, false)).toBe(true);
  });
  it('should not be able to execute while required threshold is not met', () => {
    throws('approval threshold not met', () => {
      const id = _submit(user1);
      _approve(user1, id);
      _execute(user1, id);
    });
  });
  it('should not be able to execute when caller does not belong to owners', () => {
    throws('only owners can execute', () => {
      const id = _submit(user1);
      _approve(user1, id);
      _approve(user2, id);
      _execute(user4, id);
    });
  });
  it('should be able to execute when required threshold is met', () => {
    // expect(balanceOf(user1)).toBe(0);
    // expect(balanceOf(user2)).toBe(0);
    // expect(balanceOf(user3)).toBe(0);
    // expect(balanceOf(user4)).toBe(0);
    const id = _submit(user1);
    _approve(user1, id);
    _approve(user2, id);
    _execute(user3, id);
    expect(balanceOf(user4)).toBe(1);
  });
});

// ==================================================== //
// ====                 HELPERS                    ==== //
// ==================================================== //

const _submit = (caller: string): u64 => {
  setCaller(caller);
  const args = new Args().add(new Transaction(new Address(user4), 1, []));
  const id = submit(args.serialize());
  return bytesToU64(id);
};

const _approve = (caller: string, id: u64): void => {
  setCaller(caller);
  const args = new Args().add(id);
  approve(args.serialize());
};

const _execute = (caller: string, id: u64): void => {
  setCaller(caller);
  const args = new Args().add(id);
  execute(args.serialize());
};

function getCallStack(): string[] {
  return Context.addressStack().map<string>((a) => a.toString());
}

function setCaller(address: string): void {
  const currentStack = getCallStack();
  currentStack[0] = address;
  changeCallStack(currentStack.join(' , '));
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
  return 'AU12' + mixRandomChars(47);
}
