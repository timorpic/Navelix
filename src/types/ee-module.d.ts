// Ambient type declarations for optional private EE modules in Open-Core architecture
declare module "../ee/index.ts" {
  export const OFFICIAL_EE_PUBLIC_KEY: string;
}

declare module "../../ee/index.ts" {
  export const OFFICIAL_EE_PUBLIC_KEY: string;
}

declare module "*/ee/index.ts" {
  export const OFFICIAL_EE_PUBLIC_KEY: string;
}
