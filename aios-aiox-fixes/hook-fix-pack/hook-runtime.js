'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULT_STALE_TTL_HOURS = 168; // 7 days

/**
 * Append a log entry to .logs/hooks.log (fire-and-forget).
 * Creates .logs/ directory if it doesn't exist.
 *
 * @param {string} cwd - Project root
 * @param {string} level - LOG level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 */
function hookLog(cwd, level, message) {
  try {
    const logsDir = path.join(cwd, '.logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      const gitignorePath = path.join(logsDir, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
      }
    }
    const logFile = path.join(logsDir, 'hooks.log');
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_) {
    // Fire-and-forget — never block hook execution
  }
}

const ORPHAN_TMP_MIN_AGE_MS = 60 * 1000; // 60 seconds

/**
 * Clean orphaned .tmp files from the sessions directory.
 * These are leftovers from atomic-write operations that crashed
 * between write-to-tmp and rename-to-target.
 * Only deletes files older than ORPHAN_TMP_MIN_AGE_MS to avoid
 * removing temp files still in use by concurrent atomic writers.
 *
 * @param {string} sessionsDir - Path to .synapse/sessions/
 * @returns {number} Number of files removed
 */
function cleanOrphanTmpFiles(sessionsDir) {
  try {
    const files = fs.readdirSync(sessionsDir);
    let removed = 0;
    for (const f of files) {
      if (/\.tmp\./.test(f)) {
        const filePath = path.join(sessionsDir, f);
        try {
          const stat = fs.statSync(filePath);
          if ((Date.now() - stat.mtimeMs) < ORPHAN_TMP_MIN_AGE_MS) continue;
          fs.unlinkSync(filePath);
          removed++;
        } catch (_) { /* locked/permissions/stat failure — skip */ }
      }
    }
    return removed;
  } catch (_) { return 0; }
}

/**
 * Read stale session TTL from core-config.yaml.
 * Falls back to DEFAULT_STALE_TTL_HOURS (168h = 7 days).
 *
 * @param {string} cwd - Working directory
 * @returns {number} TTL in hours
 */
function getStaleSessionTTL(cwd) {
  try {
    const yaml = require('js-yaml');
    const configPath = path.join(cwd, '.aios-core', 'core-config.yaml');
    if (!fs.existsSync(configPath)) return DEFAULT_STALE_TTL_HOURS;
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const ttl = config && config.synapse && config.synapse.session && config.synapse.session.staleTTLHours;
    return typeof ttl === 'number' && ttl > 0 ? ttl : DEFAULT_STALE_TTL_HOURS;
  } catch (_err) {
    return DEFAULT_STALE_TTL_HOURS;
  }
}

/**
 * Resolve runtime dependencies for Synapse hook execution.
 *
 * On the first prompt of a session:
 * - Creates the session file via createSession() if it does not exist (BUG-FIX)
 * - Runs cleanStaleSessions() fire-and-forget to remove expired sessions
 *
 * BUG-FIX: Prior to this fix, loadSession() returned null for new sessions
 * and the fallback `{ prompt_count: 0 }` was an in-memory-only object.
 * updateSession() in synapse-engine.cjs then called loadSession() internally,
 * got null again, and returned null — so the session was NEVER persisted.
 * Fix: call createSession() when loadSession() returns null.
 *
 * @param {{cwd?: string, session_id?: string, sessionId?: string}} input
 * @returns {{
 *   engine: import('../engine').SynapseEngine,
 *   session: Object,
 *   sessionId: string,
 *   sessionsDir: string,
 *   cwd: string
 * } | null}
 */
function resolveHookRuntime(input) {
  const cwd = input && input.cwd;
  const sessionId = input && (input.session_id || input.sessionId);
  if (!cwd || typeof cwd !== 'string') return null;

  const synapsePath = path.join(cwd, '.synapse');
  if (!fs.existsSync(synapsePath)) {
    hookLog(cwd, 'INFO', 'No .synapse/ directory — skipping hook');
    return null;
  }

  try {
    const { loadSession, createSession, cleanStaleSessions } = require(
      path.join(cwd, '.aios-core', 'core', 'synapse', 'session', 'session-manager.js'),
    );
    const { SynapseEngine } = require(
      path.join(cwd, '.aios-core', 'core', 'synapse', 'engine.js'),
    );

    const sessionsDir = path.join(synapsePath, 'sessions');

    // BUG-FIX: Create session file on first prompt if it doesn't exist.
    // Without this, updateSession() in synapse-engine.cjs silently fails
    // because it calls loadSession() internally which returns null.
    let session = loadSession(sessionId, sessionsDir);
    if (!session && sessionId) {
      session = createSession(sessionId, cwd, sessionsDir);
      hookLog(cwd, 'INFO', `Session created: ${sessionId}`);
    }
    if (!session) {
      session = { prompt_count: 0 };
    }

    const engine = new SynapseEngine(synapsePath);

    // Cleanup on first prompt only (fire-and-forget)
    if (session.prompt_count === 0) {
      try {
        const ttlHours = getStaleSessionTTL(cwd);
        const removed = cleanStaleSessions(sessionsDir, ttlHours);
        if (removed > 0) {
          hookLog(cwd, 'INFO', `Cleaned ${removed} stale session(s) (TTL: ${ttlHours}h)`);
        }
      } catch (_cleanupErr) {
        // Fire-and-forget: never block hook execution
      }

      // Clean orphaned .tmp files from atomic-write crashes
      try {
        const tmpRemoved = cleanOrphanTmpFiles(sessionsDir);
        if (tmpRemoved > 0) {
          hookLog(cwd, 'INFO', `Cleaned ${tmpRemoved} orphaned .tmp file(s)`);
        }
      } catch (_tmpErr) {
        // Fire-and-forget: never block hook execution
      }
    }

    hookLog(cwd, 'INFO', `Runtime resolved — session=${sessionId}, prompt_count=${session.prompt_count}, bracket=${session.context?.last_bracket || 'FRESH'}`);

    return { engine, session, sessionId, sessionsDir, cwd };
  } catch (error) {
    hookLog(cwd, 'ERROR', `Failed to resolve runtime: ${error.message}`);
    return null;
  }
}

/**
 * Normalize hook output payload shape.
 * CRITICAL: hookEventName is REQUIRED — without it Claude Code rejects the output.
 * @param {string} xml
 * @returns {{hookSpecificOutput: {hookEventName: string, additionalContext: string}}}
 */
function buildHookOutput(xml) {
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: xml || '',
    },
  };
}

module.exports = {
  resolveHookRuntime,
  buildHookOutput,
  hookLog,
};
