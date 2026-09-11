# QazLedger AI — 1C Integration

Integration module for 1C:Accounting for Kazakhstan.

## Current capabilities

- Import Kaspi Bank statement
- AI transaction analysis
- Transaction classification
- Confidence score and explanation
- Manual confirmation before document creation
- Creation of unposted 1C accounting drafts
- Duplicate protection
- Internal transfer detection between own bank accounts
- Kaspi Pay fee detection
- Kaspi Bank fee detection
- Sales receipt detection
- Accountable-person payment detection

## Safety

QazLedger AI does not automatically post accounting documents.

Workflow:

Bank statement → AI analysis → Accountant review → Selected rows → Unposted 1C drafts → Manual verification → Posting by accountant

## Current version

1C integration: v1.5.0

Backend: Node.js / Express / OpenAI API

Deployment: Railway
