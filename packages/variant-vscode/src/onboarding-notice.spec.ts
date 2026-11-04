import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getVariantsAdoption, type VariantsAdoption } from "variant-config";
import { createMiseGuard } from "./mise-guard.ts";
import {
  BOOTSTRAP_BUTTON,
  createOnboardingNotice,
  type Memento,
  ONBOARDING_COMMAND,
  SHOWN_KEY,
} from "./onboarding-notice.ts";

/** Specification: onboarding (One-time onboarding notification) */

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-notice-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const put = (path: string, content = ""): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const memento = (store = new Map<string, unknown>()): Memento & { store: Map<string, unknown> } => ({
  store,
  get: <T>(key: string) => store.get(key) as T | undefined,
  update: async (key, value) => {
    store.set(key, value);
  },
});

const setup = (
  environment: NodeJS.ProcessEnv | (() => NodeJS.ProcessEnv),
  options: { state?: Memento & { store: Map<string, unknown> }; pressed?: string; hasConfig?: boolean } = {},
) => {
  const state = options.state ?? memento();
  const infos: Array<{ message: string; buttons: string[] }> = [];
  const errors: Array<{ message: string; buttons: string[] }> = [];
  const commands: string[] = [];
  const guard = createMiseGuard({
    trust: async () => {},
    showError: async (message, ...buttons) => {
      errors.push({ message, buttons });
      return undefined;
    },
    showInfo: async () => undefined,
  });
  const notice = createOnboardingNotice({
    root,
    state,
    hasConfig: () => options.hasConfig ?? false,
    detect: async () => {
      const adoption = getVariantsAdoption(root, typeof environment === "function" ? environment : () => environment);
      return detectionOf(adoption);
    },
    showInfo: async (message, ...buttons) => {
      infos.push({ message, buttons });
      return options.pressed;
    },
    runCommand: async (id) => {
      commands.push(id);
    },
    guard,
  });
  return { notice, state, infos, errors, commands };
};

const detectionOf = (adoption: VariantsAdoption): { label: string | undefined; error?: unknown } => {
  if (adoption.status === "detected") {
    return { label: adoption.label };
  }
  if (adoption.status === "none" && adoption.error !== undefined) {
    return { label: undefined, error: adoption.error };
  }
  return { label: undefined };
};

const POSTGRES = { POSTGRES_HOST: "db" };

describe("onboarding notification", () => {
  it("offers Bootstrap Variant for a Postgres database and a Vite app", async () => {
    put("fe/vite.config.ts");
    const { notice, infos } = setup(POSTGRES);

    await notice.check();

    expect(infos).toEqual([
      { message: "Detected postgres+vite, want to bootstrap Variant in this repo?", buttons: [BOOTSTRAP_BUTTON] },
    ]);
  });

  it("runs the onboarding command when the button is pressed", async () => {
    put("fe/vite.config.ts");
    const { notice, commands } = setup(POSTGRES, { pressed: BOOTSTRAP_BUTTON });

    await notice.check();

    expect(commands).toEqual([ONBOARDING_COMMAND]);
  });

  it("runs nothing when the notification is dismissed", async () => {
    put("fe/vite.config.ts");
    const { notice, commands } = setup(POSTGRES);

    await notice.check();

    expect(commands).toEqual([]);
  });

  it("names SQLite with a watch script", async () => {
    put("api/package.json", JSON.stringify({ scripts: { watch: "x" } }));
    const { notice, infos } = setup({ SQLITE_DATABASE: "app" });

    await notice.check();

    expect(infos[0]?.message).toContain("sqlite+package-script-watch");
  });

  it("names MariaDB and MySQL", async () => {
    put("be/nest-cli.json", "{}");
    const maria = setup({ MARIADB_HOST: "m" });
    await maria.notice.check();
    put("fe/vite.config.ts");
    rmSync(join(root, "be"), { recursive: true });
    const mysql = setup({ MYSQL_HOST: "m" });
    await mysql.notice.check();

    expect(maria.infos[0]?.message).toContain("mariadb+nestjs");
    expect(mysql.infos[0]?.message).toContain("mysql+vite");
  });

  it("shows only once, also after a restart that shares the workspace state", async () => {
    put("fe/vite.config.ts");
    const first = setup(POSTGRES);
    await first.notice.check();
    await first.notice.check();
    const restarted = setup(POSTGRES, { state: first.state });
    await restarted.notice.check();

    expect(first.infos).toHaveLength(1);
    expect(restarted.infos).toHaveLength(0);
    expect(first.state.store.get(SHOWN_KEY)).toBe(true);
  });

  it("records the notification as shown whatever the person answers", async () => {
    put("fe/vite.config.ts");
    const { notice, state } = setup(POSTGRES, { pressed: undefined });

    await notice.check();

    expect(state.store.get(SHOWN_KEY)).toBe(true);
  });

  it("shows nothing when a variants.yaml exists", async () => {
    put("fe/vite.config.ts");
    const { notice, infos, state } = setup(POSTGRES, { hasConfig: true });

    await notice.check();

    expect(infos).toEqual([]);
    expect(state.store.size).toBe(0);
  });

  it("shows nothing and records nothing when no database is detected", async () => {
    put("fe/vite.config.ts");
    const { notice, infos, state } = setup({});

    await notice.check();

    expect(infos).toEqual([]);
    expect(state.store.size).toBe(0);
  });

  it("shows nothing and records nothing when no application is detected", async () => {
    const { notice, infos, state } = setup(POSTGRES);

    await notice.check();

    expect(infos).toEqual([]);
    expect(state.store.size).toBe(0);
  });

  it("does not read the environment once the notification was shown or a configuration exists", async () => {
    put("fe/vite.config.ts");
    let reads = 0;
    const environment = (): NodeJS.ProcessEnv => {
      reads += 1;
      return POSTGRES;
    };
    const state = memento(new Map([[SHOWN_KEY, true]]));

    await setup(environment, { state }).notice.check();
    await setup(environment, { hasConfig: true }).notice.check();

    expect(reads).toBe(0);
  });

  it("reports a failure of Mise instead of the notification and records nothing", async () => {
    put("fe/vite.config.ts");
    const failure = Object.assign(new Error("mise failed"), {
      name: "MiseError",
      directory: root,
      detail: "mise.toml is not trusted",
      untrusted: true,
    });
    const { notice, infos, errors, state } = setup(() => {
      throw failure;
    });

    await notice.check();

    expect(infos).toEqual([]);
    expect(state.store.size).toBe(0);
    expect(errors).toEqual([{ message: `Mise failed in ${root}: mise.toml is not trusted`, buttons: ["Trust"] }]);
  });
});
