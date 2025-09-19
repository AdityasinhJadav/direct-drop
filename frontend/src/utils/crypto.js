// End-to-End Encryption utilities using WebCrypto API
export class FileEncryption {
    constructor() {
        this.algorithm = 'AES-GCM'
        this.keyLength = 256
    }

    // Generate a random encryption key
    async generateKey() {
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength,
            },
            true, // extractable
            ['encrypt', 'decrypt']
        )
    }

    // Export key to base64 string for sharing
    async exportKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key)
        return btoa(String.fromCharCode(...new Uint8Array(exported)))
    }

    // Import key from base64 string
    async importKey(keyString) {
        const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0))
        return await crypto.subtle.importKey(
            'raw',
            keyData,
            {
                name: this.algorithm,
                length: this.keyLength,
            },
            true,
            ['encrypt', 'decrypt']
        )
    }

    // Encrypt file data
    async encryptFile(fileData, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            fileData
        )
        
        // Combine IV and encrypted data
        const result = new Uint8Array(iv.length + encryptedData.byteLength)
        result.set(iv, 0)
        result.set(new Uint8Array(encryptedData), iv.length)
        
        return result
    }

    // Decrypt file data
    async decryptFile(encryptedData, key) {
        const iv = encryptedData.slice(0, 12)
        const data = encryptedData.slice(12)
        
        return await crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            data
        )
    }

    // Generate a secure room key with encryption
    generateSecureRoomKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let result = ''
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    // Hash file for integrity verification
    async hashFile(fileData) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', fileData)
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    }
}

// Key exchange utilities
export class KeyExchange {
    constructor() {
        this.algorithm = 'ECDH'
        this.namedCurve = 'P-256'
    }

    // Generate key pair for key exchange
    async generateKeyPair() {
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                namedCurve: this.namedCurve,
            },
            true,
            ['deriveKey']
        )
    }

    // Export public key
    async exportPublicKey(keyPair) {
        const exported = await crypto.subtle.exportKey('spki', keyPair.publicKey)
        return btoa(String.fromCharCode(...new Uint8Array(exported)))
    }

    // Import public key
    async importPublicKey(publicKeyString) {
        const keyData = Uint8Array.from(atob(publicKeyString), c => c.charCodeAt(0))
        return await crypto.subtle.importKey(
            'spki',
            keyData,
            {
                name: this.algorithm,
                namedCurve: this.namedCurve,
            },
            true,
            []
        )
    }

    // Derive shared secret
    async deriveSharedSecret(privateKey, publicKey) {
        return await crypto.subtle.deriveKey(
            {
                name: this.algorithm,
                public: publicKey,
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256,
            },
            false,
            ['encrypt', 'decrypt']
        )
    }
}
