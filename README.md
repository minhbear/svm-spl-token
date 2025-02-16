# 🚀 Guide: Create and Mint SPL Token

## 1️⃣ Prerequisites

### 1. Upload Metadata and Get URI
1. Navigate to `spl-token/metadata.json` and update the token details:
   - **Name**: Token name
   - **Symbol**: Token symbol
   - **Description**: Short description of the token
   - **Image URL**: Link to token logo
   - **Attributes**: Additional metadata fields (if needed)
2. Upload the `metadata.json` file to a storage service like **IPFS**.
3. Retrieve the **URI** for the uploaded metadata file.

### 2. Set Up Environment Variables
Create a `.env` file and define the following variables:
```env
WALLET_OWNER_SPL_TOKEN=your_wallet_address  # Wallet with minting authority
WALLET_RECEIVE_SPL_TOKEN=recipient_wallet_address  # Wallet to receive total supply
RPC_URL=your_rpc_url  # Blockchain RPC URL for transactions
```

## 2️⃣ Create and Mint SPL Token

### 1. Update Token Information
Modify the script `spl-token/create-spl-token.ts` with the following details:
```typescript
const TOKEN_NAME = "Your Token Name";
const TOKEN_SYMBOL = "YTN";
const METADATA_URI = "https://your-metadata-uri.com/metadata.json";
const DECIMALS = 6; // Adjust as needed
const TOTAL_SUPPLY = 1_000_000_000; // Adjust as needed
```

### 2. Run the Script
Execute the command:
```sh
yarn create-spl-token-and-mint
```

This will:
1. Create the SPL token with the specified parameters.
2. Mint the total supply to `WALLET_RECEIVE_SPL_TOKEN`.
3. Store metadata on-chain.

## ✅ Done!
Your SPL token is now created and minted successfully. 🎉
