import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureEnv } from "../test-utils/env.js";
import { buildPairingReply } from "./pairing-messages.js";

describe("buildPairingReply", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;

  beforeEach(() => {
    envSnapshot = captureEnv(["OPENCLAW_PROFILE"]);
    process.env.OPENCLAW_PROFILE = "isolated";
  });

  afterEach(() => {
    envSnapshot.restore();
  });

  const cases = [
    {
      channel: "telegram",
      idLine: "Your Telegram user id: 42",
      code: "QRS678",
    },
    {
      channel: "discord",
      idLine: "Your Discord user id: 1",
      code: "ABC123",
    },
    {
      channel: "slack",
      idLine: "Your Slack user id: U1",
      code: "DEF456",
    },
    {
      channel: "signal",
      idLine: "Your Signal number: +15550001111",
      code: "GHI789",
    },
    {
      channel: "imessage",
      idLine: "Your iMessage sender id: +15550002222",
      code: "JKL012",
    },
    {
      channel: "whatsapp",
      idLine: "Your WhatsApp phone number: +15550003333",
      code: "MNO345",
    },
  ] as const;

  for (const testCase of cases) {
    it(`formats pairing reply for ${testCase.channel}`, () => {
      const text = buildPairingReply(testCase);
      expect(text).toContain(testCase.idLine);
      expect(text).toContain(`Code: ${testCase.code}`);
      expect(text).toContain("Share these details with the bot owner:");
      // CLI commands should respect OPENCLAW_PROFILE when set (most tests run with isolated profile)
      const commandRe = new RegExp(
        `(?:openclaw|openclaw) --profile isolated pairing approve ${testCase.channel} ${testCase.code}`,
      );
      expect(text).toMatch(commandRe);
    });
  }

  it("adds Slack forwarding instructions without asking for a screenshot", () => {
    const text = buildPairingReply({
      channel: "slack",
      idLine: "Your Slack user id: U1",
      code: "DEF456",
    });

    expect(text).toContain("1. Forward this message to #product.");
    expect(text).toContain("2. Do not send a screenshot.");
    expect(text).toContain("choose Forward message");
    expect(text).toContain("select #product");
  });
});
