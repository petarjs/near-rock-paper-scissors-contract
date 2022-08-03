import { u128, Context, ContractPromise } from "near-sdk-as";

/**
 * == TYPES ====================================================================
 */

/**
 * Account IDs in NEAR are just strings.
 */
type aisize = i32;
export type AccountId = string;
export type VehicleId = string;
export type VehicleServiceId = string;

/**
 * Gas is u64
 */
export type Gas = u64;

/**
 * Amounts, Balances, and Money in NEAR is are u128.
 */

export type Amount = u128;
export type Balance = Amount;
export type Money = Amount;

/**
 * Timestamp in NEAR is a number.
 */
export type Timestamp = u64;

/**
 * == CONSTANTS ================================================================
 *
 * ONE_NEAR = unit of NEAR token in yocto Ⓝ (1e24)
 * XCC_GAS = gas for cross-contract calls, ~5 Tgas (teragas = 1e12) per "hop"
 * MIN_ACCOUNT_BALANCE = 3 NEAR min to keep account alive via storage staking
 *
 * TODO: revist MIN_ACCOUNT_BALANCE after some real data is included b/c this
 *  could end up being much higher
 */

export const ONE_NEAR = u128.from("1000000000000000000000000");
export const XCC_GAS: Gas = 20_000_000_000_000;
export const MIN_ACCOUNT_BALANCE: u128 = u128.mul(ONE_NEAR, u128.from(3));

/**
 * == FUNCTIONS ================================================================
 */

/**
 * @function asNEAR
 * @param amount {u128} - Yocto Ⓝ token quantity as an unsigned 128-bit integer
 * @returns {string}    - Amount in NEAR, as a string
 *
 * @example
 *
 *    asNEAR(7000000000000000000000000)
 *    // => '7'
 */
export function asNEAR(amount: u128): string {
  return u128.div(amount, ONE_NEAR).toString();
}

/**
 * @function toYocto
 * @param amount {number} - Integer to convert
 * @returns {u128}        - Amount in yocto Ⓝ as an unsigned 128-bit integer
 *
 * @example
 *
 *    toYocto(7)
 *    // => 7000000000000000000000000
 */
export function toYocto(amount: number): u128 {
  return u128.mul(ONE_NEAR, u128.from(amount));
}

let urlAlphabet = [
  "M",
  "o",
  "d",
  "u",
  "l",
  "e",
  "S",
  "y",
  "m",
  "b",
  "h",
  "a",
  "s",
  "O",
  "w",
  "n",
  "P",
  "r",
  "-",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "N",
  "R",
  "V",
  "f",
  "g",
  "c",
  "t",
  "i",
  "U",
  "v",
  "z",
  "_",
  "K",
  "q",
  "Y",
  "T",
  "J",
  "k",
  "L",
  "x",
  "p",
  "Z",
  "X",
  "I",
  "j",
  "Q",
  "W",
];

export function nanoid(length: number = 21): string {
  let id = "";
  for (let i = 0; i < length; i++) {
    id += urlAlphabet[i32(Math.floor(Math.random() * 64))];
  }
  return id;
}

/**
 * Function to assert that the contract has called itself
 */
export function assert_self(): void {
  const caller = Context.predecessor;
  const self = Context.contractName;
  assert(caller == self, "Only this contract may call itself");
}

export function assert_single_promise_success(): void {
  const x = ContractPromise.getResults();
  assert(x.length == 1, "Expected exactly one promise result");
  assert(x[0].succeeded, "Expected PromiseStatus to be successful");
}

/**
 * (best-effort) Constant-time hexadecimal encoding
 * @param bin Binary data
 * @returns Hex-encoded representation
 */
export function bin2hex(bin: Uint8Array): string {
  let bin_len = bin.length;
  let hex = "";
  for (let i = 0; i < bin_len; i++) {
    let bin_i = bin[i] as u32;
    let c = bin_i & 0xf;
    let b = bin_i >> 4;
    let x: u32 =
      ((87 + c + (((c - 10) >> 8) & ~38)) << 8) |
      (87 + b + (((b - 10) >> 8) & ~38));
    hex += String.fromCharCode(x as u8);
    x >>= 8;
    hex += String.fromCharCode(x as u8);
  }
  return hex;
}

/**
 * (best-effort) Constant-time hexadecimal decoding
 * @param hex Hex-encoded data
 * @returns Raw binary representation
 */
export function hex2bin(hex: string): Uint8Array | null {
  let hex_len = hex.length;
  if ((hex_len & 1) !== 0) {
    return null;
  }
  let bin = new Uint8Array(<aisize>(hex_len / 2));
  let c_acc = 0;
  let bin_pos = 0;
  let state = false;
  for (let hex_pos = 0; hex_pos < hex_len; hex_pos++) {
    let c = hex.charCodeAt(hex_pos) as u32;
    let c_num = c ^ 48;
    let c_num0 = (c_num - 10) >> 8;
    let c_alpha = (c & ~32) - 55;
    let c_alpha0 = ((c_alpha - 10) ^ (c_alpha - 16)) >> 8;
    if ((c_num0 | c_alpha0) === 0) {
      return null;
    }
    let c_val = ((c_num0 & c_num) | (c_alpha0 & c_alpha)) as u8;
    if (state === false) {
      c_acc = c_val << 4;
    } else {
      bin[bin_pos++] = c_acc | c_val;
    }
    state = !state;
  }
  return bin;
}
