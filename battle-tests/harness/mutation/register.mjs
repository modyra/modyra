/** The resolve hook, in a form `node --import` accepts. */
import { register } from "node:module";

register(new URL("./redirect-hooks.mjs", import.meta.url));
