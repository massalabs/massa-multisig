import { Serializable, Args, Result } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';

export class Transaction implements Serializable {
  constructor(
    public to: Address = new Address(''),
    public method: string = '',
    public value: u64 = 0,
    public data: StaticArray<u8> = [],
    public executed: bool = false,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.to)
      .add(this.value)
      .add(this.data)
      .add(this.executed)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    this.to = new Address(args.nextString().unwrap());
    this.value = args.nextU64().unwrap();
    this.data = args.nextBytes().unwrap();
    this.executed = args.nextBool().unwrap();
    return new Result(args.offset);
  }
}
