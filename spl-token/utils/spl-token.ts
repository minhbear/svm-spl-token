import {
  Account,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccount,
  getAccountLenForMint,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  TokenInvalidMintError,
  TokenInvalidOwnerError,
} from "@solana/spl-token";
import {
  Commitment,
  ComputeBudgetProgram,
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import { PRIORITY_FEE_MICRO_LAMPORT } from "../constant";

export async function createMintWithPriorityFee(
  connection: Connection,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  priorityFeeMicroLamport = PRIORITY_FEE_MICRO_LAMPORT
): Promise<PublicKey> {
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeMicroLamport,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId,
    }),
    createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    )
  );

  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, keypair],
    confirmOptions
  );

  return keypair.publicKey;
}

export async function createAccountWithPriorityFee(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  keypair?: Keypair,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  priorityFeeMicroLamport = PRIORITY_FEE_MICRO_LAMPORT
): Promise<PublicKey> {
  // If a keypair isn't provided, create the associated token account and return its address
  if (!keypair)
    return await createAssociatedTokenAccount(
      connection,
      payer,
      mint,
      owner,
      confirmOptions,
      programId
    );

  // Otherwise, create the account with the provided keypair and return its public key
  const mintState = await getMint(
    connection,
    mint,
    confirmOptions?.commitment,
    programId
  );
  const space = getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeMicroLamport,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space,
      lamports,
      programId,
    }),
    createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      owner,
      programId
    )
  );

  await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, keypair],
    confirmOptions
  );

  return keypair.publicKey;
}

export async function getOrCreateAssociatedTokenAccountWithPriorityFee(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  commitment?: Commitment,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
  priorityFeeMicroLamport = PRIORITY_FEE_MICRO_LAMPORT
): Promise<Account> {
  const associatedToken = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    programId,
    associatedTokenProgramId
  );

  let account: Account;
  try {
    account = await getAccount(
      connection,
      associatedToken,
      commitment,
      programId
    );
  } catch (error: unknown) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      try {
        const transaction = new Transaction();

        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFeeMicroLamport,
          })
        );

        transaction.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedToken,
            owner,
            mint,
            programId,
            associatedTokenProgramId
          )
        );
        await sendAndConfirmTransaction(
          connection,
          transaction,
          [payer],
          confirmOptions
        );
      } catch (error: unknown) {}

      account = await getAccount(
        connection,
        associatedToken,
        commitment,
        programId
      );
    } else {
      throw error;
    }
  }

  if (!account.mint.equals(mint)) throw new TokenInvalidMintError();
  if (!account.owner.equals(owner)) throw new TokenInvalidOwnerError();

  return account;
}

export async function mintToWithPriorityFee(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  priorityFeeMicroLamport = PRIORITY_FEE_MICRO_LAMPORT
): Promise<TransactionSignature> {
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeMicroLamport,
    }),
    createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId
    )
  );

  return await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, ...signers],
    confirmOptions
  );
}

function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}
