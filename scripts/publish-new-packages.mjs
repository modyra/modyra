import { execFileSync } from "node:child_process";
import {
    chmodSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

const workspacePublisherPath = resolve(
    repositoryRoot,
    "scripts/publish-workspace.mjs",
);

const dryRunMode = process.argv.includes("--dry-run");
const stageMode = process.argv.includes("--stage");

const INITIAL_BETA_VERSION = "0.1.0-beta.0";

// PENDING_PACKAGES_START
const pendingPackageDirectories = [

];
// PENDING_PACKAGES_END

if (dryRunMode && stageMode) {
    throw new Error(
        'Le opzioni "--dry-run" e "--stage" non possono essere usate insieme.',
    );
}

main().catch((error) => {
    logError("Errore generale non gestito", error);
    process.exitCode = 1;
});

async function main() {
    logHeader("Bootstrap dei nuovi package npm");

    logInfo(`Script: ${scriptPath}`);
    logInfo(`Repository: ${repositoryRoot}`);
    logInfo(`Publisher ordinario: ${workspacePublisherPath}`);
    logInfo(`Package configurati: ${pendingPackageDirectories.length}`);
    logInfo(`Modalita dry-run: ${formatBoolean(dryRunMode)}`);
    logInfo(`Modalita stage: ${formatBoolean(stageMode)}`);
    logInfo(`Provenance: ${formatBoolean(shouldUseProvenance())}`);

    if (pendingPackageDirectories.length === 0) {
        logSuccess(
            "La lista di bootstrap e vuota. Non ci sono package da elaborare.",
        );
        return;
    }

    const packages = pendingPackageDirectories.map(readPackage);
    const orderedPackages = sortByWorkspaceDependencies(packages);

    console.log("");
    logSection("Ordine di elaborazione");

    orderedPackages.forEach((pkg, index) => {
        console.log(
            `  ${String(index + 1).padStart(2, "0")}. ` +
            `${pkg.name}@${pkg.version} (${pkg.relativeDir})`,
        );
    });

    const summary = {
        configured: orderedPackages.length,
        published: [],
        alreadyExisting: [],
        staged: [],
        dryRun: [],
        failed: [],
    };

    for (let index = 0; index < orderedPackages.length; index++) {
        let pkg = orderedPackages[index];

        console.log("");
        logSection(
            `Package ${index + 1}/${orderedPackages.length}: ${pkg.name}`,
        );

        try {
            logInfo(`Directory: ${pkg.relativeDir}`);
            logInfo(`Versione locale iniziale: ${pkg.version}`);
            logInfo(`Privato: ${formatBoolean(pkg.private)}`);

            if (pkg.version === "0.0.0") {
                if (dryRunMode || stageMode) {
                    logWarning(
                        `${pkg.name} utilizza la versione placeholder 0.0.0.`,
                    );
                    logInfo(
                        `In modalita ${dryRunMode ? "dry-run" : "stage"
                        } verra utilizzata temporaneamente la versione ` +
                        `${INITIAL_BETA_VERSION}.`,
                    );

                    pkg = {
                        ...pkg,
                        version: INITIAL_BETA_VERSION,
                        packageJson: {
                            ...pkg.packageJson,
                            version: INITIAL_BETA_VERSION,
                        },
                    };
                } else {
                    pkg = ensureInitialBetaVersion(pkg);
                }
            } else {
                logInfo(
                    `${pkg.name} utilizza gia una versione esplicita: ` +
                    `${pkg.version}.`,
                );
            }

            logInfo(
                `Versione selezionata per questa esecuzione: ${pkg.version}`,
            );

            logStep(
                `Controllo se il nome "${pkg.name}" esiste nel registry npm...`,
            );

            const metadata = await readPublishedMetadata(pkg.name);

            if (metadata !== null) {
                const publishedVersions = Object.keys(
                    metadata.versions ?? {},
                );

                const latestVersion =
                    metadata["dist-tags"]?.latest ?? "nessun tag latest";

                logWarning(
                    `${pkg.name} esiste gia su npm in almeno una versione.`,
                );
                logInfo(`Tag latest: ${latestVersion}`);
                logInfo(
                    `Versioni trovate: ${publishedVersions.length > 0
                        ? publishedVersions.join(", ")
                        : "elenco delle versioni non disponibile"
                    }`,
                );
                logInfo(
                    "Il package non verra pubblicato dal bootstrap.",
                );

                if (dryRunMode || stageMode) {
                    logWarning(
                        `Modalita ${dryRunMode ? "dry-run" : "stage"
                        }: nessun file verra modificato.`,
                    );

                    if (dryRunMode) {
                        summary.dryRun.push(pkg.name);
                    } else {
                        summary.staged.push(pkg.name);
                    }
                } else {
                    movePackageToWorkspacePublisher(pkg);
                    summary.alreadyExisting.push(pkg.name);

                    logSuccess(
                        `${pkg.name} rimosso dal bootstrap e aggiunto al ` +
                        "publisher ordinario.",
                    );
                }

                continue;
            }

            logSuccess(
                `${pkg.name} non esiste su npm in alcuna versione.`,
            );

            if (pkg.private) {
                logWarning(
                    `${pkg.name} contiene "private": true.`,
                );
                logInfo(
                    'La proprieta "private" verra rimossa solamente durante ' +
                    "il comando npm e verra ripristinata subito dopo.",
                );
            }

            if (dryRunMode) {
                await dryRunPackage(pkg);
                summary.dryRun.push(pkg.name);

                logWarning(
                    `${pkg.name} non e stato pubblicato perche lo script e ` +
                    "in modalita dry-run.",
                );
                logInfo(
                    "Il package rimane nella lista di bootstrap.",
                );

                continue;
            }

            if (stageMode) {
                await stagePackage(pkg);
                summary.staged.push(pkg.name);

                logWarning(
                    `${pkg.name} e stato elaborato in modalita stage.`,
                );
                logInfo(
                    "Il package rimane nella lista di bootstrap finche non " +
                    "risulta realmente pubblicato su npm.",
                );

                continue;
            }

            const publishResult = await publishNewPackage(pkg);

            if (publishResult === "published-concurrently") {
                movePackageToWorkspacePublisher(pkg);
                summary.alreadyExisting.push(pkg.name);

                logSuccess(
                    `${pkg.name} esiste ora su npm ed e stato spostato nel ` +
                    "publisher ordinario.",
                );

                continue;
            }

            movePackageToWorkspacePublisher(pkg);
            summary.published.push(pkg.name);

            logSuccess(
                `${pkg.name}@${pkg.version} pubblicato, verificato e ` +
                "spostato nel publisher ordinario.",
            );
        } catch (error) {
            summary.failed.push({
                name: pkg.name,
                version: pkg.version,
                error: error.message ?? String(error),
            });

            logError(
                `Elaborazione fallita per ${pkg.name}@${pkg.version}`,
                error,
            );

            logWarning(
                `${pkg.name} rimane nella lista di bootstrap.`,
            );
            logInfo(
                "L'elaborazione continua con il package successivo.",
            );
        }
    }

    printSummary(summary);

    if (summary.failed.length > 0) {
        process.exitCode = 1;
    }
}

function readPackage(relativeDir) {
    const normalizedDir = normalizePath(relativeDir);
    const absoluteDir = resolve(repositoryRoot, normalizedDir);
    const packageJsonPath = resolve(absoluteDir, "package.json");

    let packageJson;

    try {
        packageJson = JSON.parse(
            readFileSync(packageJsonPath, "utf8"),
        );
    } catch (error) {
        throw new Error(
            `Impossibile leggere ${packageJsonPath}: ${error.message}`,
            { cause: error },
        );
    }

    if (!packageJson.name) {
        throw new Error(
            `Proprieta "name" mancante in ${packageJsonPath}`,
        );
    }

    if (!packageJson.version) {
        throw new Error(
            `Proprieta "version" mancante in ${packageJsonPath}`,
        );
    }

    return {
        absoluteDir,
        relativeDir: normalizedDir,
        packageJsonPath,
        name: packageJson.name,
        version: packageJson.version,
        private: packageJson.private === true,
        packageJson,
    };
}

function ensureInitialBetaVersion(pkg) {
    if (pkg.version !== "0.0.0") {
        return pkg;
    }

    logWarning(
        `${pkg.name} utilizza la versione placeholder 0.0.0.`,
    );
    logStep(
        `Aggiornamento permanente della versione a ` +
        `${INITIAL_BETA_VERSION}...`,
    );

    const currentContent = readFileSync(
        pkg.packageJsonPath,
        "utf8",
    );

    const packageJson = JSON.parse(currentContent);

    if (packageJson.version !== "0.0.0") {
        logWarning(
            `Il package.json di ${pkg.name} e cambiato durante ` +
            "l'esecuzione.",
        );
        logInfo(
            `Versione attualmente presente: ${packageJson.version}`,
        );

        return {
            ...pkg,
            version: packageJson.version,
            private: packageJson.private === true,
            packageJson,
        };
    }

    packageJson.version = INITIAL_BETA_VERSION;

    writeFileAtomically(
        pkg.packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`,
    );

    logSuccess(
        `${pkg.name}: versione aggiornata da 0.0.0 a ` +
        `${INITIAL_BETA_VERSION}.`,
    );
    logInfo(
        `La nuova versione e stata salvata in ${pkg.packageJsonPath}.`,
    );

    return {
        ...pkg,
        version: INITIAL_BETA_VERSION,
        private: packageJson.private === true,
        packageJson,
    };
}

async function readPublishedMetadata(packageName) {
    const registryUrl =
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

    logInfo(`Registry URL: ${registryUrl}`);

    let response;

    try {
        response = await fetch(registryUrl, {
            headers: {
                Accept: "application/json",
            },
        });
    } catch (error) {
        throw new Error(
            `Errore di rete durante il controllo di ${packageName}: ` +
            `${error.message}`,
            { cause: error },
        );
    }

    if (response.status === 404) {
        logInfo(
            `Il registry ha restituito 404 per ${packageName}.`,
        );
        return null;
    }

    if (!response.ok) {
        throw new Error(
            `Il registry npm ha restituito ${response.status} ` +
            `${response.statusText} durante il controllo di ` +
            `${packageName}.`,
        );
    }

    return response.json();
}

async function dryRunPackage(pkg) {
    logStep(
        `Esecuzione dry-run per ${pkg.name}@${pkg.version}...`,
    );

    const args = createPublishArguments(pkg, {
        dryRun: true,
        stage: false,
    });

    await executeWithPublishablePackageJson(
        pkg,
        () => executeNpm(args, pkg.absoluteDir),
    );

    logSuccess(
        `Dry-run completato per ${pkg.name}@${pkg.version}.`,
    );
}

async function stagePackage(pkg) {
    logStep(
        `Esecuzione stage per ${pkg.name}@${pkg.version}...`,
    );

    const args = createPublishArguments(pkg, {
        dryRun: false,
        stage: true,
    });

    await executeWithPublishablePackageJson(
        pkg,
        () => executeNpm(args, pkg.absoluteDir),
    );

    logSuccess(
        `Stage completato per ${pkg.name}@${pkg.version}.`,
    );
}

async function publishNewPackage(pkg) {
    logStep(
        `Pubblicazione di ${pkg.name}@${pkg.version} su npm...`,
    );

    const args = createPublishArguments(pkg, {
        dryRun: false,
        stage: false,
    });

    try {
        await executeWithPublishablePackageJson(
            pkg,
            () => executeNpm(args, pkg.absoluteDir),
        );
    } catch (publishError) {
        logWarning(
            `npm publish ha restituito un errore per ${pkg.name}.`,
        );

        logStep(
            "Nuovo controllo del registry per verificare una possibile " +
            "pubblicazione concorrente...",
        );

        const metadata = await readPublishedMetadata(pkg.name);

        if (metadata !== null) {
            const availableVersions = Object.keys(
                metadata.versions ?? {},
            );

            logWarning(
                `${pkg.name} ora esiste su npm.`,
            );
            logInfo(
                `Versioni presenti: ${availableVersions.length > 0
                    ? availableVersions.join(", ")
                    : "elenco non disponibile"
                }`,
            );
            logInfo(
                "Il package potrebbe essere stato pubblicato da un'altra " +
                "pipeline o da un'altra esecuzione.",
            );

            return "published-concurrently";
        }

        throw new Error(
            `La pubblicazione di ${pkg.name}@${pkg.version} e fallita e ` +
            "il package continua a non esistere su npm.",
            { cause: publishError },
        );
    }

    logSuccess(
        `Il comando npm publish per ${pkg.name}@${pkg.version} ` +
        "e terminato correttamente.",
    );

    logStep(
        "Attesa della propagazione della versione nel registry npm...",
    );

    await waitForPublishedVersion(pkg.name, pkg.version);

    return "published";
}

function createPublishArguments(pkg, options) {
    const { dryRun, stage } = options;

    const args = stage
        ? ["stage", "publish"]
        : ["publish"];

    args.push("--access", "public");

    if (isPrereleaseVersion(pkg.version)) {
        const prereleaseTag = readPrereleaseTag(pkg.version);

        args.push("--tag", prereleaseTag);

        logInfo(
            `${pkg.name}@${pkg.version} e una prerelease.`,
        );
        logInfo(
            `Dist-tag npm selezionato: ${prereleaseTag}`,
        );
    } else {
        logInfo(
            `${pkg.name}@${pkg.version} e una versione stabile.`,
        );
        logInfo("Dist-tag npm utilizzato: latest");
    }

    if (dryRun) {
        args.push("--dry-run");
    }

    if (shouldUseProvenance()) {
        args.push("--provenance");
    }

    return args;
}

async function executeWithPublishablePackageJson(
    pkg,
    operation,
) {
    const persistentContent = readFileSync(
        pkg.packageJsonPath,
        "utf8",
    );

    const persistentPackageJson = JSON.parse(
        persistentContent,
    );

    const publishablePackageJson = {
        ...persistentPackageJson,
        version: pkg.version,
    };

    const requiresTemporaryVersion =
        persistentPackageJson.version !== pkg.version;

    const requiresPrivateRemoval =
        publishablePackageJson.private === true;

    if (!requiresTemporaryVersion && !requiresPrivateRemoval) {
        logInfo(
            `${pkg.name} non richiede modifiche temporanee al package.json.`,
        );

        return await operation();
    }

    if (requiresTemporaryVersion) {
        logWarning(
            `${pkg.name}: la versione verra modificata temporaneamente ` +
            `da ${persistentPackageJson.version} a ${pkg.version}.`,
        );
    }

    if (requiresPrivateRemoval) {
        logWarning(
            `${pkg.name}: rimozione temporanea di "private": true.`,
        );

        delete publishablePackageJson.private;
    }

    const temporaryContent =
        `${JSON.stringify(publishablePackageJson, null, 2)}\n`;

    logStep(
        `Scrittura del package.json temporaneo per ${pkg.name}...`,
    );

    writeFileAtomically(
        pkg.packageJsonPath,
        temporaryContent,
    );

    try {
        logSuccess(
            `Package.json temporaneo pronto per ${pkg.name}.`,
        );
        logInfo(
            `Versione usata dal comando npm: ` +
            `${publishablePackageJson.version}`,
        );

        return await operation();
    } finally {
        logStep(
            `Ripristino del package.json persistente di ${pkg.name}...`,
        );

        writeFileAtomically(
            pkg.packageJsonPath,
            persistentContent,
        );

        logSuccess(
            `Package.json persistente ripristinato per ${pkg.name}.`,
        );
    }
}

function executeNpm(args, cwd) {
    logInfo(`Comando: npm ${args.join(" ")}`);
    logInfo(`Working directory: ${cwd}`);

    try {
        execFileSync("npm", args, {
            cwd,
            stdio: "inherit",
            env: process.env,
        });
    } catch (error) {
        throw new Error(
            `Il comando "npm ${args.join(" ")}" e terminato con errore.`,
            { cause: error },
        );
    }
}

async function waitForPublishedVersion(
    packageName,
    expectedVersion,
) {
    const maxAttempts = 12;
    const delayMs = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        logInfo(
            `Verifica registry ${attempt}/${maxAttempts} per ` +
            `${packageName}@${expectedVersion}...`,
        );

        const metadata = await readPublishedMetadata(packageName);

        if (metadata?.versions?.[expectedVersion]) {
            logSuccess(
                `${packageName}@${expectedVersion} e visibile nel registry npm.`,
            );
            return;
        }

        if (metadata !== null) {
            const availableVersions = Object.keys(
                metadata.versions ?? {},
            );

            logInfo(
                `Il nome ${packageName} e visibile, ma la versione ` +
                `${expectedVersion} non e ancora disponibile.`,
            );
            logInfo(
                `Versioni attualmente visibili: ${availableVersions.length > 0
                    ? availableVersions.join(", ")
                    : "nessuna"
                }`,
            );
        } else {
            logInfo(
                `${packageName} non e ancora visibile nel registry.`,
            );
        }

        if (attempt < maxAttempts) {
            logInfo(
                `Nuovo tentativo tra ${delayMs / 1000} secondi...`,
            );

            await sleep(delayMs);
        }
    }

    throw new Error(
        `${packageName}@${expectedVersion} non e stato verificato ` +
        `dopo ${maxAttempts} tentativi.`,
    );
}

function movePackageToWorkspacePublisher(pkg) {
    logStep(
        `Spostamento di ${pkg.name} nel publisher ordinario...`,
    );

    addPackageToWorkspacePublisher(pkg);
    removePackageFromPendingList(pkg.relativeDir);

    logSuccess(
        `${pkg.name} e ora gestito da publish-workspace.mjs.`,
    );
}

function addPackageToWorkspacePublisher(pkg) {
    const source = readFileSync(
        workspacePublisherPath,
        "utf8",
    );

    const arrayBlock = locatePackagesArray(source);

    const existingEntries = extractWorkspacePublisherPackages(
        arrayBlock.body,
    );

    const existingByName = existingEntries.find(
        (entry) => entry.name === pkg.name,
    );

    const existingByDirectory = existingEntries.find(
        (entry) =>
            normalizePath(entry.dir) ===
            normalizePath(pkg.relativeDir),
    );

    if (existingByName || existingByDirectory) {
        const existing = existingByName ?? existingByDirectory;

        logInfo(
            `${pkg.name} e gia presente in publish-workspace.mjs.`,
        );
        logInfo(
            `Entry esistente: ${existing.name} (${existing.dir})`,
        );

        return;
    }

    const entry = [
        "  {",
        `    name: ${JSON.stringify(pkg.name)},`,
        `    dir: ${JSON.stringify(pkg.relativeDir)},`,
        "  },",
    ].join("\n");

    const beforeClosingBracket = source.slice(
        0,
        arrayBlock.closingBracketIndex,
    );

    const afterClosingBracket = source.slice(
        arrayBlock.closingBracketIndex,
    );

    const separator = beforeClosingBracket.endsWith("\n")
        ? ""
        : "\n";

    const updatedSource =
        beforeClosingBracket +
        separator +
        entry +
        "\n" +
        afterClosingBracket;

    writeFileAtomically(
        workspacePublisherPath,
        updatedSource,
    );

    logSuccess(
        `${pkg.name} aggiunto a publish-workspace.mjs.`,
    );
}

function locatePackagesArray(source) {
    const declarationMatch = source.match(
        /const\s+packages\s*=\s*\[/,
    );

    if (!declarationMatch || declarationMatch.index === undefined) {
        throw new Error(
            `Impossibile trovare "const packages = [" in ` +
            `${workspacePublisherPath}.`,
        );
    }

    const openingBracketIndex =
        declarationMatch.index +
        declarationMatch[0].lastIndexOf("[");

    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (
        let index = openingBracketIndex;
        index < source.length;
        index++
    ) {
        const current = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (current === "\n") {
                lineComment = false;
            }
            continue;
        }

        if (blockComment) {
            if (current === "*" && next === "/") {
                blockComment = false;
                index++;
            }
            continue;
        }

        if (quote !== null) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (current === "\\") {
                escaped = true;
                continue;
            }

            if (current === quote) {
                quote = null;
            }

            continue;
        }

        if (current === "/" && next === "/") {
            lineComment = true;
            index++;
            continue;
        }

        if (current === "/" && next === "*") {
            blockComment = true;
            index++;
            continue;
        }

        if (
            current === '"' ||
            current === "'" ||
            current === "`"
        ) {
            quote = current;
            continue;
        }

        if (current === "[") {
            depth++;
            continue;
        }

        if (current === "]") {
            depth--;

            if (depth === 0) {
                return {
                    openingBracketIndex,
                    closingBracketIndex: index,
                    body: source.slice(
                        openingBracketIndex + 1,
                        index,
                    ),
                };
            }
        }
    }

    throw new Error(
        `Impossibile trovare la chiusura dell'array packages in ` +
        `${workspacePublisherPath}.`,
    );
}

