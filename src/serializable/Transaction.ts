import {
  Args,
  type DeserializedResult,
  type Serializable,
} from '@massalabs/massa-web3';

export class Transaction implements Serializable<Transaction> {
  constructor(
    public to: string = '',
    public method: string = '',
    public value: bigint = 0n,
    public data: Uint8Array = new Uint8Array(),
    public timestamp: bigint = 0n,
    public executed: boolean = false,
  ) {}

  serialize(): Uint8Array {
    return new Args()
      .addString(this.to)
      .addString(this.method)
      .addU64(this.value)
      .addUint8Array(this.data)
      .addU64(this.timestamp)
      .addBool(this.executed)
      .serialize();
  }

  deserialize(data: Uint8Array, offset = 0): DeserializedResult<Transaction> {
    const args = new Args(data, offset);

    this.to = args.nextString();
    this.method = args.nextString();
    this.value = args.nextU64();
    this.data = args.nextUint8Array();
    this.timestamp = args.nextU64();
    this.executed = args.nextBool();

    return {
      instance: this,
      offset: args.getOffset(),
    };
  }
}
