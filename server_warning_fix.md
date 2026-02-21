# Server Console Warning Fix

## Identified Issue
The server was logging `Warning: TT: undefined function: 32` to the console. This is a known issue with the `pdf-parse` library (and its underlying `pdf.js` engine) when encountering certain TrueType font features in PDF files. It is a harmless warning but creates noise in the logs.

## Actions Taken
-   Modified `server/src/services/file.service.ts` to intercept `console.log` and `console.warn` calls during PDF text extraction.
-   Specifically suppressed messages containing `Warning: TT: undefined function: 32`.
-   Ensured that all other log messages are passed through to the original console methods.
-   Guaranteed restoration of original console methods using a `finally` block, even if PDF parsing fails.

## Verification
-   The server code compiles successfully.
-   The warning should no longer appear in the server console when processing PDF files.
