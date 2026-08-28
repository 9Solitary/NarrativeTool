// speaker-autocomplete.js — 说话人输入自动补全（Phase 11 M2b, NG-07）
//
// 薄 DOM 层：挂在 editor.js 的 Dialog 说话人 input 上。候选来自
// speakers.js 的共享角色表（getSpeakers() → [{ id, name }]）。
// 自由文本始终合法——补全只是加速输入，不限制取值。
//
// 交互：
//   - input 事件：按 name 子串过滤（大小写不敏感，最多 8 条）
//   - ArrowUp/Down 移动高亮，Enter 选中（阻止冒泡，避免触发宿主提交）
//   - Escape 关闭下拉（仅当下拉开着时阻止冒泡，避免误关整个编辑器）
//   - 选项 mousedown 选中（先于 blur 触发），blur 关闭

/**
 * 给说话人 input 挂自动补全下拉。
 *
 * @param {HTMLInputElement} input - 宿主说话人输入框
 * @param {() => Array<{id: string, name: string}>} getSpeakers - 候选查询
 */
function attachSpeakerAutocomplete(input, getSpeakers) {
    const dropdown = document.createElement('div');
    dropdown.className = 'ng-ac';
    dropdown.style.display = 'none';
    // 挂在 input 的父容器上（turn-row 需 position:relative 定位）
    (input.parentElement || input).appendChild(dropdown);

    let items = [];
    let activeIndex = -1;
    let open = false;

    function close() {
        open = false;
        activeIndex = -1;
        dropdown.style.display = 'none';
    }

    function apply(item) {
        input.value = item.name;
        close();
    }

    function highlight() {
        const children = dropdown.children;
        for (let i = 0; i < children.length; i++) {
            children[i].classList.toggle('ng-ac__item--active', i === activeIndex);
        }
    }

    function refresh() {
        const query = input.value.trim().toLowerCase();
        const speakers = (getSpeakers ? getSpeakers() : []) || [];
        items = [];
        for (const speaker of speakers) {
            if (!speaker || !speaker.name) continue;
            if (query && speaker.name.toLowerCase().indexOf(query) === -1) continue;
            items.push(speaker);
            if (items.length >= 8) break;
        }
        if (items.length === 0) {
            close();
            return;
        }
        dropdown.textContent = '';
        items.forEach((speaker, index) => {
            const option = document.createElement('div');
            option.className = 'ng-ac__item';
            option.textContent = speaker.name;
            option.addEventListener('mousedown', (evt) => {
                evt.preventDefault(); // 不让 input blur 抢先关闭
                apply(speaker);
            });
            dropdown.appendChild(option);
        });
        activeIndex = -1;
        open = true;
        dropdown.style.display = '';
        highlight();
    }

    input.addEventListener('input', refresh);
    input.addEventListener('focus', refresh);
    input.addEventListener('blur', close);

    input.addEventListener('keydown', (evt) => {
        if (!open) return;
        if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
            evt.preventDefault();
            evt.stopPropagation();
            const delta = evt.key === 'ArrowDown' ? 1 : -1;
            activeIndex = (activeIndex + delta + items.length) % items.length;
            highlight();
        } else if (evt.key === 'Enter') {
            if (activeIndex >= 0 && items[activeIndex]) {
                evt.preventDefault();
                evt.stopPropagation();
                apply(items[activeIndex]);
            }
            // 无高亮时不拦截 Enter，让宿主照常处理
        } else if (evt.key === 'Escape') {
            evt.preventDefault();
            evt.stopPropagation();
            close();
        }
    });
}

module.exports = { attachSpeakerAutocomplete };
