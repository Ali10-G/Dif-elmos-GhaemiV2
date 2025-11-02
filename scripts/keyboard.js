const KEY_LAYOUT = [
  [
    { label: 'dy/dx', value: 'dy/dx', cursorOffset: 0 },
    { label: '=', value: ' = ' },
    { label: '+', value: ' + ' },
    { label: '-', value: ' - ' },
    { label: '×', value: ' * ' },
    { label: '÷', value: ' / ' }
  ],
  [
    { label: 'x', value: 'x' },
    { label: 'y', value: 'y' },
    { label: '^', value: '^' },
    { label: '(', value: '(' },
    { label: ')', value: ')' },
    { label: ',', value: ',' }
  ],
  [
    { label: 'sin', value: 'sin()', cursorOffset: 1 },
    { label: 'cos', value: 'cos()', cursorOffset: 1 },
    { label: 'tan', value: 'tan()', cursorOffset: 1 },
    { label: 'exp', value: 'exp()', cursorOffset: 1 },
    { label: 'ln', value: 'ln()', cursorOffset: 1 },
    { label: '√', value: 'sqrt()', cursorOffset: 1 }
  ],
  [
    { label: 'π', value: 'pi' },
    { label: 'e', value: 'e' },
    { label: '|y|', value: 'abs(y)' },
    { label: 'y′', value: "dy/dx = " },
    { label: '←', value: 'BACKSPACE' }
  ]
];

export function setupVirtualKeyboard(container, target) {
  if (!container || !target) return;
  container.innerHTML = '';
  KEY_LAYOUT.forEach((row) => {
    row.forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'virtual-key';
      button.textContent = key.label;
      button.addEventListener('click', () => {
        handleKeyPress(target, key);
      });
      container.appendChild(button);
    });
  });
}

function handleKeyPress(target, key) {
  if (key.value === 'BACKSPACE') {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start === end && start > 0) {
      const before = target.value.slice(0, start - 1);
      const after = target.value.slice(end);
      target.value = before + after;
      setSelection(target, start - 1);
    } else {
      const before = target.value.slice(0, start);
      const after = target.value.slice(end);
      target.value = before + after;
      setSelection(target, start);
    }
    dispatchInput(target);
    return;
  }
  insertText(target, key.value, key.cursorOffset || 0);
}

function insertText(target, text, cursorOffset) {
  const start = target.selectionStart;
  const end = target.selectionEnd;
  const before = target.value.slice(0, start);
  const after = target.value.slice(end);
  target.value = `${before}${text}${after}`;
  const newPosition = start + text.length - (cursorOffset || 0);
  setSelection(target, newPosition);
  dispatchInput(target);
}

function setSelection(target, position) {
  target.focus();
  target.selectionStart = position;
  target.selectionEnd = position;
}

function dispatchInput(target) {
  const event = new Event('input', { bubbles: true });
  target.dispatchEvent(event);
}
