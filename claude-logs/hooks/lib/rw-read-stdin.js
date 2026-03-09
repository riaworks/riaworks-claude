'use strict';

/**
 * Shared stdin reader for Claude Code hooks.
 * Handles Windows path backslash sanitization.
 *
 * @module riaworks/lib/rw-read-stdin
 */

/**
 * Sanitize raw JSON for Windows unescaped backslashes in paths.
 * Claude Code intermittently sends unescaped backslashes in cwd on Windows.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeJsonString(raw) {
  return raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

/**
 * Read all data from stdin as a JSON object.
 * Double try-catch: normal parse first, sanitized fallback for Windows.
 * @returns {Promise<object>}
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('error', (e) => reject(e));
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (_) {
        try {
          resolve(JSON.parse(sanitizeJsonString(data)));
        } catch (e2) {
          reject(e2);
        }
      }
    });
  });
}

module.exports = { readStdin, sanitizeJsonString };
