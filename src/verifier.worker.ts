import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

import {
  VX_GAME_SALT,
  PREV_GAME_SALT,
  PREV_CHAIN_LENGTH,
  VX_LAST_GAME,
  GAME_SALT,
} from "./constants";
import { gameResult } from "./utils/math";
import { getVxSignature } from "./utils/vx";

export type GameResult = {
  id: number;
  bust: number;
  hash: string;
};

export interface VerificationValues {
  gameHash: string;
  gameNumber: number;
  iterations: number;
  verifyChain: boolean;
}

// Contains the logic to verify game results and the terminating hash.
// It sends results to the main thread, which listens to messages from the worker.
// Note: it can only verify games from either the current or the previous hash-chain at a time.
function calculateResults(
  gameNumber: number,
  gameHashHex: string,
  iterations: number,
  verifyChain: boolean
) {
  const isPreviousChain = gameNumber < PREV_CHAIN_LENGTH;
  const chainStart = isPreviousChain ? 1 : PREV_CHAIN_LENGTH + 1;

  let gameHash = hexToBytes(gameHashHex);
  let gameId = gameNumber;

  for (; gameId >= chainStart; gameId--) {
    const currentGameHash = gameHash;

    if (isPreviousChain) {
      // hash of the hex-encoded value
      gameHash = sha256(bytesToHex(gameHash));
    } else {
      // hash of the binary value
      gameHash = sha256(gameHash);
    }

    let bust = 0;

    // only compute the game results we need
    if (iterations-- > 0) {
      if (isPreviousChain) {
        bust = gameResult(PREV_GAME_SALT, currentGameHash);
      } else {
        // the current chain was being used with Vx
        if (gameId <= VX_LAST_GAME) {
          const vxSignature = getVxSignature(VX_GAME_SALT, currentGameHash);
          bust = gameResult(vxSignature.signature, currentGameHash);
        } else {
          // but we switched back to the classic scheme after it shut down
          bust = gameResult(utf8ToBytes(GAME_SALT), currentGameHash);
        }
      }

      sendGameResult({
        id: gameId,
        bust,
        hash: bytesToHex(currentGameHash),
      });

      if (iterations === 0 || gameId === chainStart) {
        sendDoneSignal();
        if (!verifyChain) {
          break;
        }
      }
    }
  }

  if (verifyChain) {
    sendTerminatingHash(bytesToHex(gameHash));
  }
}

self.addEventListener(
  "message",
  async ({
    data: { gameHash, gameNumber, iterations, verifyChain },
  }: MessageEvent<VerificationValues>) => {
    calculateResults(gameNumber, gameHash, iterations, verifyChain);
  }
);

function sendDoneSignal() {
  self.postMessage({
    done: true,
  });
}

function sendGameResult(gameResult: GameResult) {
  self.postMessage({
    gameResult,
  });
}

function sendTerminatingHash(terminatingHash: string) {
  self.postMessage({
    terminatingHash,
  });
}
