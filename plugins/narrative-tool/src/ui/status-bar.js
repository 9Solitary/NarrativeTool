// status-bar.js -- StatusBarManager for export status feedback
//
// Manages a status bar DOM element that shows export progress and results.
// Supports five states: pending, exporting, success, failure, diagnostic.
//
// 'diagnostic' is the persistent red-lint state: shown while the last export
// produced error-level diagnostics, it does NOT auto-revert (success reverts
// after 5s) and clicking the item opens the WarningsModal with the full list.
//
// 04-02: Batch Export + Status Bar

const { WarningsModal } = require('./warnings-modal');

class StatusBarManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.element = this.plugin.addStatusBarItem();
        this.element.addClass('narrative-tool-status');
        this._diagnostics = [];
        this.element.addEventListener('click', () => {
            if (this._diagnostics.length > 0) {
                new WarningsModal(this.plugin.app, this._diagnostics).open();
            }
        });
        this.setState('pending');
    }

    /**
     * Store the latest diagnostics list and refresh the clickable affordance.
     * An empty array clears the list (status bar no longer opens the modal).
     *
     * @param {Array<{level: string, text: string}>} entries
     */
    setDiagnostics(entries) {
        this._diagnostics = Array.isArray(entries) ? entries : [];
        this.element.toggleClass('is-clickable', this._diagnostics.length > 0);
    }

    /**
     * Current diagnostics list (read-only copy).
     *
     * @returns {Array<{level: string, text: string}>}
     */
    getDiagnostics() {
        return this._diagnostics.slice();
    }

    /**
     * Set the status bar display state.
     *
     * @param {'pending'|'exporting'|'success'|'failure'|'diagnostic'} state - The state to display
     * @param {Object} [data] - State-specific data
     * @param {number} [data.exported] - Number of successfully exported files (success)
     * @param {number} [data.failed] - Number of failed exports (success)
     * @param {number} [data.count] - Current file being processed (exporting)
     * @param {number} [data.total] - Total files to process (exporting)
     * @param {string} [data.message] - Error message (failure)
     * @param {number} [data.errors] - Number of red diagnostics (diagnostic)
     * @param {number} [data.warns] - Number of yellow diagnostics (diagnostic)
     */
    setState(state, data) {
        // Remove all state-specific CSS classes
        this.element.removeClass('nt-status-pending');
        this.element.removeClass('nt-status-exporting');
        this.element.removeClass('nt-status-success');
        this.element.removeClass('nt-status-failure');
        this.element.removeClass('nt-status-diagnostic');

        switch (state) {
            case 'pending':
                this.element.addClass('nt-status-pending');
                this.element.innerHTML = '叙事工具链';
                break;

            case 'exporting':
                this.element.addClass('nt-status-exporting');
                if (data && typeof data.count === 'number' && typeof data.total === 'number') {
                    this.element.innerHTML = `导出中 ${data.count}/${data.total}...`;
                } else {
                    this.element.innerHTML = '导出中...';
                }
                break;

            case 'success':
                this.element.addClass('nt-status-success');
                if (data && typeof data.exported === 'number') {
                    const failed = (typeof data.failed === 'number') ? data.failed : 0;
                    if (failed > 0) {
                        this.element.innerHTML = `✓ 已导出 ${data.exported} 个，${failed} 个失败`;
                    } else {
                        this.element.innerHTML = `✓ 已导出 ${data.exported} 个`;
                    }
                } else {
                    this.element.innerHTML = '✓ 导出完成';
                }
                break;

            case 'failure':
                this.element.addClass('nt-status-failure');
                if (data && data.message) {
                    this.element.innerHTML = `✗ ${data.message}`;
                } else {
                    this.element.innerHTML = '✗ 导出失败';
                }
                break;

            case 'diagnostic': {
                // Persistent red-lint state — no auto-revert; click to inspect.
                this.element.addClass('nt-status-diagnostic');
                const errors = data && typeof data.errors === 'number' ? data.errors : 0;
                const warns = data && typeof data.warns === 'number' ? data.warns : 0;
                let text = `✗ ${errors} 条导出错误`;
                if (warns > 0) text += `，${warns} 条警告`;
                this.element.innerHTML = text + '（点击查看）';
                break;
            }

            default:
                // Unknown state — fall back to pending
                this.element.addClass('nt-status-pending');
                this.element.innerHTML = '叙事工具链';
                break;
        }
    }

    /**
     * Remove the status bar element from the DOM.
     */
    destroy() {
        this.element.remove();
    }
}

module.exports = { StatusBarManager };
