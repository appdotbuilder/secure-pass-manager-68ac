import { type GeneratePasswordInput, type GeneratedPassword } from '../schema';

export async function generatePassword(input: GeneratePasswordInput): Promise<GeneratedPassword> {
  // Character sets for password generation
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Ambiguous characters that can be confused
  const ambiguousChars = /[0O1lI|`]/g;
  
  // Build character pool based on options
  let charPool = '';
  let requiredChars: string[] = [];
  
  if (input.include_lowercase) {
    const chars = input.exclude_ambiguous ? lowercase.replace(ambiguousChars, '') : lowercase;
    charPool += chars;
    // Ensure at least one lowercase character
    if (chars.length > 0) {
      requiredChars.push(getRandomChar(chars));
    }
  }
  
  if (input.include_uppercase) {
    const chars = input.exclude_ambiguous ? uppercase.replace(ambiguousChars, '') : uppercase;
    charPool += chars;
    // Ensure at least one uppercase character
    if (chars.length > 0) {
      requiredChars.push(getRandomChar(chars));
    }
  }
  
  if (input.include_numbers) {
    const chars = input.exclude_ambiguous ? numbers.replace(ambiguousChars, '') : numbers;
    charPool += chars;
    // Ensure at least one number
    if (chars.length > 0) {
      requiredChars.push(getRandomChar(chars));
    }
  }
  
  if (input.include_symbols) {
    const chars = input.exclude_ambiguous ? symbols.replace(ambiguousChars, '') : symbols;
    charPool += chars;
    // Ensure at least one symbol
    if (chars.length > 0) {
      requiredChars.push(getRandomChar(chars));
    }
  }
  
  // Ensure we have at least some characters to work with
  if (charPool.length === 0) {
    throw new Error('No character sets selected for password generation');
  }
  
  // Generate password
  const password = generateSecurePassword(input.length, charPool, requiredChars);
  
  // Calculate strength
  const strength = calculateStrengthScore(password, {
    hasLowercase: input.include_lowercase,
    hasUppercase: input.include_uppercase,
    hasNumbers: input.include_numbers,
    hasSymbols: input.include_symbols,
    excludesAmbiguous: input.exclude_ambiguous
  });
  
  return {
    password,
    strength
  };
}

export async function calculatePasswordStrength(password: string): Promise<{ strength: number, feedback: string[] }> {
  const feedback: string[] = [];
  let score = 0;
  
  // Length scoring (40% of total score)
  const lengthScore = Math.min(password.length * 2.5, 40);
  score += lengthScore;
  
  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters long');
  } else if (password.length < 12) {
    feedback.push('Consider using 12+ characters for better security');
  } else if (password.length < 16) {
    feedback.push('Excellent length! Consider 16+ characters for maximum security');
  }
  
  // Character diversity scoring (60% of total score)
  let diversityScore = 0;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);
  
  const characterSets = [hasLowercase, hasUppercase, hasNumbers, hasSymbols].filter(Boolean).length;
  diversityScore = characterSets * 15; // 15 points per character set (max 60)
  score += diversityScore;
  
  if (!hasLowercase) feedback.push('Add lowercase letters');
  if (!hasUppercase) feedback.push('Add uppercase letters');
  if (!hasNumbers) feedback.push('Add numbers');
  if (!hasSymbols) feedback.push('Add special characters (!@#$%^&* etc.)');
  
  // Common patterns check
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeating characters');
  }
  
  if (/123|abc|qwe|asd|zxc/i.test(password)) {
    score -= 15;
    feedback.push('Avoid common sequences (123, abc, qwe, etc.)');
  }
  
  if (/password|admin|login|user|test|welcome|letmein|monkey|dragon|master|shadow|superman|batman/i.test(password)) {
    score -= 20;
    feedback.push('Avoid common words and phrases');
  }
  
  // Date patterns
  if (/19\d{2}|20\d{2}/.test(password)) {
    score -= 10;
    feedback.push('Avoid using years or dates');
  }
  
  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));
  
  // Provide positive feedback for strong passwords
  if (score >= 90) {
    feedback.unshift('Excellent password strength!');
  } else if (score >= 75) {
    feedback.unshift('Good password strength');
  } else if (score >= 50) {
    feedback.unshift('Moderate password strength');
  } else {
    feedback.unshift('Weak password - consider improvements');
  }
  
  return {
    strength: Math.round(score),
    feedback
  };
}

// Helper function to generate cryptographically secure random character
function getRandomChar(charset: string): string {
  if (charset.length === 0) return '';
  
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  const randomIndex = randomValues[0] % charset.length;
  return charset[randomIndex];
}

// Helper function to generate secure password
function generateSecurePassword(length: number, charPool: string, requiredChars: string[]): string {
  const passwordArray: string[] = [];
  
  // Start with required characters to ensure diversity
  requiredChars.forEach(char => passwordArray.push(char));
  
  // Fill remaining positions with random characters
  for (let i = requiredChars.length; i < length; i++) {
    passwordArray.push(getRandomChar(charPool));
  }
  
  // Shuffle the password array using Fisher-Yates algorithm with crypto random
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const j = randomValues[0] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }
  
  return passwordArray.join('');
}

// Helper function to calculate strength score for generated passwords
function calculateStrengthScore(password: string, options: {
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumbers: boolean;
  hasSymbols: boolean;
  excludesAmbiguous: boolean;
}): number {
  let score = 0;
  
  // Length score (40% of total)
  score += Math.min(password.length * 2.5, 40);
  
  // Character set diversity (60% of total)
  let charSets = 0;
  if (options.hasLowercase && /[a-z]/.test(password)) charSets++;
  if (options.hasUppercase && /[A-Z]/.test(password)) charSets++;
  if (options.hasNumbers && /\d/.test(password)) charSets++;
  if (options.hasSymbols && /[^a-zA-Z0-9]/.test(password)) charSets++;
  
  score += charSets * 15;
  
  // Bonus for excluding ambiguous characters
  if (options.excludesAmbiguous) {
    score += 5;
  }
  
  return Math.min(100, Math.round(score));
}