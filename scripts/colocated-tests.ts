/**
 * Specification: openspec/specs/meta/colocated-tests/spec.md
 */
export type ColocatedTestViolation = {
  readonly paths: readonly string[];
};

const testSuffixes = [".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"] as const;

const isTestFile = (file: string): boolean => testSuffixes.some((suffix) => file.endsWith(suffix));

const hasTestDirectoryUnderSrc = (file: string): boolean => {
  const parts = file.split("/");
  if (parts[0] !== "packages") return false;
  const srcAt = parts.indexOf("src");
  if (srcAt < 0) return false;
  return parts.slice(srcAt + 1, -1).includes("test");
};

const isLegacyTestSuffix = (file: string): boolean =>
  file.startsWith("packages/") && (file.endsWith(".test.ts") || file.endsWith(".test.tsx"));

const basename = (file: string): string => {
  const slash = file.lastIndexOf("/");
  return slash === -1 ? file : file.slice(slash + 1);
};

const directoryOf = (file: string): string => {
  const slash = file.lastIndexOf("/");
  return slash === -1 ? "" : file.slice(0, slash);
};

const packageName = (file: string): string | undefined => {
  const parts = file.split("/");
  const name = parts[1];
  if (parts[0] !== "packages" || name === undefined || name.length === 0) return undefined;
  return name;
};

const sourceStem = (file: string): string | undefined => {
  const pkg = packageName(file);
  if (pkg === undefined || !file.startsWith(`packages/${pkg}/src/`) || isTestFile(file)) return undefined;
  const base = basename(file);
  if (base.endsWith(".d.ts")) return base.slice(0, -".d.ts".length);
  if (base.endsWith(".tsx")) return base.slice(0, -".tsx".length);
  if (base.endsWith(".ts")) return base.slice(0, -".ts".length);
  return undefined;
};

const moduleSourceStem = (file: string): string | undefined => {
  if (file.endsWith(".d.ts")) return undefined;
  return sourceStem(file);
};

const specStem = (file: string): string | undefined => {
  const pkg = packageName(file);
  if (pkg === undefined || !file.startsWith(`packages/${pkg}/`)) return undefined;
  const base = basename(file);
  if (base.endsWith(".spec.tsx")) return base.slice(0, -".spec.tsx".length);
  if (base.endsWith(".spec.ts")) return base.slice(0, -".spec.ts".length);
  return undefined;
};

const stemKey = (pkg: string, stem: string): string => `${pkg}\0${stem}`;

const uniqueStemViolations = (files: readonly string[]): ColocatedTestViolation[] => {
  const sources = new Map<string, string[]>();
  const specs = new Map<string, string[]>();

  for (const file of files) {
    const pkg = packageName(file);
    if (pkg === undefined) continue;
    const source = sourceStem(file);
    if (source !== undefined) {
      const key = stemKey(pkg, source);
      sources.set(key, [...(sources.get(key) ?? []), file]);
    }
    const spec = specStem(file);
    if (spec !== undefined) {
      const key = stemKey(pkg, spec);
      specs.set(key, [...(specs.get(key) ?? []), file]);
    }
  }

  const violations: ColocatedTestViolation[] = [];
  for (const [key, specFiles] of specs) {
    const sourceFiles = sources.get(key);
    const source = sourceFiles?.length === 1 ? sourceFiles[0] : undefined;
    if (source === undefined) continue;
    const sourceDir = directoryOf(source);
    for (const spec of specFiles) {
      if (directoryOf(spec) === sourceDir) continue;
      violations.push({ paths: [source, spec] });
    }
  }
  return violations;
};

const hasMatchingModule = (files: readonly string[], spec: string): boolean => {
  const pkg = packageName(spec);
  const stem = specStem(spec);
  if (pkg === undefined || stem === undefined) return false;
  return files.some((file) => packageName(file) === pkg && moduleSourceStem(file) === stem);
};

const blockedInTestDirectory = (file: string, files: readonly string[]): boolean => {
  if (!hasTestDirectoryUnderSrc(file) || !isTestFile(file)) return false;
  if (!file.endsWith(".spec.ts") && !file.endsWith(".spec.tsx")) return true;
  return hasMatchingModule(files, file);
};

export const colocatedTestViolations = (
  files: readonly string[],
  packageTestDirectories: readonly string[],
): readonly ColocatedTestViolation[] => {
  const violations: ColocatedTestViolation[] = packageTestDirectories.map((directory) => ({ paths: [directory] }));
  const named = new Set<string>();

  for (const file of files) {
    const violates = blockedInTestDirectory(file, files) || isLegacyTestSuffix(file);
    if (!violates || named.has(file)) continue;
    named.add(file);
    violations.push({ paths: [file] });
  }

  return [...violations, ...uniqueStemViolations(files)];
};
