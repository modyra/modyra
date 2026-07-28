---
"@modyra/angular": patch
---

Hold the Angular renderers to the runtime DOM contract in TestBed, with the same
`inspectWidgetDom` the Lit and Plain suites use, so all three adapters answer to one gate. Eight
renderers conform with no recorded divergences.
