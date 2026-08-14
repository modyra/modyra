/**
 * A drag that reports itself live and is bound to nothing.
 *
 * `createPointerDrag` resolves the document it listens on **once, at construction**:
 * `options.document ?? (typeof document === "undefined" ? undefined : document)`. If there is no
 * document at that moment the target is `undefined` for the lifetime of the drag, and `bind()`
 * returns immediately every time it is called.
 *
 * `start()` still sets `dragging` to true. So the public state says an interaction is in progress
 * while no listener exists to end it: no move reaches `onMove`, no release reaches `onEnd`, and
 * `stop()` is the only thing that can ever clear it. A slider built in that window is not slow or
 * intermittent — it never drags at all, and reports that it is dragging.
 *
 * The window is real for the same reason `browserRuntimeCapabilities` probes on every call rather
 * than once at module scope: the same module is evaluated where there is no DOM and used after one
 * exists. That function was written to answer about the process it is asked in; this one answers
 * about the process it was built in.
 *
 * `options.document` widens rather than closes the window — it exists for a host living in another
 * document, an iframe or a popup window, which is exactly where the document a controller needs may
 * not exist yet when the controller is made.
 *
 * Resolving the target inside `bind()` costs nothing: it is already a function called at `start()`,
 * which is the moment a document is needed and the moment one exists.
 */

import { createPointerDrag } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/** Send a mouse gesture through a document, the way a browser does. */
function gesture(dom) {
  const view = dom.document.defaultView;
  dom.document.dispatchEvent(new view.MouseEvent("mousemove", { clientX: 10, clientY: 20 }));
  dom.document.dispatchEvent(new view.MouseEvent("mouseup", {}));
}

battle(
  {
    claims: ["SSR-001"],
    title: "a drag built before the document is still a drag once there is one",
    environments: ["node"],
  },
  async (ctx) => {
    // Built where there is no DOM, which is where a server render and the first half of a
    // hydration both are.
    const observed = [];
    const drag = createPointerDrag({
      onMove: (point) => observed.push(point),
      onEnd: () => observed.push("end"),
    });

    const dom = installDocument();
    try {
      drag.start();
      gesture(dom);
      ctx.log.note("a drag started after the document arrived", {
        dragging: drag.dragging,
        observed,
      });

      expectClaim(observed.length > 0, {
        claimIds: ["SSR-001"],
        what: "a drag built before the document existed never sees a pointer, so it can never move or end",
        detail: JSON.stringify({ dragging: drag.dragging, observed }),
      });

      // And the half that makes it silent rather than merely broken: the state says otherwise.
      expectEqual(drag.dragging, false, {
        claimIds: ["SSR-001"],
        what: "the drag reports itself live after a release it could not have heard",
        detail: JSON.stringify({ dragging: drag.dragging, observed }),
      });
    } finally {
      drag.stop();
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["SSR-001"],
    title: "a drag built where there is a document works, and stops when it should",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      // The control: everything above is about *when* the drag was built, so the same drag built
      // inside the document must do all of it.
      const observed = [];
      const drag = createPointerDrag({
        onMove: (point) => observed.push(point),
        onEnd: () => observed.push("end"),
      });

      drag.start();
      gesture(dom);
      ctx.log.note("a drag built and started inside a document", { dragging: drag.dragging, observed });

      expectEqual(observed, [{ clientX: 10, clientY: 20 }, "end"], {
        claimIds: ["SSR-001"],
        what: "a drag built inside a document did not see the gesture",
        detail: JSON.stringify(observed),
      });

      expectEqual(drag.dragging, false, {
        claimIds: ["SSR-001"],
        what: "a drag that ended still reports itself live",
      });

      // And nothing after the release, so the listeners really came off rather than the end
      // callback simply firing once.
      const after = observed.length;
      gesture(dom);
      expectEqual(observed.length, after, {
        claimIds: ["SSR-001"],
        what: "a finished drag is still listening to the document",
        detail: JSON.stringify(observed),
      });
    } finally {
      dom.restore();
    }
  },
);
