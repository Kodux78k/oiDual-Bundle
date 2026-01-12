<!-- BEGIN: Dual Infodose — OpenRouter / LocalStorage Sync Patch (single copy) -->
  <script>
  (function(){
    function chatSyncOnStorage() {
      try {
        if (typeof apiKey !== 'undefined') {
          const newKey = localStorage.getItem('di_apiKey') || '';
          if (newKey && newKey !== apiKey) {
            apiKey = newKey;
            const keyEl = document.getElementById('apiKeyInput');
            if (keyEl) keyEl.value = apiKey;
          }
        }

        if (typeof modelName !== 'undefined') {
          const newModel = localStorage.getItem('di_modelName') || '';
          if (newModel && newModel !== modelName) {
            modelName = newModel;
            const mEl = document.getElementById('modelInput');
            if (mEl) mEl.value = modelName;
          }
        }

        if (typeof training !== 'undefined') {
          const t = localStorage.getItem('di_trainingText');
          if (t && training !== t) {
            training = t;
            const fname = localStorage.getItem('di_trainingFileName') || '';
            const fEl = document.getElementById('trainingFileName');
            if (fEl && fname) fEl.innerText = fname;
          }
        }

        if (typeof userName !== 'undefined')
          userName = localStorage.getItem('di_userName') || '';

        if (typeof infodoseName !== 'undefined')
          infodoseName = localStorage.getItem('di_infodoseName') || '';

        const dispU = document.getElementById('displayUser');
        const dispI = document.getElementById('displayInfodose');

        if (dispU) dispU.innerText = 'User: ' + (userName || '—');
        if (dispI) dispI.innerText = 'Infodose: ' + (infodoseName || '—');

      } catch (e) {
        console.warn('[Dual Sync] chatSync error', e);
      }
    }

    function cardImportDiApiKey() {
      try {
        if (typeof STATE === 'undefined' || !Array.isArray(STATE.keys)) return;
        const sk = localStorage.getItem('di_apiKey');
        const model = localStorage.getItem('di_modelName') || '';
        if (!sk) return;
        let key = STATE.keys.find(k => k.token === sk);
        if (!key) {
          STATE.keys.forEach(k => k.active = false);
          STATE.keys.unshift({
            id: 'import-' + Date.now(),
            name: 'Imported-SK',
            token: sk,
            model: model,
            webhook: '',
            active: true
          });
        } else {
          STATE.keys.forEach(k => k.active = (k.token === sk));
        }
        if (typeof saveData === 'function') saveData();
        if (typeof renderKeysList === 'function') renderKeysList();
        if (typeof updateInterface === 'function') updateInterface(STATE.user);
      } catch (e) {
        console.warn('[Dual Sync] cardImport error', e);
      }
    }

    try {
      if (typeof window.setActiveKey === 'function') {
        const original = window.setActiveKey.bind(window);
        window.setActiveKey = function(id) {
          original(id);
          try {
            const active = STATE?.keys?.find(k => k.active);
            if (active?.token) {
              localStorage.setItem('di_apiKey', active.token);
              if (active.model) localStorage.setItem('di_modelName', active.model);
            }
          } catch(e){}
        };
      }
    } catch(e){}

    window.addEventListener('storage', (e) => {
      const keys = [
        'di_apiKey',
        'di_modelName',
        'di_trainingText',
        'di_trainingFileName',
        'di_userName',
        'di_infodoseName',
        'di_assistantEnabled',
        'di_trainingActive'
      ];
      if (keys.includes(e.key)) {
        chatSyncOnStorage();
        cardImportDiApiKey();
      }
    });

    setTimeout(() => {
      chatSyncOnStorage();
      cardImportDiApiKey();
    }, 80);

  })();
  </script>
  <!-- END: Dual Infodose Sync Patch -->
  <!-- Scripts: Fusion HUD (keeps functions needed by sync patch) -->
  <script>
    lucide.createIcons();

    // ELEMENT REFERENCES
    const els = {
      card: document.getElementById('mainCard'),
      header: document.getElementById('cardHeader'),
      avatarTgt: document.getElementById('avatarTarget'),
      input: document.getElementById('inputUser'),
      lblHello: document.getElementById('lblHello'),
      lblName: document.getElementById('lblName'),
      clock: document.getElementById('clockTime'),
      smallPreview: document.getElementById('smallPreview'),
      smallMiniAvatar: document.getElementById('smallMiniAvatar'),
      smallText: document.getElementById('smallText'),
      smallIdent: document.getElementById('smallIdent'),
      actCard: document.getElementById('activationCard'),
      actPre: document.getElementById('actPre'),
      actName: document.getElementById('actName'),
      actMiniAvatar: document.getElementById('actMiniAvatar'),
      actBadge: document.getElementById('actBadge'),
      securityStatus: document.getElementById('securityStatus'),
      // Keys UI
      keysModal: document.getElementById('keysModal'),
      keyList: document.getElementById('keyList'),
      keyName: document.getElementById('keyNameInput'),
      keyToken: document.getElementById('keyTokenInput'),
      keyWebhook: document.getElementById('keyWebhookInput'),
      addKeyBtn: document.getElementById('addKeyBtn'),
      closeKeysBtn: document.getElementById('closeKeysBtn'),
      testWebhookBtn: document.getElementById('testWebhookBtn'),
      exportKeysBtn: document.getElementById('exportKeysBtn'),
      importKeysBtn: document.getElementById('importKeysBtn'),
      importFileInput: document.getElementById('importFileInput'),
      lockVaultBtn: document.getElementById('lockVaultBtn'),
      vaultStatusText: document.getElementById('vaultStatusText'),
      // Vault UI
      vaultModal: document.getElementById('vaultModal'),
      vaultPass: document.getElementById('vaultPassInput'),
      vaultUnlock: document.getElementById('vaultUnlockBtn'),
      vaultCancel: document.getElementById('vaultCancelBtn')
    };

    // --- CRYPTO UTILS (AES-GCM) ---
    const CRYPTO = {
      algo: { name: 'AES-GCM', length: 256 },
      pbkdf2: { name: 'PBKDF2', hash: 'SHA-256', iterations: 100000 },
      salt: window.crypto.getRandomValues(new Uint8Array(16)),
      async getKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
        return window.crypto.subtle.deriveKey({ ...this.pbkdf2, salt: salt }, keyMaterial, this.algo, false, ["encrypt", "decrypt"]);
      },
      async encrypt(data, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await this.getKey(password, salt);
        const encoded = new TextEncoder().encode(JSON.stringify(data));
        const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
        const bundle = { s: Array.from(salt), iv: Array.from(iv), d: Array.from(new Uint8Array(encrypted)) };
        return JSON.stringify(bundle);
      },
      async decrypt(bundleStr, password) {
        try {
          const bundle = JSON.parse(bundleStr);
          const salt = new Uint8Array(bundle.s);
          const iv = new Uint8Array(bundle.iv);
          const data = new Uint8Array(bundle.d);
          const key = await this.getKey(password, salt);
          const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
          return JSON.parse(new TextDecoder().decode(decrypted));
        } catch(e) { throw new Error("Senha incorreta ou dados corrompidos"); }
      }
    };

    // --- STATE & STORAGE ---
    const STORAGE_KEY = 'fusion_os_data_v2';
    let STATE = {
      keys: [],
      user: 'Convidado',
      isEncrypted: false,
      encryptedData: null
    };
    let SESSION_PASSWORD = null;

    function saveData() {
      const payload = { keys: STATE.keys, user: STATE.user };
      if (SESSION_PASSWORD) {
        CRYPTO.encrypt(payload, SESSION_PASSWORD).then(enc => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ isEncrypted: true, data: enc }));
          STATE.isEncrypted = true;
          STATE.encryptedData = enc;
          updateSecurityUI();
        });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ isEncrypted: false, data: payload }));
      }
    }

    async function loadData() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.isEncrypted) {
        STATE.isEncrypted = true;
        STATE.encryptedData = parsed.data;
        updateSecurityUI();
      } else {
        STATE.keys = parsed.data.keys || [];
        STATE.user = parsed.data.user || 'Convidado';
        updateInterface(STATE.user);
        renderKeysList();
      }
    }

    // --- UI UPDATES ---
    const hashStr = s => { let h=0xdeadbeef; for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),2654435761);} return (h^h>>>16)>>>0; };
    const createSvg = (id,sz) => `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}"><defs><linearGradient id="g${id}"><stop offset="0%" stop-color="#00f2ff"/><stop offset="100%" stop-color="#bd00ff"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="#080b12" stroke="rgba(255,255,255,0.1)"/><circle cx="50" cy="50" r="20" fill="url(#g${id})" opacity="0.9"/></svg>`;
    const createMiniSvg = (name,sz=30) => {
      const s = hashStr(name||'D'); const h1=s%360; const h2=(s*37)%360;
      const grad = `<linearGradient id="gm${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},90%,50%)"/><stop offset="1" stop-color="hsl(${h2},90%,50%)"/></linearGradient>`;
      return `<svg width="${sz}" height="${sz}" viewBox="0 0 32 32"><defs>${grad}</defs><rect width="32" height="32" rx="8" fill="#0a1016"/><circle cx="16" cy="16" r="6" fill="url(#gm${s})"/></svg>`;
    };

    function updateInterface(name){
      const safe = name || 'Convidado';
      els.lblName.innerText = safe;
      els.input.value = safe;
      const activeKey = STATE.keys.find(k=>k.active);
      els.smallIdent.innerText = activeKey ? activeKey.name : '--';
      els.actBadge.innerText = activeKey ? `key:${activeKey.name}` : 'v:--';
      els.smallMiniAvatar.innerHTML = createMiniSvg(safe);
      els.actMiniAvatar.innerHTML = createMiniSvg(safe,36);
      els.actName.innerText = safe;
      els.avatarTgt.innerHTML = createSvg('Main',64);
      const phrases = ["Foco estável.","Ritmo criativo.","Percepção sutil."];
      els.smallText.innerText = activeKey ? `${activeKey.name} [ATIVO]` : (safe==='Convidado'?'Aguardando...':`${safe} · ${phrases[safe.length%phrases.length]}`);
      const line = `+${'-'.repeat(safe.length+4)}+`;
      els.actPre.innerText = `${line}\n| ${safe.toUpperCase()} |\n${line}\nID: ${hashStr(safe).toString(16)}`;
      // sync top-info if chat is present
      try { if (typeof userName === 'undefined') {} else { userName = safe; localStorage.setItem('di_userName', safe); updateTopInfo(); } } catch(e){}
    }

    function updateSecurityUI() {
      if (SESSION_PASSWORD) {
        els.securityStatus.innerText = "COFRE DESTRANCADO";
        els.securityStatus.style.color = "var(--neon-success)";
        els.vaultStatusText.innerText = "Cofre Protegido (Destrancado)";
        els.lockVaultBtn.innerText = "TRANCAR";
      } else if (STATE.isEncrypted) {
        els.securityStatus.innerText = "CRIPTOGRAFADO";
        els.securityStatus.style.color = "var(--neon-gold)";
        els.vaultStatusText.innerText = "Cofre Trancado";
        els.lockVaultBtn.innerText = "REDEFINIR";
      } else {
        els.securityStatus.innerText = "SEM PROTEÇÃO";
        els.securityStatus.style.color = "rgba(255,255,255,0.5)";
        els.vaultStatusText.innerText = "Cofre Aberto (Sem senha)";
        els.lockVaultBtn.innerText = "CRIAR SENHA";
      }
    }

    // --- KEYS MANAGER LOGIC ---
    function renderKeysList(){
      els.keyList.innerHTML = '';
      if(STATE.keys.length===0){ els.keyList.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:20px">Nenhuma chave armazenada.</div>'; return; }
      STATE.keys.forEach(k=>{
        const div = document.createElement('div');
        div.className = `key-item ${k.active?'active-item':''}`;
        const typeInfo = k.webhook ? '<span style="color:var(--neon-purple)">WEBHOOK</span>' : 'API KEY';
        div.innerHTML = `
          <div class="meta">
            <div style="font-weight:700;font-size:0.9rem">${escapeHtml(k.name)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.5)">${typeInfo}</div>
          </div>
          <div class="actions">
            ${!k.active ? `<button class="small-btn" onclick="setActiveKey('${k.id}')">ATIVAR</button>` : `<span style="font-size:0.7rem;font-weight:700;color:var(--neon-cyan);margin-right:10px">ATIVA</span>`}
            <button class="small-btn danger" onclick="removeKey('${k.id}')"><i data-lucide="trash-2" style="width:14px"></i></button>
          </div>
        `;
        els.keyList.appendChild(div);
      });
      lucide.createIcons();
    }

    function addKey() {
      const name = els.keyName.value.trim();
      const token = els.keyToken.value.trim();
      const webhook = els.keyWebhook.value.trim();
      if(!name){ showToaster('Nome obrigatório','error'); return; }
      const newKey = { id: Date.now().toString(36), name, token, webhook, active: STATE.keys.length===0 };
      STATE.keys.push(newKey);
      saveData();
      renderKeysList();
      updateInterface(STATE.user);
      els.keyName.value=''; els.keyToken.value=''; els.keyWebhook.value='';
      showToaster('Chave adicionada!', 'success');
    }

    window.removeKey = (id) => {
      if(confirm('Remover chave permanentemente?')){
        STATE.keys = STATE.keys.filter(k=>k.id!==id);
        saveData(); renderKeysList(); updateInterface(STATE.user);
      }
    };

    window.setActiveKey = (id) => {
      STATE.keys.forEach(k=> k.active = (k.id===id));
      saveData(); renderKeysList(); updateInterface(STATE.user);
      showToaster('Chave ativa atualizada.', 'success');
      // sync: if active key has token, write to di_apiKey for chat module
      try {
        const active = STATE.keys.find(k=>k.active);
        if (active?.token) {
          localStorage.setItem('di_apiKey', active.token);
          if (active.model) localStorage.setItem('di_modelName', active.model);
        }
      } catch(e){}
    };

    // --- WEBHOOK TEST ---
    els.testWebhookBtn.addEventListener('click', async () => {
       const url = els.keyWebhook.value.trim();
       if(!url) return showToaster('Insira uma URL', 'error');
       els.testWebhookBtn.innerHTML = '...';
       try {
         const controller = new AbortController();
         setTimeout(()=>controller.abort(), 4000);
         await fetch(url, { method: 'POST', body: JSON.stringify({ping:true}), mode: 'no-cors', signal: controller.signal });
         showToaster('Envio realizado (Ping)', 'success');
       } catch(e) {
         showToaster('Falha na conexão', 'error');
       } finally {
         els.testWebhookBtn.innerText = 'PING';
       }
    });

    // --- VAULT FLOW ---
    function openManager() {
      if (STATE.isEncrypted && !SESSION_PASSWORD) {
        els.vaultModal.style.display = 'flex';
        els.vaultModal.setAttribute('aria-hidden', 'false');
        els.vaultPass.focus();
      } else {
        els.keysModal.style.display = 'flex';
        els.keysModal.setAttribute('aria-hidden', 'false');
      }
    }

    els.vaultUnlock.addEventListener('click', async () => {
      const pass = els.vaultPass.value;
      try {
        const decrypted = await CRYPTO.decrypt(STATE.encryptedData, pass);
        SESSION_PASSWORD = pass;
        STATE.keys = decrypted.keys;
        STATE.user = decrypted.user;
        els.vaultModal.style.display = 'none';
        els.keysModal.style.display = 'flex';
        els.vaultPass.value = '';
        renderKeysList();
        updateSecurityUI();
        showToaster('Cofre destrancado.', 'success');
      } catch(e) {
        showToaster('Senha incorreta.', 'error');
        els.vaultPass.classList.add('vibe-gold');
        setTimeout(()=>els.vaultPass.classList.remove('vibe-gold'), 500);
      }
    });

    els.lockVaultBtn.addEventListener('click', () => {
       if (!SESSION_PASSWORD && !STATE.isEncrypted) {
         const newPass = prompt("Defina uma senha para o Cofre:");
         if(newPass) {
           SESSION_PASSWORD = newPass;
           saveData();
           showToaster("Cofre criado e trancado.", 'success');
         }
       } else {
         SESSION_PASSWORD = null;
         els.keysModal.style.display = 'none';
         showToaster("Cofre trancado.", 'success');
       }
       updateSecurityUI();
    });

    els.vaultCancel.addEventListener('click', ()=> els.vaultModal.style.display='none');
    els.closeKeysBtn.addEventListener('click', ()=> els.keysModal.style.display='none');
    els.addKeyBtn.addEventListener('click', addKey);

    // Import/Export
    els.exportKeysBtn.addEventListener('click', ()=>{
      const data = JSON.stringify(STATE.keys, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='fusion_keys.json'; a.click();
    });
    els.importKeysBtn.addEventListener('click', ()=> els.importFileInput.click());
    els.importFileInput.addEventListener('change', (e)=>{
       const f = e.target.files[0];
       if(f) {
         const r = new FileReader();
         r.onload = (ev) => {
           try { STATE.keys = JSON.parse(ev.target.result); saveData(); renderKeysList(); showToaster('Chaves importadas!','success'); }
           catch(e){ showToaster('Arquivo inválido','error'); }
         };
         r.readAsText(f);
       }
    });

    // --- GESTURES / INTERACTION ---
    let state = { isOrb:false, isHud:false, isDragging:false, startX:0, startY:0, timer:null };
    els.card.addEventListener('pointerdown', handleStart);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);

    // Click on Avatar in Card Mode -> Open Manager (with lazy-load ZebNeb)
    els.avatarTgt.addEventListener('click', async (e)=>{
       // lazy-load ZebNeb-like heavy script on first use
       if (!window.__zebnebLoaded) {
         try {
           // Placeholder for external script if needed
           window.__zebnebLoaded = true; console.log('ZebNeb placeholder loaded');
         } catch(err){ console.warn('zebneb load error', err); }
       }
       if(!state.isOrb && !state.isHud) openManager();
    });

    function handleStart(e) {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.keys-card')) return;
      if(!state.isOrb && !state.isHud && !els.header.contains(e.target)) return;
      state.startX = e.clientX; state.startY = e.clientY; state.isDragging = false;
      state.timer = setTimeout(() => {
        if(state.isOrb) openManager();
        else if (!state.isHud) transmuteToOrb(e.clientX, e.clientY);
      }, 600);
      if(state.isOrb) {
         els.card.setPointerCapture(e.pointerId);
         const rect = els.card.getBoundingClientRect();
         state.offsetX = e.clientX - rect.left;
         state.offsetY = e.clientY - rect.top;
      }
    }

    function handleMove(e) {
      if(!state.timer && !state.isOrb) return;
      const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
      if(dist > 10) {
        if(state.timer) { clearTimeout(state.timer); state.timer = null; }
        if(state.isOrb) {
          state.isDragging = true;
          els.card.style.left = (e.clientX - state.offsetX) + 'px';
          els.card.style.top = (e.clientY - state.offsetY) + 'px';
          els.card.style.transform = 'none';
        }
      }
    }

    function handleEnd(e) {
      if(state.timer) { clearTimeout(state.timer); state.timer = null; }
      if(state.isDragging && state.isOrb) {
        state.isDragging = false; snapOrb(e.clientX, e.clientY); return;
      }
      const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
      if(dist < 10) {
        if(state.isOrb || state.isHud) revertToCard();
        else toggleCardState();
      }
    }

    function transmuteToOrb(x,y) {
      if(navigator.vibrate) navigator.vibrate(50);
      els.card.classList.add('orb','closed'); els.card.classList.remove('content-visible');
      els.card.style.left=(x-34)+'px'; els.card.style.top=(y-34)+'px';
      state.isOrb=true; state.isHud=false;
    }

    function snapOrb(x,y) {
      if(y < 80) {
        state.isHud=true; state.isOrb=false; els.card.classList.add('hud'); els.card.classList.remove('orb');
        els.card.style.left=''; els.card.style.top=''; els.card.style.transform='';
      } else {
        const tx = x < window.innerWidth/2 ? 15 : window.innerWidth-83;
        els.card.style.transition='left 0.4s ease, top 0.4s ease'; els.card.style.left=tx+'px';
        setTimeout(()=>els.card.style.transition='',400);
      }
    }

    function revertToCard() {
      state.isOrb=false; state.isHud=false;
      els.card.style.transition='all 0.5s var(--ease-smooth)'; els.card.style.left=''; els.card.style.top=''; els.card.style.width=''; els.card.style.height=''; els.card.style.transform='';
      els.card.classList.remove('orb','hud','closed');
      setTimeout(()=>els.card.classList.add('content-visible'),300);
    }

    function toggleCardState() {
      if(els.card.classList.contains('animating')) return;
      const isClosed = els.card.classList.contains('closed');
      els.card.classList.add('animating');
      if(isClosed) {
        els.card.classList.remove('closed');
        els.card.animate([{transform:'scale(0.95)',opacity:0.8},{transform:'scale(1)',opacity:1}],{duration:400,easing:'cubic-bezier(0.34,1.3,0.64,1)'})
        .onfinish = ()=>{ els.card.classList.remove('animating'); els.card.classList.add('content-visible'); }
      } else {
        els.card.classList.remove('content-visible');
        els.card.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(10px)',opacity:1}],{duration:200,easing:'ease-in'})
        .onfinish = ()=>{ els.card.classList.add('closed'); els.card.classList.remove('animating'); }
      }
    }

    // --- MISC UTILS ---
    function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }
    function showToaster(txt,type='default'){ const t=document.createElement('div'); t.className=`toaster ${type}`; t.innerText=txt; document.getElementById('toasterWrap').appendChild(t); setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500); }
    function toggleActivation(){ const h=els.actCard.classList.contains('activation-hidden'); els.actCard.classList.toggle('activation-hidden',!h); els.actCard.classList.toggle('activation-open',h); }

    // Copy/Download
    document.getElementById('copyActBtn').addEventListener('click', ()=>{
       const active = STATE.keys.find(k=>k.active);
       const append = active ? `\n\n[Active Key: ${active.name}]` : '';
       navigator.clipboard.writeText(els.actPre.innerText + append).then(()=>showToaster('Copiado!'));
    });
    document.getElementById('downloadActBtn').addEventListener('click', async()=>{
       const canvas = await html2canvas(els.actPre, {scale:2, backgroundColor:null});
       canvas.toBlob(b=>{ const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='activation.png'; a.click(); });
    });

    // Init
    els.input.addEventListener('input', (e)=>{ STATE.user=e.target.value; updateInterface(e.target.value); saveData(); });
    setTimeout(()=>{ els.card.classList.add('active'); els.avatarTgt.classList.add('shown'); loadData(); }, 100);
    setInterval(()=>{ els.clock.innerText = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); },1000);

    /* ==== Patch sync userName (força persistência) ==== */
    (function(){
      const safeUpdateUserName = (name) => {
        try {
          name = (name||'').toString();
          if (typeof STATE !== 'undefined') STATE.user = name || STATE.user;
          if (typeof userName !== 'undefined') userName = name || userName;
          localStorage.setItem('di_userName', name || '');
          try { if (typeof updateTopInfo === 'function') updateTopInfo(); } catch(e){}
        } catch(e) { console.warn('safeUpdateUserName', e); }
      };

      const inputCard = document.getElementById('inputUser');
      if (inputCard) {
        inputCard.addEventListener('change', (e) => safeUpdateUserName(e.target.value));
        inputCard.addEventListener('blur', (e) => safeUpdateUserName(e.target.value));
        if (inputCard.value && inputCard.value.trim()) safeUpdateUserName(inputCard.value.trim());
      }

      const origUpdateInterface = window.updateInterface;
      if (typeof origUpdateInterface === 'function') {
        window.updateInterface = function(name){
          try { origUpdateInterface(name); } catch(e){ console.warn(e); }
          try { safeUpdateUserName(name); } catch(e){}
        };
      }
    })();
  </script>
  <!-- Scripts: Chat (keeps globals expected by sync patch) -->
  <script>
    /* ---------- Constantes iniciais (Chat module - globals intentionally) ---------- */
    const TRAINING_FILE_FALLBACK = 'Super_Treinamento_Universal_Dual_Infodose_v1-28.txt';
    const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
    const TEMPERATURE = 0.2;

    // estado (global; sync patch depends on these names)
    let training = '';
    let trainingFileName = '';
    let assistantEnabled = false;
    let trainingActive = true; // se false, não inclui 'system' no conversation
    let conversation = [];
    let pages = [], currentPage = 0, autoAdvance = true;

    // configs persistidas (globals)
    let apiKey = localStorage.getItem('di_apiKey') || '';
    let modelName = localStorage.getItem('di_modelName') || 'meta-llama/llama-3.1-405b-instruct:free';
    let userName = localStorage.getItem('di_userName') || '';
    let infodoseName = localStorage.getItem('di_infodoseName') || '';
    const CRYSTAL_KEY = 'di_cristalizados';

    const createEl = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    const splitBlocks = text => {
      if (!text || !text.trim()) return [['Sem conteúdo de treinamento.','','']];
      let paras = text.split(/\n\s*\n/).filter(p=>p.trim());
      if (paras.length % 3 !== 0) {
        const sens = paras.join(' ').match(/[^\.!\?]+[\.!\?]+/g) || [paras.join(' ')];
        paras = sens.map(s=>s.trim());
      }
      const groups = [];
      for (let i=0;i<paras.length;i+=3) groups.push(paras.slice(i,i+3));
      return groups;
    };

    // TTS
    const speakText = (txt, onend)=> {
      if (!txt) { if (onend) onend(); return; }
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'pt-BR'; u.rate = 0.99; u.pitch = 1.1; u.volume = 1;
      if (window._vozes) u.voice = window._vozes.find(v=>v.lang==='pt-BR') || window._vozes[0];
      if (onend) u.onend = onend;
      speechSynthesis.speak(u);
    };

    const updateTopInfo = () => {
      const du = document.getElementById('displayUser');
      const di = document.getElementById('displayInfodose');
      if (du) du.innerText = 'User: ' + (userName || '—');
      if (di) di.innerText = 'Infodose: ' + (infodoseName || '—');
    };

    const updateToggleUI = () => {
      const tb = document.getElementById('toggleBtn');
      if (tb) tb.classList.toggle('active', assistantEnabled);
      const as = document.getElementById('assistantActiveCheckbox');
      const tr = document.getElementById('trainingActiveCheckbox');
      if (as) as.checked = !!assistantEnabled;
      if (tr) tr.checked = !!trainingActive;
    };

    async function loadInitialTraining() {
      const localTraining = localStorage.getItem('di_trainingText');
      const localFileName = localStorage.getItem('di_trainingFileName') || '';
      if (localTraining) {
        training = localTraining;
        trainingFileName = localFileName;
        const tf = document.getElementById('trainingFileName');
        if (tf) tf.innerText = localFileName || 'treinamento (local)';
        return;
      }
      try {
        const r = await fetch(TRAINING_FILE_FALLBACK);
        if (r.ok) {
          training = await r.text();
          trainingFileName = TRAINING_FILE_FALLBACK;
          const tf = document.getElementById('trainingFileName');
          if (tf) tf.innerText = TRAINING_FILE_FALLBACK;
        }
      } catch (e) { /* silent */ }
    }

    /* === Markdown-enabled paginated renderer === */
