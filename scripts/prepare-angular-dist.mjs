/**
 * Post-processes ng-packagr's generated packages/angular/dist/package.json.
 *
 * packages/angular/package.json is "private": true — it is the ng-packagr
 * build *source*, not the publishable unit (dist/ is; root's own
 * devDependency links to it via "link:packages/angular/dist"). ng-packagr
 * copies "private" verbatim into the generated dist/package.json, which
 * would make `npm publish` refuse to ship it — strip it here so dist/ is
 * always publish-ready after a build.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "packages/angular/dist/package.json";
const pkg = JSON.parse(readFileSync(path, "utf8"));
delete pkg.private;
writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
