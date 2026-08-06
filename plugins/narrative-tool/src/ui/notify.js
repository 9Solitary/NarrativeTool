// notify.js -- Notice wrapper (D-14)
//
// The single consolidation point for user-facing messages. New messages
// added from Phase 5 onward may use Chinese strings; existing English
// strings are preserved verbatim — the full Chinese sweep is Phase 8.

const { Notice } = require('obsidian');

/**
 * Show a Notice, optionally styled as an error.
 *
 * @param {string} message - Message text
 * @param {'info'|'error'} [type] - 'error' adds the mod-error class; defaults to 'info'
 * @returns {Notice}
 */
function notify(message, type) {
    const notice = new Notice(message);
    if (type === 'error') {
        notice.noticeEl.addClass('mod-error');
    }
    return notice;
}

module.exports = { notify };
