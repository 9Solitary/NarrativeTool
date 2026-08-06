// modals-prompt-queue.js -- Test double for the './ui/modals' module as seen
// from main.js (WR-03 entity-create tests)
//
// Everything else is the real modals module; only promptForInput is replaced
// with a scripted queue so _createEntityFromCommand can be driven without a
// UI. Tests set the queue via __setPromptQueue([idAnswer, nameAnswer, ...]).

const real = require('../../plugins/narrative-tool/src/ui/modals');

let queue = [];

module.exports = {
    ...real,
    __setPromptQueue(answers) {
        queue = Array.isArray(answers) ? [...answers] : [];
    },
    promptForInput: async () => (queue.length > 0 ? queue.shift() : '')
};
