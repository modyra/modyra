// Jest environment for the Angular package tests: JIT compiler + zoneless
// TestBed (the library itself is zoneless — no zone.js anywhere).
require("@angular/compiler");
const {
  setupZonelessTestEnv,
} = require("jest-preset-angular/setup-env/zoneless");

setupZonelessTestEnv();
