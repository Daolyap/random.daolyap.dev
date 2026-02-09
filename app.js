// Main application logic
class RandomVisualizer {
    constructor() {
        this.selectedScheme = null;
        this.targetValue = null;
        this.workers = [];
        this.blobUrls = []; // Track blob URLs for cleanup
        this.isRunning = false;
        this.startTime = null;
        this.totalAttempts = 0;
        this.attemptHistory = [];
        this.updateInterval = null;
        this.maxAttemptsCheck = null;
        this.workerErrors = [];
        this.wordlistData = null;
        
        this.init();
    }

    init() {
        this.renderSchemeGrid();
        this.setupEventListeners();
        this.updateControlDisplays();
    }

    renderSchemeGrid() {
        const grid = document.getElementById('schemeGrid');
        grid.innerHTML = '';
        
        Object.entries(SCHEMES).forEach(([key, scheme]) => {
            const card = document.createElement('div');
            card.className = 'scheme-card';
            card.dataset.scheme = key;
            card.innerHTML = `
                <div class="emoji">${scheme.emoji}</div>
                <div class="name">${scheme.name}</div>
                <div class="category">${scheme.category}</div>
            `;
            card.addEventListener('click', () => this.selectScheme(key));
            grid.appendChild(card);
        });
    }

    selectScheme(key) {
        // Update visual selection
        document.querySelectorAll('.scheme-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.scheme === key);
        });

        this.selectedScheme = key;
        const scheme = SCHEMES[key];

        // Show and update info section
        const infoSection = document.getElementById('schemeInfo');
        infoSection.style.display = 'block';
        
        document.getElementById('schemeName').textContent = `${scheme.emoji} ${scheme.name}`;
        document.getElementById('schemeDescription').textContent = scheme.description;
        document.getElementById('bitEntropy').textContent = `${scheme.bits} bits`;
        document.getElementById('combinations').textContent = this.formatCombinations(scheme.bits);
        document.getElementById('format').textContent = scheme.format;

        // Show generator section
        document.getElementById('generator').style.display = 'block';
        
        // Reset state
        this.reset();
        
