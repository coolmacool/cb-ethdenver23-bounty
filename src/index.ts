import { ethers, Wallet } from "ethers";
import * as dotenv from "dotenv";
import Bounty from "../Bounty.json";

dotenv.config();

const contractAddress = "0xc1e40f9FD2bc36150e2711e92138381982988791";
const rpcUrl = "https://goerli.base.org";
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

async function main() {
  const signer = new ethers.Wallet(`${process.env.WALLET_PK}`, provider);

  /// The answers to the riddles are not really important since we can
  /// see what the valid answers our by inspecting transactions.

  await challenge1(signer)
    .then(() => challenge2(signer))
    .then(() => challenge3a(signer))
    .then(() => challenge3b(signer))
    .catch((err) => {
      console.error(
        `An error occurred while completing challenges. Details: ${JSON.stringify(
          err,
          null,
          2
        )}`
      );
    });
  console.log(`gas: ${Number(await provider.getGasPrice())}`);
}

const challenge1 = async (signer: Wallet) => {
  /// In the new world there's a curious thing,
  /// A tap that pours coins, like a magical spring
  /// A free-for-all place so vast,
  /// A resource that fills your wallet fast (cccccc)

  /// this riddle was super obvious
  const answer = "faucet";
  /// no need to hash or sign, just pass straight to the contract
  /// (or you can even use basescan.org)
  const data = generateFunctionData("solveChallenge1", [answer]);
  await submitTx(data, signer);
};

const challenge2 = async (signer: Wallet) => {
  /// Onward we journey, through sun and rain
  /// A path we follow, with hope not in vain
  /// Guided by the Beacon Chain, with unwavering aim
  /// Our destination approaches, where two become the same (Ccc Ccccc)

  /// again, a pretty obvious riddle answer
  const answer = "The Merge";

  /// this time the hash & sign the answer due to this:
  ///
  ///   require(
  ///       msg.sender == ECDSA.recover(ECDSA.toEthSignedMessageHash(messageHash), signature),
  ///       "invalid signature"
  ///   );
  ///
  /// the contract is using OpenZepplin ECDSA to sign and then recover the signer address using our signature
  /// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
  /// see `generateSignature` below for details.

  const signature = await generateSignature(answer, signer);
  const data = generateFunctionData("solveChallenge2", [
    answer, //  string calldata riddleAnswer
    ethers.utils.arrayify(signature), //  bytes calldata signature
  ]);
  await submitTx(data, signer);
};

const challenge3a = async (signer: Wallet) => {
  /// A proposal was formed, a new blob in the land,
  /// To help with the scale, and make things more grand
  /// A way to improve the network's high fees,
  /// And make transactions faster, with greater ease (CCC-NNNN)

  /// clearly an EIP-XXXX format, proto-danksharding, persistent blobs
  const answer = "EIP-4844";

  /// This challenge requires multiple transactions to complete.
  /// This is due to the fact that the function contains a condition
  /// which checks the `previousSignature` mapping for the signer address.
  /// If signer has not bee seen yet, the mapping key is updated and then the function returns.
  ///
  /// We need to first provide a valid signature to update the mapping with our signer,
  /// to allow the end of the function logic to become accessible.
  ///
  /// we will hash and sign the same way we did for challenge 2.

  const signature = await generateSignature(answer, signer);
  const data = generateFunctionData("solveChallenge3", [
    answer, //  string calldata riddleAnswer,
    await signer.getAddress(), //  address signer,
    ethers.utils.arrayify(signature), //  bytes calldata signature
  ]);
  await submitTx(data, signer);
};

const challenge3b = async (signer: Wallet) => {
  /// same answer
  const answer = "EIP-4844";

  /// After the first `return` is defeated, we now need to satisfy this:
  ///
  ///   require(
  ///       keccak256(abi.encodePacked(previousSignature[signer])) != keccak256(abi.encodePacked(signature)),
  ///       "you have already used this signature, try submitting a different one"
  ///   );
  ///
  /// So we need to generate a different, but still valid signature.
  /// Using EIP-2098, we can achieve this:
  /// https://eips.ethereum.org/EIPS/eip-2098 (Compact Signature Representation)

  /// generate the signature like we have been.
  const signature = await generateSignature(answer, signer);

  /// now we can use the compact signature representation by splitting it
  const compact = ethers.utils.splitSignature(signature).compact;
  const data = generateFunctionData("solveChallenge3", [
    answer,
    await signer.getAddress(),
    ethers.utils.arrayify(compact),
  ]);
  await submitTx(data, signer);
};

const generateSignature = async (
  value: string,
  signer: Wallet
): Promise<string> => {
  /// mimic solidity: keccak256(abi.encodePacked(value))
  const hashed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
  /// if signMesaage receives a string, it treats it as a UTF-8 string,
  /// we need to supply as an Arrayish to have it treat the data as bytes.
  return await signer.signMessage(ethers.utils.arrayify(hashed));
};

const generateFunctionData = (fragment: string, _arguments: any[]): string => {
  const contract = new ethers.Contract(contractAddress, Bounty, provider);
  return contract.interface.encodeFunctionData(fragment, _arguments);
};

const submitTx = async (data: string, signer: Wallet) => {
  /// setup transaction options
  const tx = {
    to: contractAddress,
    data: data,
    gasPrice: await provider.getGasPrice(),
  };

  /// simulate then send transaction
  signer.estimateGas(tx).then(async (gasLimit) => {
    if (Number(gasLimit) <= 0) {
      throw new Error("Unable to simulation gas for transaction.");
    }
    /// simulation looks good, send transaction.
    console.log(`sending tx ...`);
    console.log(`data: ${data}`);
    await signer.sendTransaction(tx).then((txn) => {
      console.log(`tx response: ${JSON.stringify(txn)}`);
    });
  });
};

main();