const md = window.markdownit({
  html: false,         // desativa HTML cru; se quiser permitir HTML, mude para true
  linkify: true,
  typographer: true
});

const renderPaginatedResponse = text => {
  speechSynthesis.cancel();
  autoAdvance = true;
  const respEl = document.getElementById('response');
  if (!respEl) return;
  respEl.querySelectorAll('.page:not(.initial)').forEach(p=>p.remove());
  pages = [];
  const groups = splitBlocks(text);
  const titles = ['🎁 Recompensa Inicial','👁️ Exploração e Curiosidade','⚡ Antecipação Vibracional'];

  // toggle sanitization
  const useSanitize = true; // <<== false se preferir não usar DOMPurify

  groups.forEach((tris, gi) => {
    const page = createEl('div', gi===0?'page active':'page');
    tris.forEach((body, j) => {
      const cls = j===0?'intro': j===1?'middle':'ending';
      // render markdown -> html
      let rendered = md.render(body || '');
      if (useSanitize && window.DOMPurify) rendered = DOMPurify.sanitize(rendered);
      // create block container
      const b = createEl('div','response-block '+cls, `
        <div class="markdown-body">${rendered}</div>
      `);

      // meta & actions
      const meta = createEl('div','meta');
      const crystalBtn = createEl('button','crystal-btn','✶');
      crystalBtn.title = 'Cristalizar essa mensagem';
      crystalBtn.addEventListener('click',(ev)=>{ ev.stopPropagation(); cristalizar({ title: titles[j], content: body }); crystalBtn.innerText='✓'; setTimeout(()=> crystalBtn.innerText='✶',1200); });
      meta.appendChild(crystalBtn);
      b.appendChild(meta);

      // block-level actions bottom-left (copy)
      const actions = createEl('div','block-actions');
      const copyBtn = createEl('button','copy-block-btn','Copiar');
      copyBtn.addEventListener('click',(ev)=>{
        ev.stopPropagation();
        // prefer copying original markdown; but copy rendered plain text if needed
        navigator.clipboard.writeText(body || b.innerText).then(()=> showToaster('Bloco copiado','success'));
      });
      actions.appendChild(copyBtn);
      b.appendChild(actions);

      // click behavior: speak / expand / callAI (mantendo tua lógica)
      b.dataset.state = '';
      b.addEventListener('click', () => {
        if (!b.dataset.state) {
          speechSynthesis.cancel();
          // pega texto plano (sem tags)
          const plain = Array.from(b.querySelectorAll('p, li')).map(n => n.innerText).join(' ');
          speakText(plain);
          b.classList.add('clicked');
          b.dataset.state = 'spoken';
        } else {
          b.classList.add('expanded');
          b.dataset.state = '';
          if (!assistantEnabled) {
            assistantEnabled = true;
            localStorage.setItem('di_assistantEnabled','1');
            if (training && trainingActive) conversation.unshift({ role:'system', content: training });
            updateToggleUI();
          }
          const blockText = `${titles[j]}\n\n${body}`;
          showLoading('Pulso em Expansão...');
          speechSynthesis.cancel();
          speakText('Pulso em Expansão...');
          conversation.push({ role:'user', content: blockText });
          callAI();
        }
      });

      b.addEventListener('animationend', e => { if (e.animationName==='clickPulse') b.classList.remove('clicked'); });

      page.appendChild(b);
    });

    page.appendChild(createEl('p','footer-text',`<em>Do seu jeito. <strong>Sempre</strong> único. <strong>Sempre</strong> seu.</em>`));
    const controls = respEl.querySelector('.response-controls');
    if (controls) respEl.insertBefore(page, controls);
    pages.push(page);

    // after DOM insertion, highlight code blocks in this page
    setTimeout(()=> {
      try {
        page.querySelectorAll('pre code').forEach(el => { Prism.highlightElement(el); });
      } catch(e) {}
    }, 40);
  });

  currentPage = 0;
  const pi = document.getElementById('pageIndicator');
  if (pi) pi.textContent = `1 / ${pages.length}`;
  speakPage(0);
};

    const speakPage = i => {
      const page = pages[i];
      if (!page) return;
      const body = Array.from(page.querySelectorAll('.response-block p')).map(p=>p.innerText).join(' ');
      speakText(body, () => {
        if (!autoAdvance) return;
        if (i < pages.length - 1) {
          changePage(1);
          speakPage(i+1);
        } else {
          speakText('Do seu jeito, sempre único, sempre seu.');
        }
      });
    };
    const changePage = offset => {
      const np = currentPage + offset;
      if (np<0||np>=pages.length) return;
      pages[currentPage].classList.remove('active');
      pages[np].classList.add('active');
      currentPage = np;
      const pi = document.getElementById('pageIndicator');
      if (pi) pi.textContent = `${currentPage+1} / ${pages.length}`;
    };

    const showLoading = msg => {
      const respEl = document.getElementById('response');
      const controls = respEl.querySelector('.response-controls');
      respEl.querySelectorAll('.page:not(.initial)').forEach(p=>p.remove());
      const page = createEl('div','page active');
      page.appendChild(createEl('p','footer-text',msg));
      if (controls) respEl.insertBefore(page, controls);
      pages = [page];
      currentPage = 0;
      const pi = document.getElementById('pageIndicator');
      if (pi) pi.textContent = '…';
    };

    async function callAI() {
      if (!apiKey) {
        alert('Por favor, configure sua API Key no botão de configurações.');
        const sModal = document.getElementById('settingsModal');
        if (sModal) sModal.classList.add('active');
        return;
      }

      const bodyObj = { model: modelName, messages: conversation.slice(), temperature: TEMPERATURE };
      const messagesToSend = [];
      if (assistantEnabled && trainingActive && training) messagesToSend.push({ role:'system', content: training });
      conversation.forEach(m => {
        if (m.role === 'system') return;
        messagesToSend.push(m);
      });
      bodyObj.messages = messagesToSend;

      try {
        const resp = await fetch(API_ENDPOINT, {
          method:'POST',
          headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' },
          body: JSON.stringify(bodyObj)
        });
        if (!resp.ok) throw new Error('Erro API: ' + resp.status);
        const data = await resp.json();
        const answer = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
          ? data.choices[0].message.content.trim()
          : (data.result || 'Resposta vazia');
        conversation.push({ role:'assistant', content: answer });
        renderPaginatedResponse(answer);
      } catch (err) {
        console.error(err);
        const errorMsg = 'O pulso oscilou (Erro de Conexão ou Key inválida). Verifique as configurações.';
        conversation.push({ role:'assistant', content: errorMsg });
        renderPaginatedResponse(errorMsg);
      }
    }

    async function sendMessage(){
      const respEl = document.getElementById('response');
      const initPage = respEl ? respEl.querySelector('.page.initial') : null;
      if (initPage) initPage.remove();

      const input = document.getElementById('userInput');
      const raw = input ? input.value.trim() : '';
      if (!raw) return;
      if (input) input.value = '';

      speechSynthesis.cancel();
      speakText('');

      const txt = raw.toLowerCase();
      if (txt === 'oi dual' || txt === 'oi, dual') {
        assistantEnabled = true;
        localStorage.setItem('di_assistantEnabled','1');
        showLoading('Dual Infodose ativa. Pulso enviado...');
        if (training && trainingActive) conversation.unshift({ role:'system', content: training });
        updateToggleUI();
      } else {
        showLoading('⚡Pulso enviado...Recebendo Intenção…');
      }

      conversation.push({ role:'user', content: raw });
      callAI();
    }

    function cristalizar({ title, content }) {
      const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]');
      const item = {
        id: Date.now(),
        title: title,
        content: content,
        user: userName || '—',
        infodose: infodoseName || '—',
        at: new Date().toISOString()
      };
      list.unshift(item);
      localStorage.setItem(CRYSTAL_KEY, JSON.stringify(list));
      refreshCrystalList();
    }

    function refreshCrystalList() {
      const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]');
      const el = document.getElementById('crystalList');
      if (!el) return;
      el.innerHTML = '';
      if (!list.length) {
        el.innerHTML = '<div class="small">Nenhum cristalizado ainda.</div>';
        return;
      }
      list.forEach(it => {
        const row = createEl('div','crystal-item');
        const left = createEl('div','','<strong>'+ (it.title||'—') +'</strong><div class="small">'+(it.infodose || '')+' · '+(new Date(it.at)).toLocaleString()+'</div><div style="margin-top:6px">'+ (it.content.length>220 ? it.content.slice(0,220)+'...' : it.content) +'</div>');
        const actions = createEl('div','actions');
        const copyBtn = createEl('button','btn btn-sec','Copiar');
        copyBtn.addEventListener('click', ()=> { navigator.clipboard.writeText(it.content); });
        const exportBtn = createEl('button','btn btn-prim','Exportar');
        exportBtn.addEventListener('click', ()=> {
          const blob = new Blob([it.content], { type:'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `cristal_${it.id}.txt`; a.click(); URL.revokeObjectURL(url);
        });
        const delBtn = createEl('button','btn btn-sec','Apagar');
        delBtn.addEventListener('click', () => {
          const arr = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]').filter(x => x.id !== it.id);
          localStorage.setItem(CRYSTAL_KEY, JSON.stringify(arr));
          refreshCrystalList();
        });
        actions.appendChild(copyBtn); actions.appendChild(exportBtn); actions.appendChild(delBtn);
        row.appendChild(left); row.appendChild(actions);
        el.appendChild(row);
      });
    }

    function setupSettings() {
      const modal = document.getElementById('settingsModal');
      const btn = document.getElementById('settingsBtn');
      const closeBtn = document.getElementById('cancelSettings');
      const saveBtn = document.getElementById('saveSettings');
      const keyInput = document.getElementById('apiKeyInput');
      const modelInput = document.getElementById('modelInput');

      btn.addEventListener('click', () => {
        keyInput.value = apiKey;
        modelInput.value = modelName;
        modal.classList.add('active');
      });
      const closeModal = () => modal.classList.remove('active');
      closeBtn.addEventListener('click', closeModal);
      saveBtn.addEventListener('click', () => {
        apiKey = keyInput.value.trim();
        modelName = modelInput.value.trim() || modelName;
        localStorage.setItem('di_apiKey', apiKey);
        localStorage.setItem('di_modelName', modelName);
        alert('Conexão Neural Salva.');
        closeModal();
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    function setupTogglePanel() {
      const panel = document.getElementById('togglePanel');
      const btn = document.getElementById('toggleBtn');
      const closeBtn = document.getElementById('closePanelBtn');
      const saveBtn = document.getElementById('savePanelBtn');
      const userInput = document.getElementById('userNameInput');
      const infodoseInput = document.getElementById('infodoseNameInput');
      const assistantChk = document.getElementById('assistantActiveCheckbox');
      const trainingChk = document.getElementById('trainingActiveCheckbox');
      const fileInput = document.getElementById('trainingUpload');
      const importBtn = document.getElementById('importTrainingBtn');
      const exportBtn = document.getElementById('exportTrainingBtn');
      const trainingNameEl = document.getElementById('trainingFileName');

      btn.addEventListener('click', () => {
        userInput.value = userName;
        infodoseInput.value = infodoseName;
        assistantChk.checked = !!assistantEnabled;
        trainingChk.checked = !!trainingActive;
        panel.classList.add('active');
      });
      closeBtn.addEventListener('click', ()=> panel.classList.remove('active'));
      saveBtn.addEventListener('click', () => {
        userName = userInput.value.trim();
        infodoseName = infodoseInput.value.trim();
        assistantEnabled = !!assistantChk.checked;
        trainingActive = !!trainingChk.checked;
        localStorage.setItem('di_userName', userName);
        localStorage.setItem('di_infodoseName', infodoseName);
        localStorage.setItem('di_assistantEnabled', assistantEnabled ? '1' : '0');
        localStorage.setItem('di_trainingActive', trainingActive ? '1' : '0');
        updateTopInfo();
        updateToggleUI();
        panel.classList.remove('active');
      });

      fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        trainingFileName = f.name;
      });

      importBtn.addEventListener('click', ()=> {
        const f = fileInput.files[0];
        if (!f) { alert('Escolha um arquivo .txt para importar.'); return; }
        const r = new FileReader();
        r.onload = (ev) => {
          training = ev.target.result;
          trainingFileName = f.name || 'uploaded_training.txt';
          localStorage.setItem('di_trainingText', training);
          localStorage.setItem('di_trainingFileName', trainingFileName);
          const tf = document.getElementById('trainingFileName');
          if (tf) tf.innerText = trainingFileName;
          alert('Treinamento importado e salvo localmente.');
        };
        r.readAsText(f,'utf-8');
      });

      exportBtn.addEventListener('click', ()=> {
        if (!training) { alert('Nenhum treinamento presente para exportar.'); return; }
        const blob = new Blob([training], { type:'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = trainingFileName || 'training_export.txt'; a.click(); URL.revokeObjectURL(url);
      });
    }

    function setupCrystalModal() {
      const btn = document.getElementById('crystalBtn');
      const modal = document.getElementById('crystalModal');
      const close = document.getElementById('closeCrystal');
      const exportAll = document.getElementById('exportAllCrystal');
      const clearAll = document.getElementById('clearAllCrystal');

      btn.addEventListener('click', () => {
        refreshCrystalList();
        modal.classList.add('active');
      });
      close.addEventListener('click', ()=> modal.classList.remove('active'));
      exportAll.addEventListener('click', ()=> {
        const list = JSON.parse(localStorage.getItem(CRYSTAL_KEY) || '[]');
        if (!list.length) { alert('Nada para exportar.'); return; }
        const content = list.map(it => `--- ${it.title} · ${it.at} · ${it.infodose}\n\n${it.content}\n\n`).join('\n');
        const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `cristalizados_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
      });
      clearAll.addEventListener('click', ()=> {
        if (!confirm('Limpar todos os cristalizados?')) return;
        localStorage.removeItem(CRYSTAL_KEY);
        refreshCrystalList();
      });
      document.getElementById('crystalModal').addEventListener('click', (e)=> { if (e.target === document.getElementById('crystalModal')) document.getElementById('crystalModal').classList.remove('active'); });
    }

    /* ---------- Clipboard + other small UI ---------- */
    document.addEventListener('DOMContentLoaded', async () => {
      speechSynthesis.onvoiceschanged = () => { window._vozes = speechSynthesis.getVoices(); };

      apiKey = localStorage.getItem('di_apiKey') || apiKey;
      modelName = localStorage.getItem('di_modelName') || modelName;
      userName = localStorage.getItem('di_userName') || userName;
      infodoseName = localStorage.getItem('di_infodoseName') || infodoseName;
      assistantEnabled = (localStorage.getItem('di_assistantEnabled') === '1') || assistantEnabled;
      trainingActive = (localStorage.getItem('di_trainingActive') === '0') ? false : trainingActive;

      await loadInitialTraining();
      updateTopInfo();
      updateToggleUI();
      setupSettings();
      setupTogglePanel();
      setupCrystalModal();

      // particles init (safe call)
      try {
        particlesJS('particles-js',{
          particles:{ number:{value:40},color:{value:['#0ff','#f0f']}, shape:{type:'circle'},opacity:{value:0.4},size:{value:2.4}, move:{enable:true,speed:1.5} }, retina_detect:true
        });
      } catch(e){}

      // eventos básicos
      const sendBtn = document.getElementById('sendBtn');
      const userInputEl = document.getElementById('userInput');
      if (sendBtn) sendBtn.addEventListener('click', sendMessage);
      if (userInputEl) userInputEl.addEventListener('keypress', e => { if (e.key==='Enter') sendMessage(); });
      const prevBtn = document.querySelector('[data-action="prev"]');
      const nextBtn = document.querySelector('[data-action="next"]');
      if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
      if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));

      const copyBtn = document.querySelector('.copy-button');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const pages = Array.from(document.querySelectorAll('.response-container .page'));
        const fullText = pages.map(p => p.innerText.trim()).join('\n\n');
        navigator.clipboard.writeText(fullText);
      });

      const pasteBtn = document.querySelector('.paste-button');
      if (pasteBtn) pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          const inp = document.getElementById('userInput');
          if (inp) inp.value = text;
        } catch (err) { console.error('Falha ao colar', err); }
      });

      // voice quick
      const voiceBtn = document.getElementById('voiceBtn');
      if (voiceBtn) voiceBtn.addEventListener('click', ()=>{
        try {
          const R = new (window.SpeechRecognition||window.webkitSpeechRecognition)();
          R.lang='pt-BR'; R.start();
          R.onresult = e => {
            document.getElementById('userInput').value = e.results[0][0].transcript;
            sendMessage();
          };
        } catch(e){}
      });
    });

    /* === MANTRA ZEN MODE === */
    const mantraBtn = document.getElementById('mantra-toggle');
    const mantraText = document.getElementById('mantra-text');
    let mantraCollapsed = false;
    const TXT_EXPANDED = `Do seu jeito. <strong>Sempre</strong> único. <strong>Sempre</strong> seu.`;
    const TXT_COLLAPSED = `USE · TRANSFORME · DEVOLVA`;
    function swapMantraText(html) {
      mantraText.classList.add('fade-out');
      setTimeout(() => {
        mantraText.innerHTML = html;
        mantraText.classList.remove('fade-out');
        mantraText.classList.add('fade-in');
        setTimeout(() => mantraText.classList.remove('fade-in'), 300);
      }, 300);
    }
    mantraBtn.addEventListener('click', () => {
      mantraCollapsed = !mantraCollapsed;
      if (mantraCollapsed) {
        mantraBtn.classList.add('collapsed');
        document.body.classList.add('zen-mode');
        swapMantraText(TXT_COLLAPSED);
      } else {
        mantraBtn.classList.remove('collapsed');
        document.body.classList.remove('zen-mode');
        swapMantraText(TXT_EXPANDED);
      }
    });
  </script>