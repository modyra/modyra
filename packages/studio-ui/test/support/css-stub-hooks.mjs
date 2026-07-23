/**
 * Node has no built-in CSS loader; the shipped `dist/index.js` contains a
 * literal `import "./studio.css"` (correct for esbuild/Vite consumers,
 * which handle CSS natively) that plain Node can't resolve. These module
 * hooks stub `.css` specifiers as empty modules so tests can import and
 * actually execute `dist/index.js` under `node --test`, instead of only
 * grepping its source text.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return { url: `css-stub:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("css-stub:")) {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  return nextLoad(url, context);
}
