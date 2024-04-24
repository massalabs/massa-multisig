import { Serializable, Args, Result } from '@massalabs/as-types';
import { Address } from '@massalabs/massa-as-sdk';

export class Transaction implements Serializable {
  constructor(
    public to: Address = new Address(''),
    public method: string = '',
    public value: u64 = 0,
    public data: StaticArray<u8> = [],
    public timestamp: u64 = 0,
    public executed: bool = false,
  ) {}

  serialize(): StaticArray<u8> {
    return new Args()
      .add(this.to)
      .add(this.method)
      .add(this.value)
      .add(this.data)
      .add(this.timestamp)
      .add(this.executed)
      .serialize();
  }

  deserialize(data: StaticArray<u8>, offset: i32): Result<i32> {
    const args = new Args(data, offset);
    this.to = new Address(args.nextString().expect('Error deserializing to'));
    this.method = args.nextString().expect('Error deserializing method');
    this.value = args.nextU64().expect('Error deserializing value');
    this.data = args.nextBytes().expect('Error deserializing data');
    this.timestamp = args.nextU64().expect('Error deserializing timestamp');
    const executed = args.nextBool();
    this.executed = executed.isOk() ? executed.unwrap() : false;
    return new Result(args.offset);
  }
}
