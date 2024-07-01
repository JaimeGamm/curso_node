import { createRequire } from "node:module";
const requere = createRequire(import.meta.url);
export const readJson = (path) => requere(path);
