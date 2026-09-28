function luhnSum(digits: string): number {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum;
}

export function npiCheckDigit(first9: string): number {
  const sum = luhnSum("80840" + first9);
  return (10 - (sum % 10)) % 10;
}

export function isValidNpi(npi: string): boolean {
  if (!/^[12]\d{9}$/.test(npi)) return false;
  return npiCheckDigit(npi.slice(0, 9)) === Number(npi[9]);
}

export function makeNpi(first9: string): string {
  return first9 + String(npiCheckDigit(first9));
}