function extractWorkspacePublisherPackages(arrayBody) {
    const entries = [];

    const entryPattern =
        /\{[\s\S]*?name\s*:\s*["']([^"']+)["'][\s\S]*?dir\s*:\s*["']([^"']+)["'][\s\S]*?\}/g;
    entries.push({
        name: match[1],
        dir: normalizePath(match[2]),
    });

    return entries;
}

function removePackageFromPendingList(relativeDir) {
    const normalizedDir = normalizePath(relativeDir);

    const source = readFileSync(scriptPath, "utf8");

    const blockPattern =
        /\/\/ PENDING_PACKAGES_START[\s\S]*?\/\/ PENDING_PACKAGES_END/;

    const match = source.match(blockPattern);

    if (!match) {
        throw new Error(
            "Marker PENDING_PACKAGES_START e " +
            "PENDING_PACKAGES_END non trovati nello script.",
        );
    }

    const currentDirectories = extractPendingDirectories(
        match[0],
    );

    if (!currentDirectories.includes(normalizedDir)) {
        logWarning(
            `${normalizedDir} non e piu presente nella lista di bootstrap.`,
        );
        logInfo(
            "Nessuna modifica al file di bootstrap necessaria.",
        );
        return;
    }

    const remainingDirectories = currentDirectories.filter(
        (directory) => directory !== normalizedDir,
    );

    const replacement = renderPendingPackagesBlock(
        remainingDirectories,
    );

    const updatedSource = source.replace(
        blockPattern,
        replacement,
    );

    writeFileAtomically(
        scriptPath,
        updatedSource,
    );

    logSuccess(
        `${normalizedDir} rimosso dalla lista di bootstrap.`,
    );
    logInfo(
        `Package rimanenti nella lista: ` +
        `${remainingDirectories.length}`,
    );
}

