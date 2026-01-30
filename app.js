// Main application logic
class RandomVisualizer {
    constructor() {
        this.selectedScheme = null;
        this.targetValue = null;
        this.workers = [];
        this.isRunning = false;
        this.startTime = null;
        this.totalAttempts = 0;
        this.attemptHistory = [];
        
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
        const attemptsPerSecond = workerCount * speedPerWorker * 10; // ~10 batches per second
        const averageAttempts = combinations / 2;
        const estimatedSeconds = averageAttempts / attemptsPerSecond;

        let timeStr = this.formatTime(estimatedSeconds);
        let probabilityInfo = this.calculateProbability(scheme.bits, attemptsPerSecond);

        document.getElementById('estimationText').innerHTML = `
            <strong>Search space:</strong> 2^${scheme.bits} = ${this.formatCombinations(scheme.bits)} combinations<br>
            <strong>Expected rate:</strong> ~${attemptsPerSecond.toLocaleString()} attempts/second<br>
            <strong>Average time to find match:</strong> ${timeStr}<br>
            <strong>Probability after 1 hour:</strong> ${probabilityInfo.oneHour}<br>
            <strong>Probability after 1 year:</strong> ${probabilityInfo.oneYear}
        `;
    }

    calculateProbability(bits, attemptsPerSecond) {
        const combinations = Math.pow(2, bits);
        
        // Probability of finding match = 1 - (1 - 1/N)^attempts ≈ attempts/N for small probabilities
        const attemptsOneHour = attemptsPerSecond * 3600;
        const attemptsOneYear = attemptsPerSecond * 3600 * 24 * 365;
        
        const probOneHour = Math.min(1, attemptsOneHour / combinations);
        const probOneYear = Math.min(1, attemptsOneYear / combinations);
        
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
        
        for (let i = 0; i < workerCount; i++) {
            const workerCode = this.createWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            
            worker.onmessage = (e) => this.handleWorkerMessage(e, i);
            worker.onerror = (e) => console.error('Worker error:', e);
            
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

    createWorkerCode() {
        return `
            let running = false;
            let generateFn = null;
            let target = null;
            let workerId = 0;
            let batchSize = 10000;

            self.onmessage = function(e) {
                const { type, schemeKey, scheme, target: targetValue, batchSize: size, workerId: id } = e.data;
                
                if (type === 'start') {
                    running = true;
                    target = targetValue;
                    workerId = id;
                    batchSize = size;
                    
                    // Reconstruct the generate function
                    generateFn = new Function('return (' + scheme.generate + ')')();
                    
                    runBatch();
                } else if (type === 'stop') {
                    running = false;
                }
            };

            function runBatch() {
                if (!running) return;
                
                const startTime = performance.now();
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
                
                const elapsed = performance.now() - startTime;
                
                self.postMessage({
                    type: 'progress',
                    attempts: batchSize,
                    lastAttempt: lastAttempt,
                    workerId: workerId,
                    batchTime: elapsed
                });
                
                // Continue with next batch
                setTimeout(runBatch, 0);
            }
        `;
    }

    handleWorkerMessage(e, workerId) {
        const { type, attempts, lastAttempt, value, batchTime } = e.data;
        
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
        document.getElementById('activeWorkers').textContent = this.workers.length;

        // Update progress bar
        if (maxAttempts > 0) {
            const progress = Math.min(100, (this.totalAttempts / maxAttempts) * 100);
            document.getElementById('progressFill').style.width = progress + '%';
            document.getElementById('progressText').textContent = progress.toFixed(2) + '%';
        } else {
            // For unlimited, show progress relative to theoretical space (will be tiny)
            const scheme = SCHEMES[this.selectedScheme];
            const combinations = Math.pow(2, scheme.bits);
            const progress = Math.min(100, (this.totalAttempts / combinations) * 100);
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
        
        // Clear intervals
        if (this.updateInterval) clearInterval(this.updateInterval);
        if (this.maxAttemptsCheck) clearInterval(this.maxAttemptsCheck);
        
        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('simulation').classList.remove('running');
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
