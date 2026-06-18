(function () {
  var config = window.AgentConfig || {};
  var widgetKey = config.widgetKey || '';
  var primaryColor = config.primaryColor || '#2563eb';
  var apiUrl = config.apiUrl || 'http://localhost:8000';
  var sessionKey = 'agent_session_' + widgetKey;
  var sessionToken = localStorage.getItem(sessionKey) || null;
  var isOpen = false;

  // Inject styles
  var style = document.createElement('style');
  style.textContent = [
    '.ag-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:' + primaryColor + ';border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform .2s;}',
    '.ag-btn:hover{transform:scale(1.08);}',
    '.ag-btn svg{width:28px;height:28px;fill:#fff;}',
    '.ag-panel{position:fixed;bottom:92px;right:24px;width:350px;height:500px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.15);display:none;flex-direction:column;z-index:9998;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.ag-panel.open{display:flex;}',
    '.ag-header{background:' + primaryColor + ';color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between;}',
    '.ag-header-title{font-size:15px;font-weight:600;}',
    '.ag-header-sub{font-size:11px;opacity:.85;margin-top:2px;}',
    '.ag-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0;}',
    '.ag-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}',
    '.ag-msg{max-width:80%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word;}',
    '.ag-msg.user{align-self:flex-end;background:' + primaryColor + ';color:#fff;border-bottom-right-radius:4px;}',
    '.ag-msg.bot{align-self:flex-start;background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px;}',
    '.ag-typing{align-self:flex-start;background:#f1f5f9;padding:10px 14px;border-radius:12px;border-bottom-left-radius:4px;display:flex;gap:4px;align-items:center;}',
    '.ag-dot{width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:ag-bounce .8s infinite;}',
    '.ag-dot:nth-child(2){animation-delay:.15s;}',
    '.ag-dot:nth-child(3){animation-delay:.3s;}',
    '@keyframes ag-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
    '.ag-footer{padding:10px 12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;}',
    '.ag-input{flex:1;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:inherit;}',
    '.ag-input:focus{border-color:' + primaryColor + ';}',
    '.ag-send{background:' + primaryColor + ';color:#fff;border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '.ag-send:disabled{opacity:.5;cursor:default;}',
    '@media(max-width:480px){.ag-panel{width:100vw;height:100vh;bottom:0;right:0;border-radius:0;}.ag-btn{bottom:16px;right:16px;}}'
  ].join('');
  document.head.appendChild(style);

  // Chat button
  var btn = document.createElement('button');
  btn.className = 'ag-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
  document.body.appendChild(btn);

  // Chat panel
  var panel = document.createElement('div');
  panel.className = 'ag-panel';
  panel.innerHTML = [
    '<div class="ag-header">',
    '  <div><div class="ag-header-title">AI Assistant</div><div class="ag-header-sub">Online &bull; Replies instantly</div></div>',
    '  <button class="ag-close" id="ag-close-btn">&times;</button>',
    '</div>',
    '<div class="ag-messages" id="ag-messages"></div>',
    '<div class="ag-footer">',
    '  <input class="ag-input" id="ag-input" type="text" placeholder="Type your message..." />',
    '  <button class="ag-send" id="ag-send-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);

  var messagesEl = document.getElementById('ag-messages');
  var inputEl = document.getElementById('ag-input');
  var sendBtn = document.getElementById('ag-send-btn');

  function addMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'ag-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'ag-typing';
    div.id = 'ag-typing';
    div.innerHTML = '<div class="ag-dot"></div><div class="ag-dot"></div><div class="ag-dot"></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('ag-typing');
    if (el) el.remove();
  }

  async function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    addMessage('user', text);
    showTyping();
    try {
      var res = await fetch(apiUrl + '/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_token: sessionToken, widget_key: widgetKey })
      });
      var data = await res.json();
      hideTyping();
      if (data.session_token) {
        sessionToken = data.session_token;
        localStorage.setItem(sessionKey, sessionToken);
      }
      addMessage('bot', data.response || 'Sorry, I could not process that.');
    } catch (e) {
      hideTyping();
      addMessage('bot', 'Sorry, I am having trouble connecting. Please try again.');
    }
    sendBtn.disabled = false;
    inputEl.focus();
  }

  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen && messagesEl.children.length === 0) {
      addMessage('bot', 'Hello! How can I help you today?');
    }
    if (isOpen) inputEl.focus();
  });

  document.getElementById('ag-close-btn').addEventListener('click', function () {
    isOpen = false;
    panel.classList.remove('open');
  });

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
