# ADR 0219: A development server answers only its own page and build

Status: Accepted

## Context

Studio and the plain preview each ship a small HTTP server for local development. Both bound to
127.0.0.1 and refused paths that `..` would take out of the app folder. Three gaps remained.

- **Too much was served.** The whole app folder was public: sources, tests, `package.json`, and
  `node_modules`. Under pnpm, `node_modules` holds links into the rest of the workspace.
- **Links were followed.** Containment was checked on the requested path, not on where it leads, so a
  link inside the folder served whatever it pointed at.
- **No Host check.** Binding to the loopback address does not keep out pages the developer has open.
  A hostile site can point its own name at 127.0.0.1 (DNS rebinding) and read the server's responses
  as same-origin.

The plain preview also served `.css` as `application/octet-stream`.

## Decision

Each server answers only `/` (which is `index.html`) and files under `dist/`. A file is served only
when its real location, links followed, lies inside the real `dist`. A request whose `Host` is not
`127.0.0.1:<port>` or `localhost:<port>` gets 421 Misdirected Request. The request handler is
exported, and the server listens only when the file is run directly, so the rules can be tested
without a fixed port.

## Consequences

- A page that loads anything outside `dist` stops working under these servers. Both `index.html`
  files load only `./dist/…`, and the Studio worker and its type assets are bundled into `dist`.
- Opening a server by another name, such as a LAN address or a custom hosts entry, is refused.
  That is the cost of the Host check.
- The two servers stay separate copies. Each app owns its server, and a shared module would couple
  two private apps for about sixty lines.

## Alternatives rejected

- **Bind to loopback only.** That is already the case, and it does not stop DNS rebinding.
- **Keep serving the app root with a deny-list.** Every new folder would be public until someone
  remembered it, so an allow-list of the page and `dist` fails closed instead.

## Verification

`apps/studio/test/a-dev-server-answers-only-its-own.test.mjs` and the same file under
`apps/plain-preview/test/` check four things:

- the page and a build file are served under both of the server's names;
- a foreign `Host` gets 421;
- `package.json`, sources, encoded and plain `..` paths and `/dist` itself get 404;
- a link in `dist` that leads outside it gets 404.

Disabling the Host check, or the realpath containment, turns its test red.

## Security and privacy

This closes source and workspace disclosure to a hostile page through DNS rebinding, and escape
through links. The servers are development tools and are not part of any published package. No
data handling changes.
