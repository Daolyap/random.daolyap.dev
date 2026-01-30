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
    }

    updateControlDisplays() {
        document.getElementById('workerCountDisplay').textContent = document.getElementById('workerCount').value;
        document.getElementById('speedLimitDisplay').textContent = parseInt(document.getElementById('speedLimit').value).toLocaleString();
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

        this.isRunning = true;
        this.startTime = Date.now();
        this.totalAttempts = 0;
        this.attemptHistory = [];
        this.workerErrors = [];

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
            
            // Start worker
            worker.postMessage({
                type: 'start',
                schemeKey: this.selectedScheme,
                scheme: {
                    generate: SCHEMES[this.selectedScheme].generate.toString()
                },
                target: this.targetValue,
                batchSize: speedLimit,
                workerId: i
            });
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
        return `
            let running = false;
            let generateFn = null;
            let target = null;
            let workerId = 0;
            let batchSize = 10000;

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
                    if (!data.scheme || !data.scheme.generate || typeof data.target !== 'string') {
                        console.error('Invalid start message: missing required properties');
                        return;
                    }
                    
                    running = true;
                    target = data.target;
                    workerId = data.workerId || 0;
                    batchSize = data.batchSize || 10000;
                    
                    // Reconstruct the generate function
                    try {
                        generateFn = new Function('return (' + data.scheme.generate + ')')();
                    } catch (err) {
                        console.error('Failed to create generate function:', err);
                        return;
                    }
                    
                    runBatch();
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
        `;
    }

    handleWorkerMessage(e, workerId) {
        // Validate message structure
        const data = e && e.data;
        if (!data || typeof data !== 'object') {
            console.error('Received invalid message from worker', { workerId, event: e });
            return;
        }

        const { type, attempts, lastAttempt, value } = data;
        
        if (type === 'progress') {
            this.totalAttempts += attempts;
            
            // Store last attempts for display
            this.attemptHistory.unshift({
                value: lastAttempt,
                workerId: workerId
            });
            
            // Keep only last 10 attempts
            if (this.attemptHistory.length > 10) {
                this.attemptHistory.pop();
            }
        } else if (type === 'match') {
            this.showResult(true, value);
        } else {
            console.warn('Received unknown message type from worker', { workerId, type, data });
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
                <span class="attempt-value">${item.value}</span>
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

    showResult(found, matchValue = null) {
        this.stopSimulation();
        
        const result = document.getElementById('result');
        const resultContent = document.getElementById('resultContent');
        
        result.style.display = 'block';
        
        if (found) {
            result.className = 'result success';
            resultContent.innerHTML = `
                <h3>🎉 Match Found!</h3>
                <p>Successfully brute-forced the target value!</p>
                <div class="match-value">${matchValue}</div>
                <p>Total attempts: <strong>${this.totalAttempts.toLocaleString()}</strong></p>
                <p>Time taken: <strong>${this.formatElapsedTime((Date.now() - this.startTime) / 1000)}</strong></p>
            `;
        } else {
            result.className = 'result failure';
            const scheme = SCHEMES[this.selectedScheme];
            const searchedPercent = (this.totalAttempts / Math.pow(2, scheme.bits)) * 100;
            resultContent.innerHTML = `
                <h3>⏹️ Simulation Stopped</h3>
                <p>Maximum attempts reached without finding a match.</p>
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
