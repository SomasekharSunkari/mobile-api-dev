import { BadRequestException } from '@nestjs/common';
import Big from 'big.js';

/**
 * Value object for blockchain asset amounts, ensuring precision and asset consistency.
 * Use for all arithmetic and comparisons on asset balances and amounts.
 */
export class AssetAmount {
  private constructor(
    readonly asset: string,
    private readonly value: Big,
    private readonly decimals: number = 6,
  ) {}

  /** Parse user‑facing decimal like “123.4567”. */
  static fromDecimal(asset: string, amount: string, decimals: number): AssetAmount {
    if (!/^-?\d+(\.\d+)?$/.test(amount)) throw new BadRequestException(`Invalid asset amount: ${amount}`);
    return new AssetAmount(asset, new Big(amount), decimals);
  }

  /** From DB DECIMAL string/number. */
  static fromDb(asset: string, dbValue: string | number, decimals: number): AssetAmount {
    return new AssetAmount(asset, new Big(dbValue), decimals);
  }

  /** Zero of same asset. */
  static zero(asset: string, decimals: number): AssetAmount {
    return new AssetAmount(asset, new Big(0), decimals);
  }

  add(other: AssetAmount): AssetAmount {
    this.assertSameAsset(other);
    return new AssetAmount(this.asset, this.value.plus(other.value), this.decimals);
  }

  sub(other: AssetAmount): AssetAmount {
    this.assertSameAsset(other);
    return new AssetAmount(this.asset, this.value.minus(other.value), this.decimals);
  }

  gt(other: AssetAmount): boolean {
    this.assertSameAsset(other);
    return this.value.gt(other.value, this.decimals);
  }

  lt(other: AssetAmount): boolean {
    this.assertSameAsset(other);
    return this.value.lt(other.value, this.decimals);
  }

  toString(): string {
    return this.value.toFixed();
  }

  toDb(): string {
    return this.value.toFixed();
  }

  toFullPrecision(): string {
    return this.value.toString();
  }

  toBigInt(): bigint {
    // Multiply by 10^decimals and round to nearest integer
    return BigInt(this.value.times(Math.pow(10, this.decimals)).round().toFixed(0));
  }

  private assertSameAsset(other: AssetAmount) {
    if (this.asset !== other.asset) throw new Error(`Asset mismatch: ${this.asset} vs ${other.asset}`);
  }
}
