// Random number schemes configuration
const SCHEMES = {
    // UUIDs
    uuid_v4: {
        name: 'UUID v4',
        emoji: '🔑',
        category: 'Identifiers',
        description: 'Universally Unique Identifier version 4, using cryptographically random bits. The gold standard for random identifiers.',
        bits: 122, // 128 bits - 6 fixed bits for version/variant
        format: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
        generate: function() {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    },

    uuid_v1: {
        name: 'UUID v1',
        emoji: '⏰',
        category: 'Identifiers',
        description: 'Time-based UUID using timestamp and MAC address. Less random than v4, includes temporal information.',
        bits: 61, // Approximation - clock sequence and node have some randomness
        format: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        generate: function() {
            const now = Date.now();
            const uuid100ns = (now * 10000) + 122192928000000000;
            const timeLow = (uuid100ns & 0xffffffff).toString(16).padStart(8, '0');
            const timeMid = ((uuid100ns >> 32) & 0xffff).toString(16).padStart(4, '0');
            const timeHi = (((uuid100ns >> 48) & 0x0fff) | 0x1000).toString(16).padStart(4, '0');
            const clockSeq = ((Math.random() * 0x3fff | 0) | 0x8000).toString(16).padStart(4, '0');
            const node = Array.from({length: 6}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
            return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
        }
    },

    uuid_v7: {
        name: 'UUID v7',
        emoji: '📅',
        category: 'Identifiers',
        description: 'Unix timestamp-based UUID (draft standard). Sortable and time-ordered while maintaining randomness.',
        bits: 74, // 48 bits timestamp + 74 random bits - fixed bits
        format: 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx',
        generate: function() {
            const now = Date.now();
            const hex = now.toString(16).padStart(12, '0');
            const timePart = hex.slice(0, 8) + '-' + hex.slice(8, 12);
            const randA = (Math.random() * 0x0fff | 0x7000).toString(16).padStart(4, '0');
            const randB = (Math.random() * 0x3fff | 0x8000).toString(16).padStart(4, '0');
            const randC = Array.from({length: 12}, () => Math.floor(Math.random() * 16).toString(16)).join('');
            return `${timePart}-${randA}-${randB}-${randC}`;
        }
    },

    // Network Addresses
    ipv6: {
        name: 'IPv6 Address',
        emoji: '🌐',
        category: 'Networking',
        description: 'Internet Protocol version 6 address with 128-bit address space. Designed to never run out.',
        bits: 128,
        format: 'xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx',
        generate: function() {
            const segments = [];
            for (let i = 0; i < 8; i++) {
                segments.push(Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0'));
            }
            return segments.join(':');
        }
    },

    ipv4: {
        name: 'IPv4 Address',
        emoji: '📡',
        category: 'Networking',
        description: 'Internet Protocol version 4 address. Only 4.3 billion possible addresses - we ran out!',
        bits: 32,
        format: 'xxx.xxx.xxx.xxx',
        generate: function() {
            return Array.from({length: 4}, () => Math.floor(Math.random() * 256)).join('.');
        }
    },

    mac_address: {
        name: 'MAC Address',
        emoji: '💻',
        category: 'Networking',
        description: 'Media Access Control address for network interfaces. Hardware identifier with manufacturer prefix.',
        bits: 48,
        format: 'XX:XX:XX:XX:XX:XX',
        generate: function() {
            const bytes = Array.from({length: 6}, () => Math.floor(Math.random() * 256));
            // Set locally administered bit, clear multicast bit
            bytes[0] = (bytes[0] | 0x02) & 0xfe;
            return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
        }
    },

    // Crypto Addresses
    bitcoin_address: {
        name: 'Bitcoin Address',
        emoji: '₿',
        category: 'Cryptocurrency',
        description: 'Bitcoin wallet address (P2PKH format). Derived from 256-bit private key through multiple hashes.',
        bits: 160, // RIPEMD-160 hash
        format: '1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        generate: function() {
            const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let address = '1';
            for (let i = 0; i < 33; i++) {
                address += chars[Math.floor(Math.random() * chars.length)];
            }
            return address;
        }
    },

    ethereum_address: {
        name: 'Ethereum Address',
        emoji: '⟠',
        category: 'Cryptocurrency',
        description: 'Ethereum wallet address. Last 20 bytes of Keccak-256 hash of public key.',
        bits: 160,
        format: '0x' + 'x'.repeat(40),
        generate: function() {
            let address = '0x';
            for (let i = 0; i < 40; i++) {
                address += Math.floor(Math.random() * 16).toString(16);
            }
            return address;
        }
    },

    // Financial
    credit_card: {
        name: 'Credit Card Number',
        emoji: '💳',
        category: 'Financial',
        description: 'Credit card number following Luhn algorithm validation. The checksum reduces entropy.',
        bits: 47, // ~53 bits minus checksum and IIN restrictions
        format: 'XXXX XXXX XXXX XXXX',
        generate: function() {
            // Generate Visa-style card
            let digits = [4]; // Visa starts with 4
            for (let i = 1; i < 15; i++) {
                digits.push(Math.floor(Math.random() * 10));
            }
            // Calculate Luhn checksum
            let sum = 0;
            for (let i = 0; i < 15; i++) {
                let d = digits[14 - i];
                if (i % 2 === 0) {
                    d *= 2;
                    if (d > 9) d -= 9;
                }
                sum += d;
            }
            digits.push((10 - (sum % 10)) % 10);
            const numStr = digits.join('');
            return `${numStr.slice(0,4)} ${numStr.slice(4,8)} ${numStr.slice(8,12)} ${numStr.slice(12,16)}`;
        }
    },

    iban: {
        name: 'IBAN',
        emoji: '🏦',
        category: 'Financial',
        description: 'International Bank Account Number. Country-specific format with checksum validation.',
        bits: 62, // Varies by country, using German IBAN as reference
        format: 'CCXX XXXX XXXX XXXX XXXX XX',
        generate: function() {
            // Generate German-style IBAN
            const countryCode = 'DE';
            const bankCode = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
            const accountNum = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
            const bban = bankCode + accountNum;
            // Simplified check digits (not real IBAN checksum)
            const checkDigits = String(Math.floor(Math.random() * 98) + 2).padStart(2, '0');
            const iban = countryCode + checkDigits + bban;
            return iban.replace(/(.{4})/g, '$1 ').trim();
        }
    },

    // Hardware IDs
    imei: {
        name: 'IMEI Number',
        emoji: '📱',
        category: 'Hardware',
        description: 'International Mobile Equipment Identity. 15-digit unique phone identifier with Luhn check.',
        bits: 46, // ~50 bits minus TAC and checksum
        format: 'XX-XXXXXX-XXXXXX-X',
        generate: function() {
            // TAC (Type Allocation Code) - using a realistic range
            const tac = String(35000000 + Math.floor(Math.random() * 5000000)).slice(0, 8);
            const serial = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
            const digits = (tac + serial).split('').map(Number);
            // Luhn checksum
            let sum = 0;
            for (let i = 0; i < 14; i++) {
                let d = digits[i];
                if (i % 2 === 1) {
                    d *= 2;
                    if (d > 9) d -= 9;
                }
                sum += d;
            }
            const check = (10 - (sum % 10)) % 10;
            const imei = tac + serial + check;
            return `${imei.slice(0,2)}-${imei.slice(2,8)}-${imei.slice(8,14)}-${imei.slice(14)}`;
        }
    },

    vin: {
        name: 'VIN',
        emoji: '🚗',
        category: 'Hardware',
        description: 'Vehicle Identification Number. 17-character code identifying cars, with check digit.',
        bits: 58, // Complex encoding reduces entropy
        format: 'XXXXXXXXXXXXXXXXX',
        generate: function() {
            const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // No I, O, Q
            let vin = '';
            for (let i = 0; i < 17; i++) {
                if (i === 8) {
                    vin += 'X'; // Check digit position (simplified)
                } else {
                    vin += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            return vin;
        }
    },

    // Book/Media
    isbn13: {
        name: 'ISBN-13',
        emoji: '📚',
        category: 'Publishing',
        description: 'International Standard Book Number. 13-digit book identifier with check digit.',
        bits: 33, // ~40 bits minus prefix and checksum
        format: 'XXX-X-XXXXX-XXX-X',
        generate: function() {
            const prefix = '978';
            const group = String(Math.floor(Math.random() * 10));
            const publisher = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
            const title = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            const digits = (prefix + group + publisher + title).split('').map(Number);
            // Calculate check digit
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += digits[i] * (i % 2 === 0 ? 1 : 3);
            }
            const check = (10 - (sum % 10)) % 10;
            const isbn = prefix + group + publisher + title + check;
            return `${isbn.slice(0,3)}-${isbn.slice(3,4)}-${isbn.slice(4,9)}-${isbn.slice(9,12)}-${isbn.slice(12)}`;
        }
    },

    // Communication
    phone_e164: {
        name: 'Phone (E.164)',
        emoji: '☎️',
        category: 'Communication',
        description: 'International phone number format. Up to 15 digits with country code.',
        bits: 40, // Varies by country
        format: '+X XXX XXX XXXX',
        generate: function() {
            const countryCodes = ['1', '44', '49', '33', '81', '86', '91'];
            const country = countryCodes[Math.floor(Math.random() * countryCodes.length)];
            const remaining = 15 - country.length - 1;
            let number = '';
            for (let i = 0; i < remaining; i++) {
                number += Math.floor(Math.random() * 10);
            }
            return `+${country} ${number.slice(0,3)} ${number.slice(3,6)} ${number.slice(6)}`;
        }
    },

    // Visual
    hex_color: {
        name: 'Hex Color',
        emoji: '🎨',
        category: 'Visual',
        description: 'RGB color code in hexadecimal. 16.7 million possible colors.',
        bits: 24,
        format: '#XXXXXX',
        generate: function() {
            const color = Math.floor(Math.random() * 0xffffff);
            return '#' + color.toString(16).padStart(6, '0').toUpperCase();
        }
    },

    // Tokens & Keys
    base64_token: {
        name: 'Base64 Token (32B)',
        emoji: '🔐',
        category: 'Security',
        description: '32-byte cryptographic token encoded in Base64. Standard for session tokens.',
        bits: 256,
        format: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=',
        generate: function() {
            const bytes = new Uint8Array(32);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                crypto.getRandomValues(bytes);
            } else {
                for (let i = 0; i < 32; i++) {
                    bytes[i] = Math.floor(Math.random() * 256);
                }
            }
            let binary = '';
            bytes.forEach(b => binary += String.fromCharCode(b));
            return btoa(binary);
        }
    },

    api_key: {
        name: 'API Key',
        emoji: '🗝️',
        category: 'Security',
        description: 'Typical API key format with prefix. Used for authentication in web services.',
        bits: 128,
        format: 'apikey_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        generate: function() {
            const prefixes = ['apikey_', 'token_', 'key_', 'secret_'];
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let key = prefix;
            for (let i = 0; i < 32; i++) {
                key += chars[Math.floor(Math.random() * chars.length)];
            }
            return key;
        }
    },

    session_id: {
        name: 'Session ID',
        emoji: '🎫',
        category: 'Security',
        description: 'Web session identifier. Typically 128-bit hex string for session management.',
        bits: 128,
        format: 'x'.repeat(32),
        generate: function() {
            let id = '';
            for (let i = 0; i < 32; i++) {
                id += Math.floor(Math.random() * 16).toString(16);
            }
            return id;
        }
    },

    otp_6: {
        name: 'OTP (6-digit)',
        emoji: '🔢',
        category: 'Authentication',
        description: 'One-Time Password. 6 digits gives only 1 million combinations - designed to be short-lived.',
        bits: 20, // ~20 bits for 6 decimal digits
        format: 'XXXXXX',
        generate: function() {
            return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        }
    },

    // Additional schemes to reach 20
    nanoid: {
        name: 'NanoID (21)',
        emoji: '🆔',
        category: 'Identifiers',
        description: 'Compact URL-friendly unique ID. 21 characters using URL-safe alphabet.',
        bits: 126, // 21 chars * 6 bits
        format: 'xxxxxxxxxxxxxxxxxxxxx',
        generate: function() {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
            let id = '';
            for (let i = 0; i < 21; i++) {
                id += alphabet[Math.floor(Math.random() * 64)];
            }
            return id;
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SCHEMES;
}
