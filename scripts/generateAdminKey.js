import crypto from 'crypto';

console.log('=== Admin Key Generator ===');
console.log('Random Hex Key:', crypto.randomBytes(32).toString('hex'));
console.log('Random Base64 Key:', crypto.randomBytes(32).toString('base64'));
console.log('UUID Key:', crypto.randomUUID());

// Choose one and add it to your .env file