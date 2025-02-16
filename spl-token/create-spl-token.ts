import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import * as dotenv from "dotenv";
import {
  createMintWithPriorityFee,
  getOrCreateAssociatedTokenAccountWithPriorityFee,
  mintToWithPriorityFee,
} from "./utils/spl-token";
import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { none, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { PRIORITY_FEE_MICRO_LAMPORT } from "./constant";
import bs58 from "bs58";

dotenv.config();

if (
  process.env.WALLET_OWNER_SPL_TOKEN === undefined ||
  process.env.WALLET_OWNER_SPL_TOKEN === "" ||
  process.env.WALLET_OWNER_SPL_TOKEN === null
) {
  throw new Error("Missing WALLET_OWNER_SPL_TOKEN");
}

if (
  process.env.WALLET_RECEIVE_SPL_TOKEN === undefined ||
  process.env.WALLET_RECEIVE_SPL_TOKEN === "" ||
  process.env.WALLET_RECEIVE_SPL_TOKEN === null
) {
  throw new Error("Missing WALLET_OWNER_SPL_TOKEN");
}

const ownerSPLTokenWallet = Keypair.fromSecretKey(
  Uint8Array.from(bs58.decode(process.env.WALLET_OWNER_SPL_TOKEN))
);

const receiveSPLTokenWallet = Keypair.fromSecretKey(
  Uint8Array.from(bs58.decode(process.env.WALLET_RECEIVE_SPL_TOKEN))
);

if (
  process.env.RPC_URL === undefined ||
  process.env.RPC_URL === "" ||
  process.env.RPC_URL === null
) {
  throw new Error("Missing RPC_URL");
}

const rpcUrl = process.env.RPC_URL;
const connection = new Connection(rpcUrl);

const execute = async (payload: {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  totalSupply: number;
}): Promise<void> => {
  const { name, symbol, uri, decimals } = payload;

  const tokenMintKeypair = Keypair.generate();

  const tokenMint = await createMintWithPriorityFee(
    connection,
    ownerSPLTokenWallet,
    ownerSPLTokenWallet.publicKey,
    null,
    decimals,
    tokenMintKeypair,
    {
      commitment: "finalized",
    }
  );
  console.log(
    `🚀 ~ Create token ${name} mint: ${tokenMintKeypair.publicKey.toBase58()}`
  );

  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  umi.use(keypairIdentity(ownerSPLTokenWallet as any));

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: PRIORITY_FEE_MICRO_LAMPORT,
    })
  );

  const createMetadataAccountV3Ix = createMetadataAccountV3(umi, {
    mint: tokenMint as any,
    mintAuthority: ownerSPLTokenWallet as any,
    isMutable: true,
    collectionDetails: none(),
    data: {
      name,
      uri,
      symbol,
      sellerFeeBasisPoints: 0,
      creators: none(),
      collection: none(),
      uses: none(),
    },
  }).getInstructions()[0];
  const web3jsinstruction = toWeb3JsInstruction(createMetadataAccountV3Ix);

  tx.add(web3jsinstruction);

  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerSPLTokenWallet.publicKey;

  await sendAndConfirmTransaction(connection, tx, [
    tokenMintKeypair,
    ownerSPLTokenWallet,
  ]);

  console.log(`🚀 Successfully created token metadata`);

  const associatedTokenAccountOfWalletReceive =
    await getOrCreateAssociatedTokenAccountWithPriorityFee(
      connection,
      ownerSPLTokenWallet,
      tokenMint,
      receiveSPLTokenWallet.publicKey,
      false,
      "finalized"
    );

  const totalSupply = payload.totalSupply * 10 ** decimals;

  const txHash = await mintToWithPriorityFee(
    connection,
    ownerSPLTokenWallet,
    tokenMint,
    associatedTokenAccountOfWalletReceive.address,
    ownerSPLTokenWallet,
    totalSupply,
    [],
    {
      commitment: "finalized",
    }
  );
  console.log(
    `🚀 Success mint ${
      payload.totalSupply
    } token ${name} to wallet: ${receiveSPLTokenWallet.publicKey.toBase58()} ~ txHash: ${txHash}`
  );
};

execute({
  name: "myToken",
  symbol: "MT",
  uri: "https://arweave.net/7BzVsHRrEH0ldNOCCM4_E00BiAYuJP_EQiqvcEYz3YY",
  decimals: 6,
  totalSupply: 10_000_000_000,
});
