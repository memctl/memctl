import { docs } from "@/.source";
import { loader } from "fumadocs-core/source";

const docsSource = docs.toFumadocsSource() as {
  files: unknown;
} & Record<string, unknown>;
const normalizedSource = {
  ...docsSource,
  files:
    typeof docsSource.files === "function"
      ? docsSource.files()
      : docsSource.files,
} as any;

export const source = loader({
  source: normalizedSource,
  baseUrl: "/docs",
});