function extractPendingDirectories(block) {
    const arrayMatch = block.match(
        /const\s+pendingPackageDirectories\s*=\s*(\[[\s\S]*?\]);/,
    );

    if (!arrayMatch) {
        throw new Error(
            "Impossibile trovare pendingPackageDirectories tra i marker.",
        );
    }

    let parsed;

    try {
        parsed = JSON.parse(arrayMatch[1]);
    } catch (error) {
        throw new Error(
            "pendingPackageDirectories deve essere un array JSON valido " +
            "con stringhe racchiuse tra virgolette doppie.",
            { cause: error },
        );
    }

    if (
        !Array.isArray(parsed) ||
        parsed.some((value) => typeof value !== "string")
    ) {
        throw new Error(
            "pendingPackageDirectories deve contenere solamente stringhe.",
        );
    }

    return parsed.map(normalizePath);
}

function renderPendingPackagesBlock(directories) {
    const rows = directories.map(
        (directory) => `  ${JSON.stringify(directory)},`,
    );

    return [
        "// PENDING_PACKAGES_START",
        "const pendingPackageDirectories = [",
        ...rows,
        "];",
        "// PENDING_PACKAGES_END",
    ].join("\n");
}

function writeFileAtomically(filePath, content) {
    const fileMode = statSync(filePath).mode;

    const temporaryPath =
        `${filePath}.tmp-${process.pid}-${Date.now()}`;

    try {
        writeFileSync(
            temporaryPath,
            content,
            "utf8",
        );

        chmodSync(
            temporaryPath,
            fileMode,
        );

        renameSync(
            temporaryPath,
            filePath,
        );
    } catch (error) {
        try {
            rmSync(temporaryPath, {
                force: true,
            });
        } catch {
            logWarning(
                `Impossibile eliminare il file temporaneo ${temporaryPath}.`,
            );
        }

        throw new Error(
            `Impossibile aggiornare atomicamente ${filePath}: ` +
            `${error.message}`,
            { cause: error },
        );
    }
}

