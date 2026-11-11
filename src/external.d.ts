declare module "npm-pick-manifest" {
  interface PackageManifest {
    name: string;
    version: string;
    dist?: {
      tarball?: string;
      integrity?: string;
      shasum?: string;
    };
  }

  interface PackageMetadata {
    name: string;
    "dist-tags": Record<string, string>;
    versions: Record<string, PackageManifest>;
  }

  export default function pickManifest(
    metadata: PackageMetadata,
    version: string,
  ): PackageManifest;
}

declare module "elapsed-time-logger" {
  const elapsed: {
    start(): { get(): string };
  };
  export default elapsed;
}
