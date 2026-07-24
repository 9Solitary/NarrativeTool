// status-bar.js -- StatusBarManager for export status feedback
//
// Manages a status bar DOM element that shows export progress and results.
// Supports four states: pending, exporting, success, failure.
//
// 04-02: Batch Export + Status Bar

class StatusBarManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.element = this.plugin.addStatusBarItem();
        this.element.addClass('narrative-project-status');
        this.setState('pending');
    }

    /**
     * Set the status bar display state.
     *
     * @param {'pending'|'exporting'|'success'|'failure'} state - The state to display
     * @param {Object} [data] - State-specific data
     * @param {number} [data.exported] - Number of successfully exported files (success)
     * @param {number} [data.failed] - Number of failed exports (success)
     * @param {number} [data.count] - Current file being processed (exporting)
     * @param {number} [data.total] - Total files to process (exporting)
     * @param {string} [data.message] - Error message (failure)
     */
    setState(state, data) {
        // Remove all state-specific CSS classes
        this.element.removeClass('nt-status-pending');
        this.element.removeClass('nt-status-exporting');
        this.element.removeClass('nt-status-success');
        this.element.removeClass('nt-status-failure');

        switch (state) {
            case 'pending':
                this.element.addClass('nt-status-pending');
                this.element.innerHTML = 'Narrative Toolchain';
                break;

            case 'exporting':
                this.element.addClass('nt-status-exporting');
                if (data && typeof data.count === 'number' && typeof data.total === 'number') {
                    this.element.innerHTML = `Exporting ${data.count}/${data.total}...`;
                } else {
                    this.element.innerHTML = 'Exporting...';
                }
                break;

            case 'success':
                this.element.addClass('nt-status-success');
                if (data && typeof data.exported === 'number') {
                    const failed = (typeof data.failed === 'number') ? data.failed : 0;
                    if (failed > 0) {
                        this.element.innerHTML = `✓ ${data.exported} exported, ${failed} failed`;
                    } else {
                        this.element.innerHTML = `✓ ${data.exported} exported`;
                    }
                } else {
                    this.element.innerHTML = '✓ Export complete';
                }
                break;

            case 'failure':
                this.element.addClass('nt-status-failure');
                if (data && data.message) {
                    this.element.innerHTML = `✗ ${data.message}`;
                } else {
                    this.element.innerHTML = '✗ Export failed';
                }
                break;

            default:
                // Unknown state — fall back to pending
                this.element.addClass('nt-status-pending');
                this.element.innerHTML = 'Narrative Toolchain';
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