function sortByWorkspaceDependencies(packages) {
    const packageByName = new Map(
        packages.map((pkg) => [pkg.name, pkg]),
    );

    const dependencyFields = [
        "dependencies",
        "optionalDependencies",
        "peerDependencies",
    ];

    const dependenciesByName = new Map();

    for (const pkg of packages) {
        const dependencies = new Set();

        for (const field of dependencyFields) {
            const declaredDependencies =
                pkg.packageJson[field] ?? {};

            for (const dependencyName of Object.keys(
                declaredDependencies,
            )) {
                if (packageByName.has(dependencyName)) {
                    dependencies.add(dependencyName);
                }
            }
        }

        dependenciesByName.set(
            pkg.name,
            dependencies,
        );
    }

    const ordered = [];
    const visiting = new Set();
    const visited = new Set();

    function visit(pkg) {
        if (visited.has(pkg.name)) {
            return;
        }

        if (visiting.has(pkg.name)) {
            throw new Error(
                `Dipendenza circolare rilevata nella lista di bootstrap: ` +
                `${pkg.name}`,
            );
        }

        visiting.add(pkg.name);

        for (
            const dependencyName of
            dependenciesByName.get(pkg.name) ?? []
        ) {
            visit(packageByName.get(dependencyName));
        }

        visiting.delete(pkg.name);
        visited.add(pkg.name);
        ordered.push(pkg);
    }

    for (const pkg of packages) {
        visit(pkg);
    }

    return ordered;
}

