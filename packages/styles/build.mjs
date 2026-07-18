/**
 * Builds the @modyra/styles package.
 *
 * Copies every asset from src/ to dist/ and minifies each *.css file with
 * postcss + cssnano, preserving the original filenames so import specifiers
 * stay unchanged.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import cssnano from "cssnano";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "src");
const distDir = join(__dirname, "dist");

mkdirSync(distDir, { recursive: true });

const files = readdirSync(srcDir);
for (const file of files) {
  const srcPath = join(srcDir, file);
  const distPath = join(distDir, file);

  if (extname(file) === ".css") {
    const css = readFileSync(srcPath, "utf8");
    const result = await postcss([cssnano({ preset: "default" })]).process(css, {
      from: srcPath,
      to: distPath,
    });
    writeFileSync(distPath, result.css, "utf8");
  } else {
    copyFileSync(srcPath, distPath);
  }
}

console.log(`@modyra/styles: built ${files.length} file(s) → ${distDir}`);
