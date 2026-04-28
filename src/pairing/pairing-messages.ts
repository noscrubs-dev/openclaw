import { formatCliCommand } from "../cli/command-format.js";
import type { PairingChannel } from "./pairing-store.types.js";

export function buildPairingReply(params: {
  channel: PairingChannel;
  idLine: string;
  code: string;
}): string {
  const { channel, idLine, code } = params;
  const sharingInstructions =
    channel === "slack"
      ? [
          "1. Forward this message to #product.",
          "2. Do not send a screenshot. Forward the original Slack message so the code can be copied.",
          "3. In Slack, open this message, click the three-dot menu, choose Forward message, select #product, and send it.",
        ]
      : ["1. Send this message to the bot owner.", "2. Ask them to approve your access."];
  return [
    "You are not paired with this OpenClaw bot yet.",
    "",
    "Share these details with the bot owner:",
    "",
    idLine,
    `Code: ${code}`,
    "",
    ...sharingInstructions,
    "",
    "If they need the manual approval command, it is:",
    formatCliCommand(`openclaw pairing approve ${channel} ${code}`),
  ].join("\n");
}
