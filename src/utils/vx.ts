import { bls12_381 as bls } from "@noble/curves/bls12-381";
import { sha256 } from "@noble/hashes/sha256";
import { concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

import { VX_PUB_KEY, VX_PRIV_KEY } from "../constants";

export function getVxSignature(clientSeed: string, gameHash: Uint8Array) {
  const privKey = hexToBytes(VX_PRIV_KEY);
  const message = concatBytes(sha256(gameHash), utf8ToBytes(clientSeed));

  const hashedMessage = bls.longSignatures.hash(message);
  const signature = bls.longSignatures
    .sign(hashedMessage, privKey)
    .toBytes(true);
  const verified = bls.longSignatures.verify(
    signature,
    hashedMessage,
    hexToBytes(VX_PUB_KEY)
  );

  return {
    signature,
    verified,
  };
}
