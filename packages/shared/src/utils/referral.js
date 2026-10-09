"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
exports.isValidReferralCodeFormat = isValidReferralCodeFormat;
const crypto_1 = __importDefault(require("crypto"));
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateReferralCode() {
    let code = '';
    for (let i = 0; i < 8; i++) {
        const idx = crypto_1.default.randomInt(0, REFERRAL_ALPHABET.length);
        code += REFERRAL_ALPHABET[idx];
    }
    return code;
}
function isValidReferralCodeFormat(code) {
    if (code.length !== 8)
        return false;
    const upper = code.toUpperCase();
    for (const char of upper) {
        if (!REFERRAL_ALPHABET.includes(char))
            return false;
    }
    return true;
}
//# sourceMappingURL=referral.js.map