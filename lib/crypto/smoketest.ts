import {
  decryptCredential,
  deriveMasterKey,
  encryptCredential,
  generateKdfSalt,
  hashPassword,
  verifyPassword,
} from './encryption';

async function main() {
  const webappPassword = 'SuperSecret123!';

  console.log('=== Password hash + verify ===');
  const ph = await hashPassword(webappPassword);
  console.log('  hash sample:', ph.slice(0, 40), '...');
  console.log('  verify (correct):', await verifyPassword(ph, webappPassword));
  console.log('  verify (wrong):', await verifyPassword(ph, 'WrongPassword'));

  console.log('\n=== Master key derivation ===');
  const salt = generateKdfSalt();
  console.log('  salt:', salt.toString('hex'));
  const masterKey = await deriveMasterKey(webappPassword, salt);
  console.log('  masterKey length:', masterKey.length);
  console.log('  masterKey hex (first 16):', masterKey.toString('hex').slice(0, 32));

  console.log('\n=== Roundtrip same password+salt → same key ===');
  const k2 = await deriveMasterKey(webappPassword, salt);
  console.log('  equal:', masterKey.equals(k2));

  console.log('\n=== Encrypt + Decrypt FCU password ===');
  const fcuPassword = 'Harryhua20051023!';
  const enc = encryptCredential(masterKey, fcuPassword);
  console.log('  nonce:', enc.nonce.toString('hex'));
  console.log('  ciphertext:', enc.ciphertext.toString('hex'));
  console.log('  authTag:', enc.authTag.toString('hex'));
  const dec = decryptCredential(masterKey, enc.nonce, enc.ciphertext, enc.authTag);
  console.log('  decrypted:', dec);
  console.log('  match:', dec === fcuPassword);

  console.log('\n=== Wrong key fails ===');
  const wrongKey = await deriveMasterKey('WrongPassword', salt);
  try {
    decryptCredential(wrongKey, enc.nonce, enc.ciphertext, enc.authTag);
    console.log('  FAIL — should have thrown');
  } catch (e) {
    console.log('  OK — decrypt rejected:', (e as Error).message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
