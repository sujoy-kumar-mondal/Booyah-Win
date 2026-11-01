"use strict";
/**
 * Money utilities:
 * Database columns are NUMERIC(12,2).
 * Code must use integer paise, NEVER floating point numbers.
 * API inputs and outputs format money as 2-decimal strings (e.g. "10.00", "0.50").
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paiseToString = paiseToString;
exports.stringToPaise = stringToPaise;
exports.formatDbNumeric = formatDbNumeric;
function paiseToString(paise) {
    const p = BigInt(paise);
    const isNegative = p < 0n;
    const abs = isNegative ? -p : p;
    const rupees = abs / 100n;
    const rem = abs % 100n;
    const remStr = rem.toString().padStart(2, '0');
    const result = `${rupees.toString()}.${remStr}`;
    return isNegative ? `-${result}` : result;
}
function stringToPaise(rupeeStr) {
    const trimmed = rupeeStr.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
        throw new Error(`Invalid money string format: "${rupeeStr}"`);
    }
    const isNegative = trimmed.startsWith('-');
    const clean = isNegative ? trimmed.slice(1) : trimmed;
    const parts = clean.split('.');
    const whole = BigInt(parts[0]);
    let fraction = 0n;
    if (parts.length > 1) {
        const fracStr = parts[1].padEnd(2, '0').slice(0, 2);
        fraction = BigInt(fracStr);
    }
    const totalPaise = whole * 100n + fraction;
    const signed = isNegative ? -totalPaise : totalPaise;
    if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new Error(`Money value overflow: "${rupeeStr}"`);
    }
    return Number(signed);
}
function formatDbNumeric(paise) {
    return paiseToString(paise);
}
//# sourceMappingURL=index.js.map