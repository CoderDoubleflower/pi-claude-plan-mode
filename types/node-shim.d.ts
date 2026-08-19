declare const process: {
  pid: number;
};

declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: string, encoding?: string): { digest(encoding: "hex"): string };
  };
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
}

declare module "node:fs/promises" {
  export function lstat(path: string): Promise<{
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
  }>;
  export function mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  export function readFile(path: string, encoding: string): Promise<string>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
  export function writeFile(
    path: string,
    data: string,
    options: string | { encoding?: string; flag?: string; mode?: number },
  ): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}
