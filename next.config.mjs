import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Next.js to treat this directory as the tracing root
  // to avoid picking the parent folder when multiple lockfiles exist.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