function isPrereleaseVersion(version) {
    return version.includes("-");
}

function readPrereleaseTag(version) {
    const separatorIndex = version.indexOf("-");

    if (separatorIndex === -1) {
        return "latest";
    }

    const prerelease = version.slice(separatorIndex + 1);
    const tag = prerelease.split(".")[0];

    if (!tag) {
        throw new Error(
            `Impossibile ricavare il dist-tag dalla versione ${version}.`,
        );
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tag)) {
        throw new Error(
            `Il dist-tag "${tag}" ricavato dalla versione ` +
            `"${version}" non e valido.`,
        );
    }

    return tag;
}

function shouldUseProvenance() {
    const value = process.env.NPM_CONFIG_PROVENANCE;

    if (value === undefined) {
        return false;
    }

    return value !== "false" && value !== "0";
}

function normalizePath(value) {
    return value
        .replaceAll("\\", "/")
        .replace(/\/+$/, "");
}

function formatBoolean(value) {
    return value ? "si" : "no";
}

function sleep(milliseconds) {
    return new Promise((resolvePromise) => {
        setTimeout(resolvePromise, milliseconds);
    });
}

function printSummary(summary) {
    console.log("");
    logHeader("Riepilogo bootstrap");

    logInfo(
        `Package configurati all'avvio: ${summary.configured}`,
    );
    logInfo(
        `Package pubblicati: ${summary.published.length}`,
    );
    logInfo(
        `Package gia presenti e spostati: ` +
        `${summary.alreadyExisting.length}`,
    );
    logInfo(
        `Package elaborati in dry-run: ${summary.dryRun.length}`,
    );
    logInfo(
        `Package elaborati in stage: ${summary.staged.length}`,
    );
    logInfo(
        `Package falliti: ${summary.failed.length}`,
    );

    printSummaryList(
        "Pubblicati e spostati nel publisher ordinario",
        summary.published,
        "OK",
    );

    printSummaryList(
        "Gia presenti su npm e spostati nel publisher ordinario",
        summary.alreadyExisting,
        "ATTENZIONE",
    );

    printSummaryList(
        "Elaborati in dry-run",
        summary.dryRun,
        "INFO",
    );

    printSummaryList(
        "Elaborati in stage",
        summary.staged,
        "INFO",
    );

    if (summary.failed.length > 0) {
        console.log("");
        console.error("[ERRORE] Package non completati:");

        for (const failure of summary.failed) {
            console.error(
                `  - ${failure.name}@${failure.version}`,
            );
            console.error(
                `    Motivo: ${failure.error}`,
            );
        }

        console.log("");
        logWarning(
            "I package falliti sono rimasti nella lista di bootstrap.",
        );
        logInfo(
            "Correggere gli errori e rieseguire lo script.",
        );
    } else {
        console.log("");
        logSuccess(
            "Elaborazione completata senza errori.",
        );
    }
}

function printSummaryList(title, values, level) {
    if (values.length === 0) {
        return;
    }

    console.log("");
    console.log(`[${level}] ${title}:`);

    for (const value of values) {
        console.log(`  - ${value}`);
    }
}

function logHeader(message) {
    console.log("=".repeat(72));
    console.log(`[BOOTSTRAP] ${message}`);
    console.log("=".repeat(72));
}

function logSection(message) {
    console.log(`--- ${message} ---`);
}

function logStep(message) {
    console.log(`[AZIONE] ${message}`);
}

function logInfo(message) {
    console.log(`[INFO] ${message}`);
}

function logSuccess(message) {
    console.log(`[OK] ${message}`);
}

function logWarning(message) {
    console.warn(`[ATTENZIONE] ${message}`);
}

function logError(message, error) {
    console.error(`[ERRORE] ${message}`);

    if (error) {
        console.error(
            `[ERRORE] Dettaglio: ${error.message ?? String(error)}`,
        );

        if (error.cause?.message) {
            console.error(
                `[ERRORE] Causa: ${error.cause.message}`,
            );
        }
    }
}
