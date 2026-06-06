use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Argon2, Params};
use rand::{rngs::OsRng as RandOsRng, RngCore};
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKey(pub [u8; 32]);

#[derive(Debug)]
pub enum CryptoError {
    Argon2Error(String),
    EncryptionError(String),
    DecryptionError(String),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Argon2Error(e) => write!(f, "Argon2 error: {}", e),
            Self::EncryptionError(e) => write!(f, "Encryption error: {}", e),
            Self::DecryptionError(e) => write!(f, "Decryption error: {}", e),
        }
    }
}

pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    RandOsRng.fill_bytes(&mut salt);
    salt
}

pub fn generate_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    RandOsRng.fill_bytes(&mut nonce);
    nonce
}

pub fn derive_key(password: &str, salt: &[u8; 16]) -> Result<SecretKey, CryptoError> {
    let mut secret_key = SecretKey([0u8; 32]);
    let params =
        Params::new(65536, 3, 4, Some(32)).map_err(|e| CryptoError::Argon2Error(e.to_string()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    argon2
        .hash_password_into(password.as_bytes(), salt, &mut secret_key.0)
        .map_err(|e| CryptoError::Argon2Error(e.to_string()))?;

    Ok(secret_key)
}

pub fn encrypt_payload(
    plaintext: &[u8],
    key: &SecretKey,
    nonce: &[u8; 12],
) -> Result<Vec<u8>, CryptoError> {
    let cipher_key = Key::<Aes256Gcm>::from_slice(&key.0);
    let cipher = Aes256Gcm::new(cipher_key);
    let gcm_nonce = Nonce::from_slice(nonce);

    cipher
        .encrypt(gcm_nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))
}

pub fn decrypt_payload(
    ciphertext: &[u8],
    key: &SecretKey,
    nonce: &[u8; 12],
) -> Result<Vec<u8>, CryptoError> {
    let cipher_key = Key::<Aes256Gcm>::from_slice(&key.0);
    let cipher = Aes256Gcm::new(cipher_key);
    let gcm_nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(gcm_nonce, ciphertext)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_cycle() {
        let password = "super_secure_master_password";
        let salt = generate_salt();
        let key = derive_key(password, &salt).unwrap();
        let nonce = generate_nonce();

        let plaintext = b"Hello, Vault!";

        let ciphertext = encrypt_payload(plaintext, &key, &nonce).unwrap();
        assert_ne!(plaintext.as_slice(), ciphertext.as_slice());

        let decrypted = decrypt_payload(&ciphertext, &key, &nonce).unwrap();
        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_wrong_key_fails() {
        let password = "pass1";
        let salt = generate_salt();
        let key1 = derive_key(password, &salt).unwrap();

        let password_wrong = "pass2";
        let key2 = derive_key(password_wrong, &salt).unwrap();

        let nonce = generate_nonce();
        let plaintext = b"Secret data";

        let ciphertext = encrypt_payload(plaintext, &key1, &nonce).unwrap();

        let result = decrypt_payload(&ciphertext, &key2, &nonce);
        assert!(result.is_err());
    }
}
