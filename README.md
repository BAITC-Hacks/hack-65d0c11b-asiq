# QazLedger AI

AI accounting agent for Kazakhstan businesses.

QazLedger AI analyzes bank statement transactions, classifies accounting operations and prepares unposted draft documents in 1C for accountant review.

## Problem

Accountants spend significant time manually processing bank statements:

- identifying counterparties;
- understanding payment purposes;
- classifying transactions;
- checking internal transfers;
- entering data into 1C;
- avoiding duplicate documents.

This process is repetitive and error-prone.

## Solution

QazLedger AI combines AI analysis with deterministic accounting rules and 1C integration.

The system can:

- import Kaspi Bank statements;
- analyze transaction direction and payment purpose;
- identify counterparties;
- classify accounting operations;
- detect internal transfers between own bank accounts;
- detect Kaspi Pay fees;
- detect Kaspi Bank fees;
- detect sales receipts;
- detect payments to accountable persons;
- return confidence score and explanation;
- allow the accountant to select which transactions should be created;
- create unposted draft documents in 1C;
- prevent duplicate document creation;
- never post accounting documents automatically.

## Workflow

Bank Statement  
↓  
1C Statement Import  
↓  
QazLedger AI Analysis  
↓  
Transaction Classification  
↓  
Accountant Review  
↓  
Selected Transactions  
↓  
Unposted 1C Draft Documents  
↓  
Manual Verification  
↓  
Posting by Accountant

## Human-in-the-loop

QazLedger AI is designed as a human-in-the-loop accounting assistant.

AI does not directly post accounting documents.

The accountant can review:

- transaction date;
- amount;
- counterparty;
- AI decision;
- AI rule;
- confidence score;
- status;
- explanation.

Only transactions explicitly selected by the accountant are sent to the 1C document creation layer.

## Architecture

### Backend

- Node.js
- Express
- OpenAI API
- Railway

The backend receives structured bank transaction data and returns a normalized accounting decision.

### 1C Integration

Integration is implemented for:

**1C:Accounting for Kazakhstan, edition 3.0**

The 1C module:

- imports the bank statement;
- sends transactions for AI analysis;
- displays AI results;
- allows manual approval;
- creates unposted accounting drafts;
- searches existing documents;
- protects against duplicate creation;
- resolves own-bank-account transfers.

## Example classifications

QazLedger AI currently supports rules such as:

- `SALE`
- `INTERNAL_TRANSFER`
- `ACCOUNTABLE_PERSON`
- `KASPI_PAY_FEE`
- `KASPI_BANK_FEE`
- `SUPPLIER_PAYMENT`
- `REFUND`
- `TAX_PAYMENT`
- `PAYROLL`
- `MANUAL_REVIEW`

## Internal transfers

For transfers between the company's own bank accounts, QazLedger AI determines the transfer direction and creates only the required accounting document.

Example:

Alatau City Bank → Kaspi Bank

The system creates an unposted outgoing payment order with:

- source bank account;
- destination bank account;
- amount;
- KNP;
- transaction date.

Duplicate internal-transfer documents are not created.

## Safety

QazLedger AI follows a safe accounting workflow:

- no automatic posting;
- human confirmation before document creation;
- duplicate protection;
- confidence-based review;
- unposted drafts only;
- accountant remains in control.

## Current Status

Working prototype tested with Kaspi Bank statement transactions.

Current 1C integration version:

`v1.5.0`

Tested workflow:

`Kaspi Statement → AI Analysis → Human Approval → 1C Draft → Duplicate Check`

## Project Structure

```text
/
├── backend/
│   └── server.js
├── 1c/
│   ├── README.md
│   ├── ASIQ_Kaspi_1C_v1.5.0_OWN_TRANSFER_DIRECTION.txt
│   └── ASIQ_Kaspi_QazLedgerAI_CREATE_SELECTED_FULL.txt
├── .gitignore
└── README.md
