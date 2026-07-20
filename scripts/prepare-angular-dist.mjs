/**
 * Post-processes ng-packagr's generated Angular dist/ so it is publish-ready
 * on every OS.
 *
 * packages/angular/package.json is "private": true — it is the ng-packagr
 * build *source*, not the publishable unit (dist/ is; root's own
 * devDependency links to it via "link:packages/angular/dist"). ng-packagr
 * copies "private" verbatim into the generated dist/package.json, which
 * would make `npm publish` refuse to ship it — strip it here so dist/ is
 * always publish-ready after a build.
 */
import {
	copyFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";

const distDir = "packages/angular/dist";
const packageJsonPath = path.join(distDir, "package.json");

removeIfPresent(path.join(distDir, "node_modules"));
removeIfPresent(path.join(distDir, "package-lock.json"));
copyFileSync("README.md", path.join(distDir, "README.md"));
copyFileSync("LICENSE", path.join(distDir, "LICENSE"));
deleteSourceMaps(distDir);

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
delete pkg.private;
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

function removeIfPresent(targetPath) {
	if (!existsSync(targetPath)) return;
	rmSync(targetPath, { force: true, recursive: true });
}

function deleteSourceMaps(dirPath) {
	for (const entry of readdirSync(dirPath)) {
		const entryPath = path.join(dirPath, entry);
		const entryStat = statSync(entryPath);
		if (entryStat.isDirectory()) {
			deleteSourceMaps(entryPath);
			continue;
		}
		if (entryPath.endsWith(".map")) {
			rmSync(entryPath, { force: true });
		}
	}
}
