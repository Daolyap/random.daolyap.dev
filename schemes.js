// Random number schemes configuration
// Note: Generators use crypto.getRandomValues() when available for cryptographically secure randomness.
// This accurately represents how real-world implementations generate these identifiers.
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
            // Fallback using crypto.getRandomValues for cryptographic security
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(16);
                crypto.getRandomValues(bytes);
                // Set version 4 and variant bits per RFC 4122
                bytes[6] = (bytes[6] & 0x0f) | 0x40;
                bytes[8] = (bytes[8] & 0x3f) | 0x80;
                const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
            }
            throw new Error('Secure random UUID v4 generation is not supported in this environment.');
        }
    },

    uuid_v1: {
        name: 'UUID v1',
        emoji: '⏰',
        category: 'Identifiers',
        description: 'Time-based UUID using timestamp and MAC address. Timestamp is predictable; effective random entropy is ~14 bits (clock sequence).',
        bits: 14, // Only clock sequence is truly random; timestamp and node are predictable/generated
        format: 'xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx',
        generate: function() {
            // Use BigInt for proper 64-bit arithmetic
            const now = BigInt(Date.now());
            const uuid100ns = (now * 10000n) + 122192928000000000n;
            const timeLow = (uuid100ns & 0xffffffffn).toString(16).padStart(8, '0');
            const timeMid = ((uuid100ns >> 32n) & 0xffffn).toString(16).padStart(4, '0');
            const timeHi = (((uuid100ns >> 48n) & 0x0fffn) | 0x1000n).toString(16).padStart(4, '0');
            // Use crypto for clock sequence
            let clockSeqRand;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const arr = new Uint16Array(1);
                crypto.getRandomValues(arr);
                clockSeqRand = arr[0] & 0x3fff;
            } else {
                clockSeqRand = Math.floor(Math.random() * 0x3fff);
            }
            const clockSeq = ((clockSeqRand) | 0x8000).toString(16).padStart(4, '0');
            // Generate random node (MAC-like)
            let nodeBytes;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                nodeBytes = new Uint8Array(6);
                crypto.getRandomValues(nodeBytes);
            } else {
                nodeBytes = Array.from({length: 6}, () => Math.floor(Math.random() * 256));
            }
            const node = Array.from(nodeBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
        }
    },

    uuid_v7: {
        name: 'UUID v7',
        emoji: '📅',
        category: 'Identifiers',
        description: 'Unix timestamp-based UUID (draft standard). 48 bits are predictable timestamp; effective random entropy is ~74 bits.',
        bits: 74, // 122 total random bits - 48 timestamp bits = 74 effective random bits
        format: 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx',
        generate: function() {
            const now = Date.now();
            const hex = now.toString(16).padStart(12, '0');
            const timePart = hex.slice(0, 8) + '-' + hex.slice(8, 12);
            // Use crypto for random portions
            let randA, randB, randC;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const arr = new Uint16Array(2);
                crypto.getRandomValues(arr);
                randA = ((arr[0] & 0x0fff) | 0x7000).toString(16).padStart(4, '0');
                randB = ((arr[1] & 0x3fff) | 0x8000).toString(16).padStart(4, '0');
                const randBytes = new Uint8Array(6);
                crypto.getRandomValues(randBytes);
                randC = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
                randA = (Math.floor(Math.random() * 0x0fff) | 0x7000).toString(16).padStart(4, '0');
                randB = (Math.floor(Math.random() * 0x3fff) | 0x8000).toString(16).padStart(4, '0');
                randC = Array.from({length: 12}, () => Math.floor(Math.random() * 16).toString(16)).join('');
            }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint16Array(8);
                crypto.getRandomValues(bytes);
                return Array.from(bytes).map(b => b.toString(16).padStart(4, '0')).join(':');
            }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(4);
                crypto.getRandomValues(bytes);
                return Array.from(bytes).join('.');
            }
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
            let bytes;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                bytes = new Uint8Array(6);
                crypto.getRandomValues(bytes);
                bytes = Array.from(bytes);
            } else {
                bytes = Array.from({length: 6}, () => Math.floor(Math.random() * 256));
            }
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
        description: 'Bitcoin wallet address (P2PKH format, simplified). Real addresses use Base58Check with checksum validation.',
        bits: 160, // RIPEMD-160 hash
        format: '1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        generate: function() {
            const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let address = '1';
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(33);
                crypto.getRandomValues(bytes);
                for (let i = 0; i < 33; i++) {
                    address += chars[bytes[i] % chars.length];
                }
            } else {
                for (let i = 0; i < 33; i++) {
                    address += chars[Math.floor(Math.random() * chars.length)];
                }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(20);
                crypto.getRandomValues(bytes);
                address += Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
                for (let i = 0; i < 40; i++) {
                    address += Math.floor(Math.random() * 16).toString(16);
                }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(14);
                crypto.getRandomValues(bytes);
                for (let i = 0; i < 14; i++) {
                    digits.push(bytes[i] % 10);
                }
            } else {
                for (let i = 1; i < 15; i++) {
                    digits.push(Math.floor(Math.random() * 10));
                }
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
        description: 'International Bank Account Number (simplified). Real IBANs use MOD 97 checksum validation.',
        bits: 62, // Varies by country, using German IBAN as reference
        format: 'CCXX XXXX XXXX XXXX XXXX XX',
        generate: function() {
            // Generate German-style IBAN (simplified - real IBANs use MOD 97 checksum)
            const countryCode = 'DE';
            let bankCode, accountNum, checkDigits;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(10);
                crypto.getRandomValues(bytes);
                bankCode = Array.from(bytes.slice(0, 4)).map(b => b % 10).join('').padStart(8, '0');
                accountNum = Array.from(bytes.slice(4, 10)).map(b => b % 10).join('').padStart(10, '0');
                const checkByte = new Uint8Array(1);
                crypto.getRandomValues(checkByte);
                checkDigits = String((checkByte[0] % 98) + 2).padStart(2, '0');
            } else {
                bankCode = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
                accountNum = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
                checkDigits = String(Math.floor(Math.random() * 98) + 2).padStart(2, '0');
            }
            const bban = bankCode + accountNum;
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
            let tac, serial;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(7);
                crypto.getRandomValues(bytes);
                // TAC (Type Allocation Code) - using a realistic range
                const tacNum = 35000000 + (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 5000000;
                tac = String(tacNum).slice(0, 8);
                serial = Array.from(bytes.slice(3)).map(b => b % 10).join('').padStart(6, '0');
            } else {
                tac = String(35000000 + Math.floor(Math.random() * 5000000)).slice(0, 8);
                serial = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
            }
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
        description: 'Vehicle Identification Number. 17-character code identifying cars, with proper check digit.',
        bits: 58, // Complex encoding reduces entropy
        format: 'XXXXXXXXXXXXXXXXX',
        generate: function() {
            const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // No I, O, Q
            // VIN transliteration map (ISO 3779)
            const transliteration = {
                A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
                J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
                S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
                '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
                '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
            };
            // Weights for positions 1–17
            const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
            
            // Generate base VIN characters
            let vinChars;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(17);
                crypto.getRandomValues(bytes);
                vinChars = Array.from(bytes).map(b => chars[b % chars.length]);
            } else {
                vinChars = [];
                for (let i = 0; i < 17; i++) {
                    vinChars[i] = chars[Math.floor(Math.random() * chars.length)];
                }
            }
            
            // Calculate check digit
            let sum = 0;
            for (let i = 0; i < 17; i++) {
                const ch = vinChars[i];
                const value = transliteration[ch] !== undefined ? transliteration[ch] : 0;
                sum += value * weights[i];
            }
            const remainder = sum % 11;
            // Position 9 (index 8) is the check digit
            vinChars[8] = remainder === 10 ? 'X' : String(remainder);
            
            return vinChars.join('');
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
            let group, publisher, title;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(9);
                crypto.getRandomValues(bytes);
                group = String(bytes[0] % 10);
                publisher = Array.from(bytes.slice(1, 6)).map(b => b % 10).join('').padStart(5, '0');
                title = Array.from(bytes.slice(6, 9)).map(b => b % 10).join('').padStart(3, '0');
            } else {
                group = String(Math.floor(Math.random() * 10));
                publisher = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
                title = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            }
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
            let countryIdx, number;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(14);
                crypto.getRandomValues(bytes);
                countryIdx = bytes[0] % countryCodes.length;
                number = Array.from(bytes.slice(1)).map(b => b % 10).join('');
            } else {
                countryIdx = Math.floor(Math.random() * countryCodes.length);
                number = '';
                for (let i = 0; i < 13; i++) {
                    number += Math.floor(Math.random() * 10);
                }
            }
            const country = countryCodes[countryIdx];
            const remaining = 15 - country.length - 1;
            number = number.slice(0, remaining);
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(3);
                crypto.getRandomValues(bytes);
                return '#' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
            }
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
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let key;
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(33);
                crypto.getRandomValues(bytes);
                const prefix = prefixes[bytes[0] % prefixes.length];
                key = prefix + Array.from(bytes.slice(1)).map(b => chars[b % chars.length]).join('');
            } else {
                const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                key = prefix;
                for (let i = 0; i < 32; i++) {
                    key += chars[Math.floor(Math.random() * chars.length)];
                }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(16);
                crypto.getRandomValues(bytes);
                return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(3);
                crypto.getRandomValues(bytes);
                const num = (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 1000000;
                return String(num).padStart(6, '0');
            }
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
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const bytes = new Uint8Array(21);
                crypto.getRandomValues(bytes);
                return Array.from(bytes).map(b => alphabet[b % 64]).join('');
            }
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