        // Update estimation
        this.updateEstimation();
    }

    formatCombinations(bits) {
        const combinations = Math.pow(2, bits);
        if (combinations === Infinity) {
            return `2^${bits} ≈ ${this.scientificNotation(bits)}`;
        }
        if (combinations > 1e15) {
            return `2^${bits} ≈ ${this.scientificNotation(bits)}`;
        }
        return combinations.toLocaleString();
    }

    scientificNotation(bits) {
        // 2^bits = 10^(bits * log10(2))
        const log10 = bits * 0.30103;
        const exponent = Math.floor(log10);
        const mantissa = Math.pow(10, log10 - exponent);
        return `${mantissa.toFixed(2)} × 10^${exponent}`;
    }

    setupEventListeners() {
        // Generate button
        document.getElementById('generateBtn').addEventListener('click', () => this.generateTarget());
        
        // Start/Stop buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());

        // Range inputs
        document.getElementById('workerCount').addEventListener('input', (e) => {
            document.getElementById('workerCountDisplay').textContent = e.target.value;
            this.updateEstimation();
        });

        document.getElementById('speedLimit').addEventListener('input', (e) => {
            document.getElementById('speedLimitDisplay').textContent = parseInt(e.target.value).toLocaleString();
            this.updateEstimation();
        });

        document.getElementById('maxAttempts').addEventListener('change', () => {
            this.updateEstimation();
        });

        // Attack method
        document.getElementById('attackMethod').addEventListener('change', (e) => {
            this.updateAttackMethodUI(e.target.value);
            this.updateEstimation();
        });

        // Wordlist file
        document.getElementById('wordlistFile').addEventListener('change', (e) => {
            this.handleWordlistUpload(e);
        });
    }

    updateControlDisplays() {
        document.getElementById('workerCountDisplay').textContent = document.getElementById('workerCount').value;
        document.getElementById('speedLimitDisplay').textContent = parseInt(document.getElementById('speedLimit').value).toLocaleString();
    }

    updateAttackMethodUI(method) {
        const wordlistGroup = document.getElementById('wordlistGroup');
        const speedLimitGroup = document.getElementById('speedLimitGroup');
        const methodHint = document.getElementById('methodHint');

        wordlistGroup.style.display = method === 'wordlist' ? 'flex' : 'none';
        speedLimitGroup.style.display = method === 'wordlist' ? 'none' : '';

        const hints = {
            sequential: 'Workers partition the search space — no duplicates',
            random: 'Workers generate random values independently',
            wordlist: 'Each worker tests a portion of the uploaded wordlist'
        };
        methodHint.textContent = hints[method] || '';
    }

    handleWordlistUpload(e) {
        const file = e.target.files[0];
        const infoEl = document.getElementById('wordlistInfo');
        if (!file) {
            this.wordlistData = null;
            infoEl.textContent = 'No file selected';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = [...new Set(event.target.result.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0))];
            this.wordlistData = lines;
            infoEl.textContent = `${lines.length.toLocaleString()} unique entries loaded from ${file.name}`;
        };
        reader.onerror = () => {
            this.wordlistData = null;
            infoEl.textContent = 'Error reading file';
        };
        reader.readAsText(file);
    }

    generateTarget() {
        if (!this.selectedScheme) return;
        
        const scheme = SCHEMES[this.selectedScheme];
        this.targetValue = scheme.generate();
        
        document.getElementById('targetValue').textContent = this.targetValue;
        document.getElementById('startBtn').disabled = false;
        
        this.updateEstimation();
    }

    updateEstimation() {
        if (!this.selectedScheme || !this.targetValue) {
            document.getElementById('estimationText').textContent = 'Generate a target to see time estimation';
            return;
        }

        const scheme = SCHEMES[this.selectedScheme];
        const workerCount = parseInt(document.getElementById('workerCount').value);
        const speedPerWorker = parseInt(document.getElementById('speedLimit').value);
        
        // Estimate based on bits of entropy
        // Average case for brute force is half the search space
        const combinations = Math.pow(2, scheme.bits);
        // Estimate ~10 batches per second (actual rate varies by device; shown as approximate)
        const attemptsPerSecond = workerCount * speedPerWorker * 10;
        const averageAttempts = combinations / 2;
        const estimatedSeconds = averageAttempts / attemptsPerSecond;

        let timeStr = this.formatTime(estimatedSeconds);
        let probabilityInfo = this.calculateProbability(scheme.bits, attemptsPerSecond);

        document.getElementById('estimationText').innerHTML = `
            <strong>Search space:</strong> 2^${scheme.bits} = ${this.formatCombinations(scheme.bits)} combinations<br>
            <strong>Expected rate:</strong> ~${attemptsPerSecond.toLocaleString()} attempts/second (approximate)<br>
            <strong>Average time to find match:</strong> ${timeStr}<br>
            <strong>Probability after 1 hour:</strong> ${probabilityInfo.oneHour}<br>
            <strong>Probability after 1 year:</strong> ${probabilityInfo.oneYear}
        `;
    }

    calculateProbability(bits, attemptsPerSecond) {
        const combinations = Math.pow(2, bits);
        
        // Probability of finding match = 1 - (1 - 1/N)^attempts
        // For small probabilities (attempts << combinations), this approximates to attempts/N
        // For larger probabilities, we use the exact formula where computationally feasible
        const attemptsOneHour = attemptsPerSecond * 3600;
        const attemptsOneYear = attemptsPerSecond * 3600 * 24 * 365;
        
        let probOneHour, probOneYear;
        
        // Use exact formula for smaller spaces, approximation for very large
        if (combinations < 1e15 && attemptsOneHour < combinations * 0.1) {
            // Exact formula is feasible
            probOneHour = 1 - Math.pow(1 - 1/combinations, attemptsOneHour);
            probOneYear = 1 - Math.pow(1 - 1/combinations, attemptsOneYear);
        } else {
            // Use approximation for very large numbers
            probOneHour = Math.min(1, attemptsOneHour / combinations);
            probOneYear = Math.min(1, attemptsOneYear / combinations);
        }
        
        return {
            oneHour: this.formatProbability(probOneHour),
            oneYear: this.formatProbability(probOneYear)
        };
    }

    formatProbability(prob) {
        if (prob >= 0.99) return '~100%';
        if (prob >= 0.01) return (prob * 100).toFixed(4) + '%';
        if (prob >= 1e-10) return prob.toExponential(2);
        if (prob === 0 || !isFinite(prob)) return '~0 (effectively impossible)';
        return prob.toExponential(2);
    }

    formatTime(seconds) {
        if (!isFinite(seconds)) return 'Effectively infinite (heat death of universe scale)';
        
        const minute = 60;
        const hour = minute * 60;
        const day = hour * 24;
        const year = day * 365;
        const century = year * 100;
        const universeAge = year * 13.8e9;

        if (seconds < minute) return `${seconds.toFixed(1)} seconds`;
        if (seconds < hour) return `${(seconds / minute).toFixed(1)} minutes`;
        if (seconds < day) return `${(seconds / hour).toFixed(1)} hours`;
        if (seconds < year) return `${(seconds / day).toFixed(1)} days`;
        if (seconds < century) return `${(seconds / year).toFixed(1)} years`;
        if (seconds < universeAge) return `${(seconds / year).toExponential(2)} years`;
        return `${(seconds / universeAge).toExponential(2)} × age of universe`;
    }

    startSimulation() {
        if (!this.targetValue || this.isRunning) return;

        const attackMethod = document.getElementById('attackMethod').value;

        // Validate wordlist mode
        if (attackMethod === 'wordlist' && (!this.wordlistData || this.wordlistData.length === 0)) {
            alert('Please upload a wordlist file first.');
            return;
        }

        this.isRunning = true;
        this.startTime = Date.now();
        this.totalAttempts = 0;
        this.attemptHistory = [];
        this.workerErrors = [];
        this.exhaustedWorkers = new Set();

        // Update UI
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('simulation').style.display = 'block';
        document.getElementById('result').style.display = 'none';
        document.getElementById('simulation').classList.add('running');

        // Create workers
        const workerCount = parseInt(document.getElementById('workerCount').value);
        const speedLimit = parseInt(document.getElementById('speedLimit').value);
        const maxAttempts = parseInt(document.getElementById('maxAttempts').value);
        const scheme = SCHEMES[this.selectedScheme];

        this.workers = [];
        this.blobUrls = [];
        
        for (let i = 0; i < workerCount; i++) {
            const workerCode = this.createWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            this.blobUrls.push(blobUrl);
            const worker = new Worker(blobUrl);
            
            worker.onmessage = (e) => this.handleWorkerMessage(e, i);
            worker.onerror = (e) => this.handleWorkerError(e, i);
            
            this.workers.push(worker);
            
            const msg = {
                type: 'start',
                schemeKey: this.selectedScheme,
                target: this.targetValue,
                batchSize: speedLimit,
                workerId: i,
                attackMethod: attackMethod,
                workerCount: workerCount
            };

            // For wordlist mode, partition lines across workers
            if (attackMethod === 'wordlist') {
                const chunkSize = Math.ceil(this.wordlistData.length / workerCount);
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, this.wordlistData.length);
                msg.wordlistChunk = this.wordlistData.slice(start, end);
            }

            worker.postMessage(msg);
        }

        // Update UI periodically
        this.updateInterval = setInterval(() => this.updateUI(), 100);
        
        // Check max attempts
        if (maxAttempts > 0) {
            this.maxAttemptsCheck = setInterval(() => {
                if (this.totalAttempts >= maxAttempts) {
                    this.showResult(false);
                }
            }, 1000);
        }
    }

    handleWorkerError(e, workerId) {
        console.error('Worker error:', e);
        this.workerErrors.push({ workerId, error: e.message || 'Unknown error' });
        
        // Update UI to show worker error
        const activeWorkersEl = document.getElementById('activeWorkers');
        const activeCount = this.workers.length - this.workerErrors.length;
        activeWorkersEl.textContent = `${activeCount} (${this.workerErrors.length} failed)`;
        activeWorkersEl.style.color = this.workerErrors.length > 0 ? '#ef4444' : '';
    }

    createWorkerCode() {
        // Include scheme generators directly in the worker code to avoid CSP 'unsafe-eval' issues
        // Each generator is defined as a static function that can be looked up by key
        return `
            let running = false;
            let generateFn = null;
            let target = null;
            let workerId = 0;
            let batchSize = 10000;

            // IMPORTANT: This GENERATORS map must be kept in sync with SCHEMES in schemes.js
            // When adding a new scheme to SCHEMES, you MUST also add its generator function here.
            // Failure to do so will cause workers to report an error when selecting that scheme.
            const GENERATORS = {
                uuid_v4: function() {
                    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                        return crypto.randomUUID();
                    }
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const bytes = new Uint8Array(16);
                        crypto.getRandomValues(bytes);
                        bytes[6] = (bytes[6] & 0x0f) | 0x40;
                        bytes[8] = (bytes[8] & 0x3f) | 0x80;
                        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
                        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
                    }
                    throw new Error('Secure random UUID v4 generation is not supported in this environment.');
                },

                uuid_v1: function() {
                    const now = BigInt(Date.now());
                    const uuid100ns = (now * 10000n) + 122192928000000000n;
                    const timeLow = (uuid100ns & 0xffffffffn).toString(16).padStart(8, '0');
                    const timeMid = ((uuid100ns >> 32n) & 0xffffn).toString(16).padStart(4, '0');
                    const timeHi = (((uuid100ns >> 48n) & 0x0fffn) | 0x1000n).toString(16).padStart(4, '0');
                    let clockSeqRand;
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const arr = new Uint16Array(1);
                        crypto.getRandomValues(arr);
                        clockSeqRand = arr[0] & 0x3fff;
                    } else {
                        clockSeqRand = Math.floor(Math.random() * 0x3fff);
                    }
                    const clockSeq = ((clockSeqRand) | 0x8000).toString(16).padStart(4, '0');
                    let nodeBytes;
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        nodeBytes = new Uint8Array(6);
                        crypto.getRandomValues(nodeBytes);
                    } else {
                        nodeBytes = Array.from({length: 6}, () => Math.floor(Math.random() * 256));
                    }
                    const node = Array.from(nodeBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                    return timeLow + '-' + timeMid + '-' + timeHi + '-' + clockSeq + '-' + node;
                },

                uuid_v7: function() {
                    const now = Date.now();
                    const hex = now.toString(16).padStart(12, '0');
                    const timePart = hex.slice(0, 8) + '-' + hex.slice(8, 12);
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
                    return timePart + '-' + randA + '-' + randB + '-' + randC;
                },

                ipv6: function() {
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
                },

                ipv4: function() {
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const bytes = new Uint8Array(4);
                        crypto.getRandomValues(bytes);
                        return Array.from(bytes).join('.');
                    }
                    return Array.from({length: 4}, () => Math.floor(Math.random() * 256)).join('.');
                },

                mac_address: function() {
                    let bytes;
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        bytes = new Uint8Array(6);
                        crypto.getRandomValues(bytes);
                        bytes = Array.from(bytes);
                    } else {
                        bytes = Array.from({length: 6}, () => Math.floor(Math.random() * 256));
                    }
                    bytes[0] = (bytes[0] | 0x02) & 0xfe;
                    return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
                },

                bitcoin_address: function() {
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
                },

                ethereum_address: function() {
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
                },

                credit_card: function() {
                    let digits = [4];
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
                    return numStr.slice(0,4) + ' ' + numStr.slice(4,8) + ' ' + numStr.slice(8,12) + ' ' + numStr.slice(12,16);
                },

                iban: function() {
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
                },

                imei: function() {
                    let tac, serial;
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const bytes = new Uint8Array(7);
                        crypto.getRandomValues(bytes);
                        const tacNum = 35000000 + (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 5000000;
                        tac = String(tacNum).slice(0, 8);
                        serial = Array.from(bytes.slice(3)).map(b => b % 10).join('').padStart(6, '0');
                    } else {
                        tac = String(35000000 + Math.floor(Math.random() * 5000000)).slice(0, 8);
                        serial = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
                    }
                    const digits = (tac + serial).split('').map(Number);
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
                    return imei.slice(0,2) + '-' + imei.slice(2,8) + '-' + imei.slice(8,14) + '-' + imei.slice(14);
                },

                vin: function() {
                    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
                    const transliteration = {
                        A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
                        J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
                        S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
                        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
                        '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
                    };
                    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
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
                    let sum = 0;
                    for (let i = 0; i < 17; i++) {
                        const ch = vinChars[i];
                        const value = transliteration[ch] !== undefined ? transliteration[ch] : 0;
                        sum += value * weights[i];
                    }
                    const remainder = sum % 11;
                    vinChars[8] = remainder === 10 ? 'X' : String(remainder);
                    return vinChars.join('');
                },

                isbn13: function() {
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
                    let sum = 0;
                    for (let i = 0; i < 12; i++) {
                        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
                    }
                    const check = (10 - (sum % 10)) % 10;
                    const isbn = prefix + group + publisher + title + check;
                    return isbn.slice(0,3) + '-' + isbn.slice(3,4) + '-' + isbn.slice(4,9) + '-' + isbn.slice(9,12) + '-' + isbn.slice(12);
                },

                phone_e164: function() {
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
                    return '+' + country + ' ' + number.slice(0,3) + ' ' + number.slice(3,6) + ' ' + number.slice(6);
                },

                hex_color: function() {
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const bytes = new Uint8Array(3);
                        crypto.getRandomValues(bytes);
                        return '#' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                    }
                    const color = Math.floor(Math.random() * 0xffffff);
                    return '#' + color.toString(16).padStart(6, '0').toUpperCase();
                },

                base64_token: function() {
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
                },

                api_key: function() {
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
                },

                session_id: function() {
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
                },

                otp_6: function() {
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const bytes = new Uint8Array(3);
                        crypto.getRandomValues(bytes);
                        const num = (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 1000000;
                        return String(num).padStart(6, '0');
                    }
                    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
                },

                nanoid: function() {
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
            };

            // Sequential enumerators: convert an integer index to a formatted value.
            // Only defined for schemes where exhaustive enumeration is practical.
            const ENUMERATORS = {
                hex_color: {
                    totalCount: function() { return Math.pow(2, 24); },
                    fromIndex: function(i) {
                        return '#' + i.toString(16).padStart(6, '0').toUpperCase();
                    }
                },
                otp_6: {
                    totalCount: function() { return 1000000; },
                    fromIndex: function(i) {
                        return String(i).padStart(6, '0');
                    }
                },
                ipv4: {
                    totalCount: function() { return Math.pow(2, 32); },
                    fromIndex: function(i) {
                        return ((i >>> 24) & 255) + '.' + ((i >>> 16) & 255) + '.' + ((i >>> 8) & 255) + '.' + (i & 255);
                    }
                }
            };

            self.onmessage = function(e) {
                // Validate message structure
                if (!e || !e.data || typeof e.data !== 'object') {
                    console.error('Invalid message received');
                    return;
                }
                
                const data = e.data;
                const type = data.type;
                
                if (type === 'start') {
                    // Validate required properties for start message
                    if (!data.schemeKey || typeof data.target !== 'string') {
                        console.error('Invalid start message: missing required properties');
                        return;
                    }
                    
                    running = true;
                    target = data.target;
                    workerId = data.workerId || 0;
                    batchSize = data.batchSize || 10000;
                    
                    const attackMethod = data.attackMethod || 'random';

                    if (attackMethod === 'wordlist') {
                        // Wordlist mode: iterate over provided chunk
                        const chunk = data.wordlistChunk || [];
                        runWordlistBatch(chunk);
                    } else if (attackMethod === 'sequential') {
                        // Sequential mode: enumerate the search space with no duplicates
                        const enumerator = ENUMERATORS[data.schemeKey];
                        if (!enumerator) {
                            self.postMessage({
                                type: 'error',
                                error: 'Sequential mode is not supported for scheme: ' + data.schemeKey + '. Use Random mode instead.',
                                workerId: workerId
                            });
                            running = false;
                            self.postMessage({
                                type: 'exhausted',
                                workerId: workerId
                            });
                            return;
                        }
                        const totalSpace = enumerator.totalCount();
                        const workerCount = data.workerCount || 1;
                        const perWorker = Math.ceil(totalSpace / workerCount);
                        const startIdx = workerId * perWorker;
                        const endIdx = Math.min(startIdx + perWorker, totalSpace);
                        runSequentialBatch(enumerator, startIdx, endIdx);
                    } else {
                        // Random mode
                        generateFn = GENERATORS[data.schemeKey];
                        if (!generateFn) {
                            self.postMessage({
                                type: 'error',
                                error: 'Unknown scheme key: ' + data.schemeKey + '. Make sure the scheme is defined in both SCHEMES (schemes.js) and GENERATORS (app.js createWorkerCode).',
                                workerId: workerId
                            });
                            return;
                        }
                        runBatch();
                    }
                } else if (type === 'stop') {
                    running = false;
                }
            };

            function runBatch() {
                if (!running) return;
                
                let lastAttempt = null;
                
                for (let i = 0; i < batchSize; i++) {
                    const attempt = generateFn();
                    lastAttempt = attempt;
                    
                    if (attempt === target) {
                        self.postMessage({
                            type: 'match',
                            value: attempt,
                            workerId: workerId
                        });
                        running = false;
                        return;
                    }
                }
                
                self.postMessage({
                    type: 'progress',
                    attempts: batchSize,
                    lastAttempt: lastAttempt,
                    workerId: workerId
                });
                
                // Continue with next batch using requestIdleCallback if available
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(runBatch);
                } else {
                    setTimeout(runBatch, 0);
                }
            }

            function runSequentialBatch(enumerator, startIdx, endIdx) {
                if (!running || startIdx >= endIdx) {
                    if (running) {
                        self.postMessage({
                            type: 'exhausted',
                            workerId: workerId
                        });
                        running = false;
                    }
                    return;
                }

                let lastAttempt = null;
                const batchEnd = Math.min(startIdx + batchSize, endIdx);
                const count = batchEnd - startIdx;

                for (let i = startIdx; i < batchEnd; i++) {
                    const attempt = enumerator.fromIndex(i);
                    lastAttempt = attempt;

                    if (attempt === target) {
                        self.postMessage({
                            type: 'match',
                            value: attempt,
                            workerId: workerId
                        });
                        running = false;
                        return;
                    }
                }

                self.postMessage({
                    type: 'progress',
                    attempts: count,
                    lastAttempt: lastAttempt,
                    workerId: workerId
                });

                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(function() { runSequentialBatch(enumerator, batchEnd, endIdx); });
                } else {
                    setTimeout(function() { runSequentialBatch(enumerator, batchEnd, endIdx); }, 0);
                }
            }

            function runWordlistBatch(words, offset) {
                offset = offset || 0;
                if (!running || offset >= words.length) {
                    if (running) {
                        self.postMessage({
                            type: 'exhausted',
                            workerId: workerId
                        });
                        running = false;
                    }
                    return;
                }

                let lastAttempt = null;
                const batchEnd = Math.min(offset + batchSize, words.length);
                const count = batchEnd - offset;

                for (let i = offset; i < batchEnd; i++) {
                    const attempt = words[i];
                    lastAttempt = attempt;

                    if (attempt === target) {
                        self.postMessage({
                            type: 'match',
                            value: attempt,
                            workerId: workerId
                        });
                        running = false;
                        return;
                    }
                }

                self.postMessage({
                    type: 'progress',
                    attempts: count,
                    lastAttempt: lastAttempt,
                    workerId: workerId
                });

                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(function() { runWordlistBatch(words, batchEnd); });
                } else {
                    setTimeout(function() { runWordlistBatch(words, batchEnd); }, 0);
                }
            }
        `;
    }

    handleWorkerMessage(e, workerId) {
        // Validate message structure
        const data = e && e.data;
        if (!data || typeof data !== 'object') {
            console.error('Received invalid message from worker', { workerId, event: e });
            return;
        }

        const { type, attempts, lastAttempt, value, error, workerId: msgWorkerId } = data;
        // Use workerId from message data if available, otherwise use the parameter
        const effectiveWorkerId = msgWorkerId !== undefined ? msgWorkerId : workerId;
        
        if (type === 'progress') {
            this.totalAttempts += attempts;
            
            // Store last attempts for display
            this.attemptHistory.unshift({
                value: lastAttempt,
                workerId: effectiveWorkerId
            });
            
            // Keep only last 10 attempts
            if (this.attemptHistory.length > 10) {
                this.attemptHistory.pop();
            }
        } else if (type === 'match') {
            this.showResult(true, value);
        } else if (type === 'error') {
            // Handle explicit error messages from workers (e.g., unknown scheme key)
            console.error('Worker error:', error);
            this.workerErrors.push({ workerId: effectiveWorkerId, error: error || 'Unknown error' });
            
            // Update UI to show worker error
            const activeWorkersEl = document.getElementById('activeWorkers');
            const activeCount = this.workers.length - this.workerErrors.length;
            activeWorkersEl.textContent = `${activeCount} (${this.workerErrors.length} failed)`;
            activeWorkersEl.style.color = this.workerErrors.length > 0 ? '#ef4444' : '';
            // If all workers have failed, stop the simulation
            if (this.workers.length > 0 && this.workerErrors.length >= this.workers.length) {
                this.showResult(false);
            }
        } else if (type === 'exhausted') {
            // Worker finished its partition without finding a match
            this.exhaustedWorkers.add(effectiveWorkerId);
            // If all workers are exhausted or have failed, show failure
            const totalCompletedWorkers = this.exhaustedWorkers.size + this.workerErrors.length;
            if (this.workers.length > 0 && totalCompletedWorkers >= this.workers.length) {
                this.showResult(false, null, 'exhausted');
            }
        } else {
            console.warn('Received unknown message type from worker', { workerId: effectiveWorkerId, type, data });
        }
    }

    updateUI() {
        if (!this.isRunning) return;

        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = this.totalAttempts / elapsed;
        const maxAttempts = parseInt(document.getElementById('maxAttempts').value);
        
        // Update stats
        document.getElementById('totalAttempts').textContent = this.totalAttempts.toLocaleString();
        document.getElementById('ratePerSecond').textContent = Math.round(rate).toLocaleString();
        document.getElementById('elapsedTime').textContent = this.formatElapsedTime(elapsed);
        
        // Show active workers count, accounting for errors
        const activeCount = this.workers.length - this.workerErrors.length;
        const activeWorkersEl = document.getElementById('activeWorkers');
        if (this.workerErrors.length > 0) {
            activeWorkersEl.textContent = `${activeCount} (${this.workerErrors.length} failed)`;
            activeWorkersEl.style.color = '#ef4444';
        } else {
            activeWorkersEl.textContent = this.workers.length;
            activeWorkersEl.style.color = '';
        }

        // Update progress bar
        if (maxAttempts > 0) {
            const progress = Math.min(100, (this.totalAttempts / maxAttempts) * 100);
            document.getElementById('progressFill').style.width = progress + '%';
            document.getElementById('progressText').textContent = progress.toFixed(2) + '%';
        } else {
            // For unlimited, show progress relative to theoretical space (will be tiny)
            const scheme = SCHEMES[this.selectedScheme];
            const combinations = Math.pow(2, scheme.bits);
            // Handle Infinity case for very large bit values
            let progress;
            if (!Number.isFinite(combinations) || combinations <= 0) {
                progress = 0;
            } else {
                progress = Math.min(100, (this.totalAttempts / combinations) * 100);
            }
            // Ensure progress is a finite number
            if (!Number.isFinite(progress) || progress < 0) {
                progress = 0;
            }
            document.getElementById('progressFill').style.width = Math.max(0.1, progress) + '%';
            document.getElementById('progressText').textContent = progress < 0.01 ? '<0.01%' : progress.toFixed(6) + '%';
        }

        // Update attempts list
        const attemptsList = document.getElementById('attemptsList');
        attemptsList.innerHTML = this.attemptHistory.map(item => `
            <div class="attempt-item">
                <span class="attempt-value">${this.escapeHtml(item.value)}</span>
                <span class="worker-id">W${item.workerId}</span>
            </div>
        `).join('');
    }

    formatElapsedTime(seconds) {
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    stopSimulation() {
        this.isRunning = false;
        
        // Stop all workers
        this.workers.forEach(worker => {
            worker.postMessage({ type: 'stop' });
            worker.terminate();
        });
        this.workers = [];
        
        // Revoke blob URLs to prevent memory leaks
        this.blobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // Ignore errors during cleanup
            }
        });
        this.blobUrls = [];
        
        // Clear intervals and set to null
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.maxAttemptsCheck) {
            clearInterval(this.maxAttemptsCheck);
            this.maxAttemptsCheck = null;
        }
        
        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('simulation').classList.remove('running');
        
        // Reset worker error styling
        const activeWorkersEl = document.getElementById('activeWorkers');
        activeWorkersEl.style.color = '';
    }

    showResult(found, matchValue = null, reason = 'maxAttempts') {
        this.stopSimulation();
        
        const result = document.getElementById('result');
        const resultContent = document.getElementById('resultContent');
        
        result.style.display = 'block';
        
        if (found) {
            result.className = 'result success';
            resultContent.innerHTML = `
                <h3>🎉 Match Found!</h3>
                <p>Successfully brute-forced the target value!</p>
                <div class="match-value">${this.escapeHtml(matchValue)}</div>
                <p>Total attempts: <strong>${this.totalAttempts.toLocaleString()}</strong></p>
                <p>Time taken: <strong>${this.formatElapsedTime((Date.now() - this.startTime) / 1000)}</strong></p>
            `;
        } else {
            result.className = 'result failure';
            const scheme = SCHEMES[this.selectedScheme];
            const searchedPercent = (this.totalAttempts / Math.pow(2, scheme.bits)) * 100;
            const message = reason === 'exhausted'
                ? 'All workers exhausted their search space without finding a match.'
                : 'Maximum attempts reached without finding a match.';
            resultContent.innerHTML = `
                <h3>⏹️ Simulation Stopped</h3>
                <p>${message}</p>
                <p>Total attempts: <strong>${this.totalAttempts.toLocaleString()}</strong></p>
                <p>Search space covered: <strong>${searchedPercent < 0.000001 ? '<0.000001%' : searchedPercent.toFixed(6) + '%'}</strong></p>
                <p>This demonstrates the security of ${scheme.bits}-bit randomness!</p>
            `;
        }
    }

    reset() {
        this.stopSimulation();
        this.targetValue = null;
        this.totalAttempts = 0;
        this.attemptHistory = [];
        this.exhaustedWorkers = new Set();
        
        document.getElementById('targetValue').textContent = 'Click "Generate Target" to start';
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('simulation').style.display = 'none';
        document.getElementById('result').style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '0%';
        document.getElementById('totalAttempts').textContent = '0';
        document.getElementById('ratePerSecond').textContent = '0';
        document.getElementById('elapsedTime').textContent = '0s';
        document.getElementById('activeWorkers').textContent = '0';
        document.getElementById('attemptsList').innerHTML = '';
        
        this.updateEstimation();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new RandomVisualizer();
});
