import { callGemini } from './api-handler.js';

const COMMANDS = Object.freeze([
  { label: '/help', value: '/help', instant: true },
  { label: '/clear', value: '/clear', instant: true },
  { label: 'Analyze Sheet', value: 'Analyze Sheet', instant: false },
  { label: 'Sync Data', value: 'Sync Data', instant: false }
]);

function elements() {
  return {
    form: document.querySelector('#chat-form'),
    input: document.querySelector('#chat-input'),
    log: document.querySelector('#chat-log'),
    chips: document.querySelector('#chat-command-chips')
  };
}

function appendMessage(text, role = 'assistant') {
  const { log } = elements();
  if (!log) return null;
  const element = document.createElement('div');
  element.className = `message ${role}`;
  element.textContent = text;
  log.appendChild(element);
  log.scrollTop = log.scrollHeight;
  return element;
}

function clearConversation() {
  const { log, input } = elements();
  if (log) log.replaceChildren();
  if (input) {
    input.value = '';
    input.focus();
  }
  appendMessage('Conversation cleared.', 'assistant');
}

function showHelp() {
  appendMessage([
    '/help — show available commands',
    '/clear — clear conversation',
    'Analyze Sheet — prepare a spreadsheet analysis request',
    'Sync Data — prepare a synchronization request'
  ].join('\n'), 'assistant');
}

function handleLocalCommand(value) {
  switch (value.trim().toLowerCase()) {
    case '/clear':
      clearConversation();
      return true;
    case '/help':
      showHelp();
      return true;
    default:
      return false;
  }
}

function populateInput(value) {
  const { input } = elements();
  if (!input) return;
  input.value = value;
  input.focus();
  input.setSelectionRange(value.length, value.length);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderChips(chips) {
  chips.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const command of COMMANDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = command.label;
    button.dataset.command = command.value;
    button.dataset.instant = String(command.instant);
    fragment.appendChild(button);
  }
  chips.appendChild(fragment);
}

async function submitMessage(text) {
  const pending = appendMessage('Thinking…', 'assistant');
  try {
    const result = await callGemini({
      contents: [{ role: 'user', parts: [{ text }] }]
    });
    const responseText = result?.text
      || result?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
      || 'No response returned.';
    if (pending) pending.textContent = responseText;
  } catch (error) {
    if (pending) pending.textContent = error?.message || 'The request failed.';
  }
}

export function initChat() {
  const { form, input, chips } = elements();
  if (!form || !input || !chips || form.dataset.chatBound === 'true') return;

  form.dataset.chatBound = 'true';
  renderChips(chips);

  chips.addEventListener('click', event => {
    const button = event.target.closest('[data-command]');
    if (!button) return;
    const value = button.dataset.command || '';
    if (button.dataset.instant === 'true') {
      handleLocalCommand(value);
    } else {
      populateInput(value);
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    if (handleLocalCommand(text)) return;
    appendMessage(text, 'user');
    await submitMessage(text);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

export { appendMessage, clearConversation, populateInput, handleLocalCommand };
