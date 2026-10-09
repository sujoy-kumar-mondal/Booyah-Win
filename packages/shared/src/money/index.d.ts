/**
 * Money utilities:
 * Database columns are NUMERIC(12,2).
 * Code must use integer paise, NEVER floating point numbers.
 * API inputs and outputs format money as 2-decimal strings (e.g. "10.00", "0.50").
 */
export declare function paiseToString(paise: number | bigint): string;
export declare function stringToPaise(rupeeStr: string): number;
export declare function formatDbNumeric(paise: number | bigint): string;
