# Final Review UI Runtime Wiring

This PR wires the Workbench and Final Review UI to the Final Review runtime.

- Workbench decisions capture selected text, source excerpt, and source location snapshots.
- Final Review Apply calls the apply endpoint.
- Final Review export controls link to clean, marked, and changelog TXT exports.

The apply runtime still blocks safely if a snapshot is missing or no longer matches the source manuscript version.
