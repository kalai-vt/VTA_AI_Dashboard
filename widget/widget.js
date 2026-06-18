(function () {
  'use strict';

  var config = window.AgentConfig || {};
  var widgetKey = config.widgetKey || '';
  var primaryColor = config.primaryColor || '#3b82f6';
  var apiUrl = config.apiUrl || 'http://localhost:8000';
  var agentName = config.agentName || 'AI Assistant';
  var sessionStorageKey = 'agent_session_' + widgetKey;

  var sessionToken = localStorage.getItem(sessionStorageKey);

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '#ai-widget-btn { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.18); z-index: 99998; transition: transform 0.2s, opacity 0.2s; }',
    '#ai-widget-btn:hover { transform: scale(1.08); }',
    '#ai-widget-panel { position: fixed; bottom: 92px; right: 24px; width: 350px; height: 500px; background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.18); z-index: 99999; display: flex; flex-direction: column; overflow: hidden; transition: opacity 0.2s, transform 0.2s; }',
    '#ai-widget-panel.hidden { opacity: 0; pointer-events: none; transform: translateY(16px); }',
    '#ai-widget-header { padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }',
    '#ai-widget-header-title { color: #fff; font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; font-family: sans-serif; }',
    '#ai-widget-close { background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; font-size: 20px; line-height: 1; padding: 0; display: flex; align-items: center; }',
    '#ai-widget-close:hover { color: #fff; }',
    '#ai-widget-messages { flex: 1; overflow-y: auto; padding: 12px; background: #f8f9fb; display: flex; flex-direction: column; gap: 8px; }',
    '.ai-msg { max-width: 80%; border-radius: 12px; padding: 8px 12px; font-size: 14px; line-height: 1.5; font-family: sans-serif; word-break: break-word; }',
    '.ai-msg.user { align-self: flex-end; color: #fff; border-bottom-right-radius: 4px; }',
    '.ai-msg.bot { align-self: flex-start; background: #fff; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-bottom-left-radius: 4px; }',
    '.ai-typing { align-self: flex-start; background: #fff; border-radius: 12px; border-bottom-left-radius: 4px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; gap: 4px; align-items: center; }',
    '.ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: #aaa; display: inline-block; animation: bounce 1.2s infinite; }',
    '.ai-typing span:nth-child(2) { animation-delay: 0.2s; }',
    '.ai-typing span:nth-child(3) { animation-delay: 0.4s; }',
    '@keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }',
    '#ai-widget-input-row { display: flex; gap: 8px; padding: 10px 12px; background: #fff; border-top: 1px solid #f0f0f0; }',
    '#ai-widget-input { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; font-family: sans-serif; }',
    '#ai-widget-input:focus { border-color: ' + primaryColor + '; }',
    '#ai-widget-send { border: none; border-radius: 8px; cursor: pointer; padding: 8px 14px; color: #fff; font-size: 14px; font-weight: 600; font-family: sans-serif; transition: opacity 0.15s; }',
    '#ai-widget-send:hover { opacity: 0.88; }',
    '@media (max-width: 480px) { #ai-widget-panel { width: 100vw; height: 100vh; bottom: 0; right: 0; border-radius: 0; } #ai-widget-btn { bottom: 16px; right: 16px; } }',
  ].join('\n');
  document.head.appendChild(style);

  // Create button
  var btn = document.createElement('button');
  btn.id = 'ai-widget-btn';
  btn.style.background = primaryColor;
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  document.body.appendChild(btn);

  // Create panel
  var panel = document.createElement('div');
  panel.id = 'ai-widget-panel';
  panel.classList.add('hidden');
  panel.innerHTML = [
    '<div id="ai-widget-header" style="background:' + primaryColor + '">',
    '  <div id="ai-widget-header-title">',
    '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    '    ' + agentName,
    '  </div>',
    '  <button id="ai-widget-close">&#x2715;</button>',
    '</div>',
    '<div id="ai-widget-messages"></div>',
    '<div id="ai-widget-input-row">',
    '  <input id="ai-widget-input" type="text" placeholder="Type a message..." />',
    '  <button id="ai-widget-send" style="background:' + primaryColor + '">Send</button>',
    '</div>',
  ].join('');
  document.body.appendChild(panel);

  var messagesEl = document.getElementById('ai-widget-messages');
  var inputEl = document.getElementById('ai-widget-input');
  var sendBtn = document.getElementById('ai-widget-send');
  var closeBtn = document.getElementById('ai-widget-close');

  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'ai-msg ' + (role === 'user' ? 'user' : 'bot');
    if (role === 'user') div.style.background = primaryColor;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addTyping() {
    var div = document.createElement('div');
    div.className = 'ai-typing';
    div.id = 'ai-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function removeTyping() {
    var el = document.getElementById('ai-typing-indicator');
    if (el) el.remove();
  }

  function generateSessionToken() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    if (!sessionToken) {
      sessionToken = generateSessionToken();
      localStorage.setItem(sessionStorageKey, sessionToken);
    }

    addMessage('user', text);
    var typing = addTyping();

    fetch(apiUrl + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_token: sessionToken, widget_key: widgetKey }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        removeTyping();
        addMessage('bot', data.response || data.message || 'Sorry, I could not process that.');
      })
      .catch(function () {
        removeTyping();
        addMessage('bot', 'Sorry, I am unable to connect right now. Please try again later.');
      });
  }

  btn.addEventListener('click', function () {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && messagesEl.children.length === 0) {
      addMessage('bot', config.welcomeMessage || 'Hello! How can I help you today?');
    }
    if (!panel.classList.contains('hidden')) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', function () {
    panel.classList.add('hidden');
  });

  sendBtn.addEventListener('click', sendMessage);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
