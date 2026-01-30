# random.daolyap.dev

🎲 **Random Number Visualizer** - An educational tool to understand modern randomness and its security through brute-force simulation.

## Overview

This site helps visualize how truly random modern number generation systems are by allowing users to:

1. **Select a random number scheme** from 20 different types used in modern technology
2. **Generate a target value** using that scheme
3. **Attempt to brute-force it** by running parallel simulations
4. **See the estimated time** it would take to crack various schemes

## Features

### 20 Random Number Schemes

| Category | Schemes |
|----------|---------|
| **Identifiers** | UUID v4, UUID v1 (time-based), UUID v7, NanoID |
| **Networking** | IPv6 Address, IPv4 Address, MAC Address |
| **Cryptocurrency** | Bitcoin Address, Ethereum Address |
| **Financial** | Credit Card Number, IBAN |
| **Hardware** | IMEI Number, VIN |
| **Publishing** | ISBN-13 |
| **Communication** | Phone Number (E.164) |
| **Visual** | Hex Color |
| **Security** | Base64 Token, API Key, Session ID |
| **Authentication** | OTP (6-digit) |

### Simulation Controls

- **Parallel Workers**: 1-16 concurrent Web Workers
- **Generations per Batch**: 100 - 100,000 per worker
- **Max Attempts**: From 1 million to 1 trillion, or unlimited

### Real-time Statistics

- Total attempts made
- Rate per second
- Elapsed time
- Active workers
- Live attempt preview
- Progress percentage

## Technical Details

- **Pure client-side**: All simulations run locally in your browser using Web Workers
- **No server required**: Static site hosted on Cloudflare Pages
- **No dependencies**: Vanilla JavaScript, HTML, and CSS
- **Privacy-focused**: No data leaves your browser

## Deployment

This site is designed to be deployed on Cloudflare Pages:

1. Connect the repository to Cloudflare Pages
2. Set build command: (none required - static files)
3. Set output directory: `/`
4. Deploy!

## Educational Purpose

This tool demonstrates:

- Why higher bit entropy = more security
- Why brute-forcing modern random IDs is practically impossible
- The difference between "old" (IPv4) and "new" (UUID v4, IPv6) approaches
- How checksum algorithms (Luhn) work in credit cards and IMEIs

## License

MIT
