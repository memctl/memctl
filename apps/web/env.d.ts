// fumadocs-mdx generates .source/index.ts at build time
// This file ensures TypeScript can resolve the module during type checking
declare module "@/.source" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const docs: any;
}
