import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { generatePassword, calculatePasswordStrength } from '../handlers/password-generator';
import { type GeneratePasswordInput } from '../schema';

describe('generatePassword', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate password with default settings', async () => {
    const input: GeneratePasswordInput = {
      length: 16,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password).toBeDefined();
    expect(result.password.length).toBe(16);
    expect(result.strength).toBeGreaterThan(0);
    expect(result.strength).toBeLessThanOrEqual(100);
    expect(typeof result.strength).toBe('number');
  });

  it('should generate password with specified length', async () => {
    const input: GeneratePasswordInput = {
      length: 32,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password.length).toBe(32);
    expect(result.strength).toBeGreaterThan(85); // Long passwords should have high strength
  });

  it('should include only requested character types', async () => {
    const input: GeneratePasswordInput = {
      length: 20,
      include_uppercase: false,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: false,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password).toMatch(/^[a-z0-9]+$/);
    expect(/[a-z]/.test(result.password)).toBe(true); // Should contain lowercase
    expect(/[0-9]/.test(result.password)).toBe(true); // Should contain numbers
    expect(/[A-Z]/.test(result.password)).toBe(false); // Should not contain uppercase
    expect(/[^a-zA-Z0-9]/.test(result.password)).toBe(false); // Should not contain symbols
  });

  it('should exclude ambiguous characters when requested', async () => {
    const input: GeneratePasswordInput = {
      length: 50, // Large sample to increase chances of ambiguous chars
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: true
    };

    const result = await generatePassword(input);

    // Should not contain 0, O, 1, l, I, |, `
    expect(result.password).not.toMatch(/[0O1lI|`]/);
  });

  it('should ensure character diversity', async () => {
    const input: GeneratePasswordInput = {
      length: 16,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    // With all character types enabled, should contain at least one of each
    expect(/[a-z]/.test(result.password)).toBe(true);
    expect(/[A-Z]/.test(result.password)).toBe(true);
    expect(/[0-9]/.test(result.password)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(result.password)).toBe(true);
  });

  it('should generate different passwords on multiple calls', async () => {
    const input: GeneratePasswordInput = {
      length: 16,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result1 = await generatePassword(input);
    const result2 = await generatePassword(input);
    const result3 = await generatePassword(input);

    // Very unlikely to generate identical passwords
    expect(result1.password).not.toBe(result2.password);
    expect(result2.password).not.toBe(result3.password);
    expect(result1.password).not.toBe(result3.password);
  });

  it('should handle minimum length', async () => {
    const input: GeneratePasswordInput = {
      length: 4,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password.length).toBe(4);
    expect(result.strength).toBeGreaterThan(0);
  });

  it('should handle maximum length', async () => {
    const input: GeneratePasswordInput = {
      length: 128,
      include_uppercase: true,
      include_lowercase: true,
      include_numbers: true,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password.length).toBe(128);
    expect(result.strength).toBe(100); // Should be maximum strength
  });

  it('should throw error when no character sets selected', async () => {
    const input: GeneratePasswordInput = {
      length: 16,
      include_uppercase: false,
      include_lowercase: false,
      include_numbers: false,
      include_symbols: false,
      exclude_ambiguous: false
    };

    await expect(generatePassword(input)).rejects.toThrow(/No character sets selected/i);
  });

  it('should work with only symbols enabled', async () => {
    const input: GeneratePasswordInput = {
      length: 12,
      include_uppercase: false,
      include_lowercase: false,
      include_numbers: false,
      include_symbols: true,
      exclude_ambiguous: false
    };

    const result = await generatePassword(input);

    expect(result.password).toMatch(/^[^a-zA-Z0-9]+$/);
    expect(result.password.length).toBe(12);
  });
});

describe('calculatePasswordStrength', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should calculate strength for strong password', async () => {
    const password = 'MyStr0ng!P@ssw0rd#2024';
    const result = await calculatePasswordStrength(password);

    expect(result.strength).toBeGreaterThan(80);
    expect(result.feedback).toBeDefined();
    expect(Array.isArray(result.feedback)).toBe(true);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('should calculate strength for weak password', async () => {
    const password = 'password';
    const result = await calculatePasswordStrength(password);

    expect(result.strength).toBeLessThan(50);
    expect(result.feedback.some(f => f.toLowerCase().includes('weak'))).toBe(true);
    expect(result.feedback.some(f => f.toLowerCase().includes('uppercase'))).toBe(true);
    expect(result.feedback.some(f => f.toLowerCase().includes('numbers'))).toBe(true);
    expect(result.feedback.some(f => f.toLowerCase().includes('special'))).toBe(true);
  });

  it('should penalize common patterns', async () => {
    const weakPassword = '123456789';
    const result = await calculatePasswordStrength(weakPassword);

    expect(result.strength).toBeLessThan(40);
    expect(result.feedback.some(f => f.toLowerCase().includes('sequence'))).toBe(true);
  });

  it('should penalize common words', async () => {
    const password = 'PasswordAdmin123';
    const result = await calculatePasswordStrength(password);

    expect(result.feedback.some(f => f.toLowerCase().includes('common'))).toBe(true);
  });

  it('should penalize repeating characters', async () => {
    const password = 'Passsssword123!';
    const result = await calculatePasswordStrength(password);

    expect(result.feedback.some(f => f.toLowerCase().includes('repeat'))).toBe(true);
  });

  it('should penalize year patterns', async () => {
    const password = 'MyPassword2024!';
    const result = await calculatePasswordStrength(password);

    expect(result.feedback.some(f => f.toLowerCase().includes('year') || f.toLowerCase().includes('date'))).toBe(true);
  });

  it('should provide length recommendations', async () => {
    const shortPassword = 'Abc1!';
    const result = await calculatePasswordStrength(shortPassword);

    expect(result.feedback.some(f => f.toLowerCase().includes('8 characters'))).toBe(true);
  });

  it('should handle empty password', async () => {
    const password = '';
    const result = await calculatePasswordStrength(password);

    expect(result.strength).toBe(0);
    expect(result.feedback.some(f => f.toLowerCase().includes('weak'))).toBe(true);
  });

  it('should give positive feedback for excellent passwords', async () => {
    const excellentPassword = 'MyVery$tr0ng&C0mpl3x#P@ssw0rd!2024#WithM0r3Chars';
    const result = await calculatePasswordStrength(excellentPassword);

    expect(result.strength).toBeGreaterThan(85);
    expect(result.feedback[0].toLowerCase()).toContain('excellent');
  });

  it('should handle special character diversity', async () => {
    const password = 'MyP@ssw0rd!';
    const result = await calculatePasswordStrength(password);

    expect(result.strength).toBeGreaterThan(60);
    // Should recognize that it has all character types
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(password)).toBe(true);
  });

  it('should provide specific missing character type feedback', async () => {
    const passwordNoSymbols = 'MyPassword123';
    const result = await calculatePasswordStrength(passwordNoSymbols);

    expect(result.feedback.some(f => f.toLowerCase().includes('special characters'))).toBe(true);
  });
});