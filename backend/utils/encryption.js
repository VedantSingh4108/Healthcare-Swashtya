const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef'; // 32 characters
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return text;
  
  // Return early if already encrypted (assuming format IV:ENCRYPTED_DATA)
  // This is a naive check; you might want a specific prefix like "ENC:"
  if (typeof text === 'string' && text.startsWith('ENC:')) return text;

  try {
    const stringValue = typeof text === 'string' ? text : JSON.stringify(text);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(stringValue);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return 'ENC:' + iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    return text;
  }
};

const decrypt = (text) => {
  if (!text) return text;
  if (typeof text !== 'string' || !text.startsWith('ENC:')) return text; // Return original if not encrypted

  try {
    const textParts = text.replace('ENC:', '').split(':');
    if (textParts.length !== 2) return text; // Invalid format
    
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return text;
  }
};

module.exports = {
  encrypt,
  decrypt
};
