// notify.js -- Notice wrapper (D-14)
//
// The single consolidation point for user-facing messages. All user-facing
// text is Chinese (Phase 8 UX-02 sweep complete).

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
