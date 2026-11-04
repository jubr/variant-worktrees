import { describe, expect, it } from "bun:test";
import { createMiseGuard, type MiseFailureInfo, miseFailureOf } from "./mise-guard.ts";

/** Specification: tools/mise (Mise failures in the editor offer Trust) */

const untrusted: MiseFailureInfo = { directory: "/proj", detail: "mise.toml is not trusted", untrusted: true };
const invalid: MiseFailureInfo = { directory: "/proj", detail: "invalid TOML", untrusted: false };

const setup = (options: { pressed?: string; trustFailure?: string } = {}) => {
  const errors: Array<{ message: string; buttons: string[] }> = [];
  const infos: string[] = [];
  const trusted: string[] = [];
  const guard = createMiseGuard({
    trust: async (directory) => {
      if (options.trustFailure) {
        throw new Error(options.trustFailure);
      }
      trusted.push(directory);
    },
    showError: async (message, ...buttons) => {
      errors.push({ message, buttons });
      return message.startsWith("Mise failed") ? options.pressed : undefined;
    },
    showInfo: async (message) => {
      infos.push(message);
    },
  });
  return { guard, errors, infos, trusted };
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("miseFailureOf", () => {
  it("reads the fields of a MiseError by its name", () => {
    const error = Object.assign(new Error("mise failed in /proj: x"), {
      name: "MiseError",
      directory: "/proj",
      detail: "x",
      untrusted: true,
    });

    expect(miseFailureOf(error)).toEqual({ directory: "/proj", detail: "x", untrusted: true });
  });

  it("is nothing for any other error", () => {
    expect(miseFailureOf(new Error("x"))).toBeUndefined();
    expect(miseFailureOf("x")).toBeUndefined();
  });
});

describe("createMiseGuard", () => {
  it("names the directory and Mise's message and offers Trust for an untrusted configuration", () => {
    const { guard, errors } = setup();

    guard.report(untrusted, () => {});

    expect(errors).toEqual([{ message: "Mise failed in /proj: mise.toml is not trusted", buttons: ["Trust"] }]);
  });

  it("offers no Trust for another failure", () => {
    const { guard, errors } = setup();

    guard.report(invalid, () => {});

    expect(errors[0]?.buttons).toEqual([]);
  });

  it("shows one notification per directory and kind in a session", () => {
    const { guard, errors } = setup();

    guard.report(untrusted, () => {});
    guard.report(untrusted, () => {});
    guard.report(invalid, () => {});
    guard.report({ ...untrusted, directory: "/other" }, () => {});

    expect(errors.map((entry) => entry.message)).toEqual([
      "Mise failed in /proj: mise.toml is not trusted",
      "Mise failed in /proj: invalid TOML",
      "Mise failed in /other: mise.toml is not trusted",
    ]);
  });

  it("trusts, confirms with the directory and retries when Trust is pressed", async () => {
    const { guard, infos, trusted } = setup({ pressed: "Trust" });
    let retried = 0;

    guard.report(untrusted, () => {
      retried += 1;
    });
    await settle();

    expect(trusted).toEqual(["/proj"]);
    expect(infos).toEqual(["Trusted the Mise configuration of /proj"]);
    expect(retried).toBe(1);
  });

  it("shows the message of a failing trust and retries nothing", async () => {
    const { guard, errors, trusted } = setup({ pressed: "Trust", trustFailure: "trust refused" });
    let retried = 0;

    guard.report(untrusted, () => {
      retried += 1;
    });
    await settle();

    expect(trusted).toEqual([]);
    expect(errors.at(-1)?.message).toBe("trust refused");
    expect(retried).toBe(0);
  });

  it("reports the same failure again after a successful trust", async () => {
    const { guard, errors } = setup({ pressed: "Trust" });

    guard.report(untrusted, () => {});
    await settle();
    guard.report(untrusted, () => {});

    expect(errors.filter((entry) => entry.message.startsWith("Mise failed"))).toHaveLength(2);
  });

  it("handle reports a Mise failure and ignores any other error", () => {
    const { guard, errors } = setup();
    const mise = Object.assign(new Error("mise failed"), {
      name: "MiseError",
      directory: "/proj",
      detail: "d",
      untrusted: false,
    });

    expect(guard.handle(new Error("other"), () => {})).toBe(false);
    expect(guard.handle(mise, () => {})).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("trust returns the failure message for the dialog, or nothing on success", async () => {
    expect(await setup().guard.trust("/proj")).toBeUndefined();
    expect(await setup({ trustFailure: "no" }).guard.trust("/proj")).toBe("no");
  });
});
