/**
 * The difference between a field nobody may change and a field nobody is asking about.
 *
 * Read-only and disabled look alike on screen and mean opposite things at the boundary. A read-only
 * field is part of the answer — a reference the server needs, a total the form computed, a value the
 * user may read and copy — and it is **sent**. A disabled field is out of the question entirely and
 * is **not**: the mount options say so in those words, that the submitted value is partial and any
 * field may be disabled at runtime.
 *
 * Getting it backwards is silent in both directions. A read-only field dropped from the payload is a
 * value the server was expecting and did not get; a disabled one included is a value the application
 * decided not to ask about, sent anyway.
 *
 * Both renderers are asked the same way — programmatically, so the question is what a form sends and
 * not whether a page offered to send it, which has its own specs.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a locked field is sent and a field out of play is not, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("s", [
          { name: "kept", kind: "text", label: "Kept", initialValue: "K" },
          { name: "locked", kind: "text", label: "Locked", initialValue: "L" },
          { name: "off", kind: "text", label: "Off", initialValue: "O" },
        ]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    // The control: with nothing applied, all three are in the answer. Otherwise "locked is there"
    // could be true of a form that sends everything regardless.
    await page.evaluate(({ api }) => (window as never as Record<string, { submit(i: string): Promise<number> }>)[api].submit("s"), { api: host.api });
    await page.waitForTimeout(320);

    const first = await page.evaluate(({ api }) =>
      (window as never as Record<string, { submittedBy(i: string): unknown[] }>)[api].submittedBy("s"), { api: host.api });
    expect(first.at(-1), "a form with nothing applied did not send all three fields")
      .toEqual({ kept: "K", locked: "L", off: "O" });

    await page.evaluate(({ api }) => {
      const battle = window as never as Record<string, { readonly(i: string, p: string): void; disable(i: string, p: string): void }>;
      battle[api].readonly("s", "locked");
      battle[api].disable("s", "off");
    }, { api: host.api });
    await page.waitForTimeout(340);

    await page.evaluate(({ api }) => (window as never as Record<string, { submit(i: string): Promise<number> }>)[api].submit("s"), { api: host.api });
    await page.waitForTimeout(340);

    const sent = await page.evaluate(({ api }) =>
      (window as never as Record<string, { submittedBy(i: string): unknown[] }>)[api].submittedBy("s"), { api: host.api });

    expect(
      sent.at(-1),
      "a read-only field was dropped from the answer, or a disabled one was sent in it",
    ).toEqual({ kept: "K", locked: "L" });
  });
}
