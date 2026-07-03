/* =============================================================
   Zama Confidential Hub — interaction layer (mock / prototype)
   No real chain calls; flows are simulated with realistic timing,
   verb-labelled pending states, and encrypted-balance handling.
   ============================================================= */
(function () {
  "use strict";

  var MASK = "∗∗∗∗"; // ****

  // ---- Shield badge SVG (legible over any logo — sits on dark disc) ----
  function shieldSVG() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1 3 4v7c0 5 3.8 8.5 9 11 5.2-2.5 9-6 9-11V4l-9-3z"/></svg>';
  }

  // ---- Token model (real official pairs + logos from the app) ----
  // decrypted: null => encrypted (**** until user decrypts)
  var TOKENS = [
    { sym: "USDCMock", csym: "cUSDCMock", name: "USDC Mock", icon: "assets/tokens/usdc.png", price: 1.0, chg: 0.01, decimals: 6, pub: 1250.0, conf: 640.5, decrypted: 640.5 },
    { sym: "USDTMock", csym: "cUSDTMock", name: "USDT Mock", icon: "assets/tokens/usdt.png", price: 1.0, chg: -0.02, decimals: 6, pub: 980.0, conf: 300.0, decrypted: null },
    { sym: "WETHMock", csym: "cWETHMock", name: "WETH Mock", icon: "assets/tokens/weth.png", price: 3120.44, chg: 2.14, decimals: 18, pub: 0.42, conf: 0.18, decrypted: null },
    { sym: "ZAMAMock", csym: "cZAMAMock", name: "ZAMA Mock", icon: "assets/tokens/zama.png", price: 0.86, chg: 5.63, decimals: 18, pub: 512.0, conf: 0, decrypted: 0 },
    { sym: "XAUtMock", csym: "cXAUtMock", name: "XAUt Mock", icon: "assets/tokens/xaut.png", price: 2412.90, chg: -0.41, decimals: 6, pub: 0, conf: 0.05, decrypted: null }
  ];

  var state = {
    connected: false,
    wrongNet: false,
    view: "dashboard",
    showEmpty: false,
    direction: "shield", // shield | unshield
    flowTokenIdx: 0,
    sendTokenIdx: 0,
    faucetTokenIdx: 0
  };

  var PAGE_META = {
    dashboard: ["Dashboard", "Your shielded and public balances on Sepolia."],
    faucet: ["Faucet", "Mint mock ERC-20 test tokens to try the flows."],
    shield: ["Shield / Unshield", "Wrap public tokens into confidential counterparts, or back."],
    send: ["Send", "Transfer confidential tokens privately."],
    activity: ["Activity", "Local log of your wrap, unwrap, decrypt and faucet events."]
  };

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function fmtUSD(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtAmt(n, d) { return n.toLocaleString("en-US", { maximumFractionDigits: d != null ? Math.min(d, 6) : 4 }); }
  function fmtPrice(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 4 : 2 }); }

  function avatar(tok, size, shielded) {
    var s = size ? " " + size : "";
    var inner = tok.icon
      ? '<img src="' + tok.icon + '" alt="" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + tok.sym.slice(0, 3) + '\'" />'
      : tok.sym.slice(0, 3).toUpperCase();
    var badge = shielded ? '<span class="token-shield" title="Confidential token">' + shieldSVG() + "</span>" : "";
    return '<span class="token-avatar' + s + '">' + inner + badge + "</span>";
  }

  function toast(msg) {
    var t = $("#toast");
    t.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' + msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // ---------- connection state ----------
  function setConnected(on) {
    state.connected = on;
    $("#wallet-connect").hidden = on;
    $("#wallet-menu-trigger").hidden = !on;
    if (!on) { $("#wallet-menu").hidden = true; }
    renderNetPill();
    renderAll();
  }

  function renderNetPill() {
    var pill = $("#net-pill");
    var trig = $("#wallet-menu-trigger");
    if (!state.connected) {
      pill.className = "pill";
      pill.textContent = "Sepolia testnet";
      return;
    }
    if (state.wrongNet) {
      pill.className = "pill warn dot";
      pill.textContent = "Wrong network — switch to Sepolia";
      trig.classList.add("wrong");
      $("#wallet-net").textContent = "Wrong network";
    } else {
      pill.className = "pill ok dot";
      pill.textContent = "Sepolia";
      trig.classList.remove("wrong");
      $("#wallet-net").textContent = "Sepolia";
    }
  }

  // Reason a CTA is blocked, or "" when ready
  function blockReason() {
    if (!state.connected) return "connect";
    if (state.wrongNet) return "network";
    return "";
  }
  function ctaLabel(readyLabel, verb) {
    var r = blockReason();
    if (r === "connect") return "Connect wallet to " + verb;
    if (r === "network") return "Switch to Sepolia";
    return readyLabel;
  }
  function applyCTA(btn, readyLabel, verb) {
    var r = blockReason();
    btn.disabled = !!r;
    btn.textContent = ctaLabel(readyLabel, verb);
  }

  // ---------- navigation ----------
  function go(view) {
    state.view = view;
    $all(".nav-item").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    $all(".view").forEach(function (v) { v.classList.toggle("active", v.id === "view-" + view); });
    $("#page-title").textContent = PAGE_META[view][0];
    $("#page-sub").textContent = PAGE_META[view][1];
    closeSidebar();
    window.scrollTo(0, 0);
  }

  function openSidebar() { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); }
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("open"); }

  // ---------- dashboard: asset table ----------
  function assetValue(t) {
    var conf = t.decrypted != null ? t.decrypted : t.conf; // value uses true amount; display masks it
    return (t.pub + conf) * t.price;
  }
  function totalValue() { return TOKENS.reduce(function (s, t) { return s + assetValue(t); }, 0); }
  function shieldableValue() { return TOKENS.reduce(function (s, t) { return s + t.pub * t.price; }, 0); }

  function renderDashboard() {
    // headline cards
    $("#total-balance .amount").textContent = fmtUSD(totalValue());
    var shieldedCount = TOKENS.filter(function (t) { return (t.decrypted != null ? t.decrypted : t.conf) > 0; }).length;
    $("#total-balance .meta").innerHTML = "Across <b>" + TOKENS.length + " assets</b> · <b>" + shieldedCount + " shielded</b>";
    $("#available-to-shield .amount").textContent = fmtUSD(shieldableValue());

    var table = $("#asset-table");
    $all(".asset-row", table).forEach(function (r) { r.remove(); });

    TOKENS.forEach(function (t, i) {
      var nonEmpty = t.pub > 0 || t.conf > 0 || (t.decrypted || 0) > 0;
      if (!state.showEmpty && !nonEmpty) return;

      var confDisplay = t.decrypted != null
        ? fmtAmt(t.decrypted, t.decimals) + " " + t.csym
        : '<span class="encrypted-mask">' + MASK + "</span> " + t.csym;

      var row = el("div", "asset-row");
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("data-od-id", "asset-row-" + t.sym.toLowerCase());
      row.setAttribute("aria-label", "Open " + t.name + " details");
      row.innerHTML =
        '<div class="asset-token">' + avatar(t, "", false) +
          '<span class="name"><strong>' + t.name + "</strong><small>" + t.sym + "</small></span></div>" +
        '<div class="asset-price">' + fmtPrice(t.price) +
          '<span class="chg ' + (t.chg >= 0 ? "up" : "down") + '">' + (t.chg >= 0 ? "+" : "") + t.chg.toFixed(2) + "%</span></div>" +
        '<div class="asset-balances">' +
          '<span class="std">' + fmtAmt(t.pub, t.decimals) + " " + t.sym + "</span>" +
          '<span class="conf">' + avatarBadgeInline() + confDisplay + "</span></div>" +
        '<div class="asset-value">' + fmtUSD(assetValue(t)) + "</div>" +
        '<span class="asset-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>';
      row.addEventListener("click", function () { openAssetModal(i); });
      row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAssetModal(i); } });
      table.appendChild(row);
    });

    $("#toggle-empty").textContent = state.showEmpty ? "Hide empty assets" : "Show empty assets";
  }

  function avatarBadgeInline() {
    return '<span class="token-shield" style="position:static;width:14px;height:14px;border:none;filter:none;background:none;color:var(--accent)">' + shieldSVG() + "</span>";
  }

  // ---------- asset detail modal ----------
  function openAssetModal(i) {
    var t = TOKENS[i];
    var encrypted = t.decrypted == null;

    $("#asset-modal-hero").innerHTML =
      avatar(t, "lg", true) +
      "<strong>" + t.name + "</strong><span>" + t.sym + " · " + t.csym + "</span>";

    $("#asset-modal-summary").innerHTML =
      '<div><span class="lbl">Price</span><strong>' + fmtPrice(t.price) + "</strong>" +
        '<small class="' + (t.chg >= 0 ? "" : "") + '">' + (t.chg >= 0 ? "+" : "") + t.chg.toFixed(2) + "% 24h</small></div>" +
      '<div><span class="lbl">Total value</span><strong>' + fmtUSD(assetValue(t)) + "</strong>" +
        "<small>" + (encrypted ? "Confidential amount hidden" : "Public + confidential") + "</small></div>";

    var confVal = encrypted ? '<span class="val masked">' + MASK + "</span>" : '<span class="val">' + fmtAmt(t.decrypted, t.decimals) + "</span>";
    $("#asset-modal-balances").innerHTML =
      '<div class="balance-detail">' +
        '<div class="left"><span class="lbl">' + inlineShield() + "Confidential " + t.csym + "</span>" + confVal + "</div>" +
        '<div class="right"><button class="btn ghost sm" data-act="unshield">UNSHIELD</button></div></div>' +
      '<div class="balance-detail">' +
        '<div class="left"><span class="lbl">Standard ' + t.sym + '</span><span class="val">' + fmtAmt(t.pub, t.decimals) + "</span></div>" +
        '<div class="right"><button class="btn primary sm" data-act="shield">SHIELD</button></div></div>';

    var enc = $("#asset-modal-encrypted");
    if (encrypted) {
      enc.innerHTML =
        '<div class="encrypted-notice">' +
          '<div class="head"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><strong>Encrypted amount</strong></div>' +
          "<p>This balance is encrypted on-chain. Your wallet signs a permit, then the amount is decrypted locally — it never becomes public.</p>" +
          '<button class="btn primary encrypted-decrypt" id="modal-decrypt" style="width:100%;min-height:44px">' + ctaLabel("Decrypt balance", "decrypt") + "</button>" +
        "</div>";
      var db = $("#modal-decrypt");
      db.disabled = !!blockReason();
      db.addEventListener("click", function () { runDecrypt(i, db); });
    } else {
      enc.innerHTML = "";
    }

    // shield/unshield buttons route to flow
    $all("#asset-modal-balances [data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.direction = b.dataset.act === "shield" ? "shield" : "unshield";
        state.flowTokenIdx = i;
        closeModal($("#asset-modal"));
        go("shield");
        renderFlow();
      });
    });
    $("#asset-modal-send").onclick = function () {
      state.sendTokenIdx = i; closeModal($("#asset-modal")); go("send"); renderSend();
    };

    openModal($("#asset-modal"));
  }

  function inlineShield() {
    return '<span style="display:inline-grid;place-items:center;width:14px;height:14px;color:var(--accent)">' + shieldSVG() + "</span>";
  }

  function runDecrypt(i, btn) {
    var t = TOKENS[i];
    var steps = ["Signing permit…", "Decrypting…"];
    var s = 0;
    btn.disabled = true;
    (function tick() {
      btn.textContent = steps[s];
      s++;
      if (s <= steps.length) { setTimeout(tick, 900); }
      else {
        t.decrypted = t.conf;
        addActivity("Decrypt", t.csym, fmtAmt(t.conf, t.decimals));
        toast("Balance decrypted");
        renderDashboard();
        openAssetModal(i); // re-render modal with revealed value
      }
    })();
  }

  // ---------- custom token dropdowns ----------
  function buildDropdown(container, opts) {
    // opts: { getIndex, onSelect, confidential(bool), balanceOf(t) }
    function render() {
      var t = TOKENS[opts.getIndex()];
      container.innerHTML =
        '<button class="token-trigger" aria-haspopup="listbox" aria-expanded="false">' +
          avatar(t, "sm", opts.confidential) +
          "<span>" + (opts.confidential ? t.csym : t.sym) + "</span>" +
          '<span class="caret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>' +
        "</button>";
      var trigger = $(".token-trigger", container);
      trigger.addEventListener("click", function (e) { e.stopPropagation(); toggle(trigger); });
    }
    function toggle(trigger) {
      var open = $(".token-menu", container);
      if (open) { close(); return; }
      closeAllDropdowns();
      var menu = el("div", "token-menu");
      menu.setAttribute("role", "listbox");
      TOKENS.forEach(function (t, idx) {
        var bal = opts.balanceOf ? opts.balanceOf(t) : "";
        var o = el("button", "token-option" + (idx === opts.getIndex() ? " active" : ""));
        o.setAttribute("role", "option");
        o.innerHTML = avatar(t, "sm", opts.confidential) +
          '<span class="opt-meta"><span>' + (opts.confidential ? t.csym : t.sym) + "</span><small>" + t.name + "</small></span>" +
          (bal ? '<span class="opt-bal">' + bal + "</span>" : "");
        o.addEventListener("click", function (e) {
          e.stopPropagation();
          opts.onSelect(idx);
          close();
          render();
        });
        menu.appendChild(o);
      });
      container.appendChild(menu);
      trigger.setAttribute("aria-expanded", "true");
    }
    function close() {
      var m = $(".token-menu", container);
      if (m) m.remove();
      var tr = $(".token-trigger", container);
      if (tr) tr.setAttribute("aria-expanded", "false");
    }
    container._close = close;
    render();
  }
  function closeAllDropdowns() {
    $all(".token-dropdown").forEach(function (d) { if (d._close) d._close(); });
  }

  // ---------- shield / unshield flow ----------
  function renderFlow() {
    var t = TOKENS[state.flowTokenIdx];
    var shielding = state.direction === "shield";

    $("#flow-from-leg").textContent = shielding ? "You shield" : "You unshield";
    $("#flow-to-leg").textContent = "You receive";

    // from dropdown
    buildDropdown($('[data-dropdown="from"]'), {
      getIndex: function () { return state.flowTokenIdx; },
      onSelect: function (i) { state.flowTokenIdx = i; renderFlow(); resetFlowResult(); },
      confidential: !shielding,
      balanceOf: function (t) { return shielding ? fmtAmt(t.pub, t.decimals) : (t.decrypted != null ? fmtAmt(t.decrypted, t.decimals) : MASK); }
    });
    buildDropdown($('[data-dropdown="to"]'), {
      getIndex: function () { return state.flowTokenIdx; },
      onSelect: function (i) { state.flowTokenIdx = i; renderFlow(); resetFlowResult(); },
      confidential: shielding
    });

    if (shielding) {
      $("#flow-from-bal").textContent = "Balance: " + fmtAmt(t.pub, t.decimals) + " " + t.sym;
      $("#flow-to-bal").innerHTML = "Confidential balance: " + (t.decrypted != null ? fmtAmt(t.decrypted, t.decimals) + " " + t.csym : MASK);
    } else {
      $("#flow-from-bal").innerHTML = "Balance: " + (t.decrypted != null ? fmtAmt(t.decrypted, t.decimals) + " " + t.csym : MASK + " " + t.csym);
      $("#flow-to-bal").textContent = "Standard balance: " + fmtAmt(t.pub, t.decimals) + " " + t.sym;
    }
    syncOutput();
    applyCTA($("#flow-submit"), shielding ? "Shield " + t.sym : "Unshield " + t.csym, shielding ? "shield" : "unshield");
  }

  function syncOutput() {
    var v = parseFloat($("#flow-input").value);
    $("#flow-output").value = isFinite(v) && v > 0 ? v : "";
  }

  function resetFlowResult() {
    $("#flow-steps").hidden = true;
    $("#flow-steps").innerHTML = "";
    $("#flow-result").hidden = true;
  }

  function runFlow() {
    var t = TOKENS[state.flowTokenIdx];
    var shielding = state.direction === "shield";
    var amt = parseFloat($("#flow-input").value);
    if (!isFinite(amt) || amt <= 0) { toast("Enter an amount"); return; }
    if (shielding && amt > t.pub) { toast("Amount exceeds balance"); return; }

    var steps = shielding
      ? [{ t: "Check allowance", d: "Verify the confidential wrapper can pull your " + t.sym + ".", run: "Checking allowance" },
         { t: "Approve", d: "Approve " + fmtAmt(amt, t.decimals) + " " + t.sym + " for shielding.", run: "Approving" },
         { t: "Shield", d: "Wrap into confidential " + t.csym + ".", run: "Shielding" }]
      : [{ t: "Request unshield", d: "Submit an unwrap request for " + fmtAmt(amt, t.decimals) + " " + t.csym + ".", run: "Requesting" },
         { t: "Finalize", d: "Finalize and receive public " + t.sym + ".", run: "Finalizing" }];

    var box = $("#flow-steps");
    box.hidden = false;
    box.innerHTML = "";
    steps.forEach(function (st, i) {
      var s = el("div", "flow-step");
      s.dataset.i = i;
      s.innerHTML =
        '<div class="idx">' + (i + 1) + "</div>" +
        '<div class="body"><div class="row"><strong>' + st.t + '</strong><span class="tag">Pending</span></div><p>' + st.d + "</p></div>";
      box.appendChild(s);
    });
    $("#flow-result").hidden = true;
    var submit = $("#flow-submit");
    submit.disabled = true;

    var idx = 0;
    function step() {
      var nodes = $all(".flow-step", box);
      if (idx > 0) {
        nodes[idx - 1].classList.remove("active");
        nodes[idx - 1].classList.add("done");
        $(".tag", nodes[idx - 1]).textContent = "Done";
        $(".idx", nodes[idx - 1]).innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      }
      if (idx >= steps.length) { finishFlow(t, shielding, amt); return; }
      var node = nodes[idx];
      node.classList.add("active");
      $(".tag", node).innerHTML = '<span class="spinner"></span>';
      $(".idx", node).textContent = idx + 1;
      submit.textContent = steps[idx].run + "…";
      idx++;
      setTimeout(step, 1100);
    }
    step();
  }

  function finishFlow(t, shielding, amt) {
    // apply mock balance change
    if (shielding) {
      t.pub -= amt;
      t.conf += amt;
      if (t.decrypted != null) t.decrypted += amt; else t.decrypted = null;
    } else {
      var have = t.decrypted != null ? t.decrypted : t.conf;
      t.conf = Math.max(0, t.conf - amt);
      if (t.decrypted != null) t.decrypted = Math.max(0, t.decrypted - amt);
      t.pub += amt;
    }
    addActivity(shielding ? "Shield" : "Unshield", shielding ? t.csym : t.sym, fmtAmt(amt, t.decimals));

    var hash = "0x" + Math.abs(hashStr(t.sym + amt + Date.now())).toString(16).padStart(12, "0") + "9c4f2a1e";
    var res = $("#flow-result");
    res.hidden = false;
    res.innerHTML =
      '<div class="rhead"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
        (shielding ? "Shielded" : "Unshielded") + " successfully</div>" +
      '<div class="grid">' +
        "<span>Amount</span><strong>" + fmtAmt(amt, t.decimals) + " " + (shielding ? t.sym + " → " + t.csym : t.csym + " → " + t.sym) + "</strong>" +
        "<span>Network</span><strong>Sepolia</strong>" +
        "<span>Transaction</span><a href=\"https://sepolia.etherscan.io/tx/" + hash + "\" target=\"_blank\" rel=\"noopener\">" + hash.slice(0, 22) + "…</a>" +
      "</div>";
    $("#flow-input").value = "";
    syncOutput();
    renderFlow();
    renderDashboard();
    toast((shielding ? "Shield" : "Unshield") + " complete");
  }

  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

  // ---------- send ----------
  function renderSend() {
    buildDropdown($('[data-dropdown="send"]'), {
      getIndex: function () { return state.sendTokenIdx; },
      onSelect: function (i) { state.sendTokenIdx = i; renderSend(); },
      confidential: true,
      balanceOf: function (t) { return t.decrypted != null ? fmtAmt(t.decrypted, t.decimals) : MASK; }
    });
    var t = TOKENS[state.sendTokenIdx];
    $("#send-bal").innerHTML = t.decrypted != null
      ? "Confidential balance: " + fmtAmt(t.decrypted, t.decimals) + " " + t.csym
      : "Confidential balance: " + MASK + " — decrypt to see exact.";
    applyCTA($("#send-submit"), "Send " + t.csym, "send");
  }

  function validAddr(a) { return /^0x[a-fA-F0-9]{40}$/.test(a.trim()); }

  function runSend() {
    var to = $("#send-to").value.trim();
    var amt = parseFloat($("#send-amount").value);
    var err = $("#send-to-err");
    if (!validAddr(to)) { err.hidden = false; return; }
    err.hidden = true;
    if (!isFinite(amt) || amt <= 0) { toast("Enter an amount"); return; }
    var t = TOKENS[state.sendTokenIdx];
    var btn = $("#send-submit");
    btn.disabled = true;
    var labels = ["Encrypting amount…", "Sending…"];
    var s = 0;
    (function tick() {
      btn.textContent = labels[s]; s++;
      if (s <= labels.length) setTimeout(tick, 950);
      else {
        addActivity("Send", t.csym, fmtAmt(amt, t.decimals) + " → " + to.slice(0, 6) + "…" + to.slice(-4));
        toast("Sent confidentially");
        $("#send-to").value = ""; $("#send-amount").value = "";
        renderSend();
      }
    })();
  }

  // ---------- faucet ----------
  function renderFaucet() {
    var grid = $("#faucet-grid");
    grid.innerHTML = "";
    TOKENS.forEach(function (t, i) {
      var b = el("button", "faucet-token" + (i === state.faucetTokenIdx ? " active" : ""));
      b.type = "button";
      b.innerHTML = avatar(t, "sm", false) + "<span>" + t.sym + "</span>";
      b.addEventListener("click", function () { state.faucetTokenIdx = i; renderFaucet(); });
      grid.appendChild(b);
    });
    applyCTA($("#faucet-submit"), "Mint " + TOKENS[state.faucetTokenIdx].sym, "mint");
  }

  function runFaucet() {
    var t = TOKENS[state.faucetTokenIdx];
    var amt = parseFloat($("#faucet-amount").value);
    if (!isFinite(amt) || amt <= 0) { toast("Enter an amount"); return; }
    if (amt > 1000000) { toast("Max 1,000,000 per call"); return; }
    var btn = $("#faucet-submit");
    btn.disabled = true; btn.textContent = "Minting…";
    setTimeout(function () {
      t.pub += amt;
      addActivity("Faucet", t.sym, fmtAmt(amt, t.decimals));
      toast("Minted " + fmtAmt(amt, t.decimals) + " " + t.sym);
      renderFaucet(); renderDashboard();
    }, 1200);
  }

  // ---------- activity ----------
  var activity = [
    { kind: "Shield", tok: "cUSDCMock", amt: "500.00", when: "2h ago", hash: "0x7ab3…4f2a" },
    { kind: "Decrypt", tok: "cUSDCMock", amt: "640.50", when: "2h ago", hash: null },
    { kind: "Faucet", tok: "USDTMock", amt: "1,000.00", when: "5h ago", hash: "0x19cd…8b0e" },
    { kind: "Unshield", tok: "WETHMock", amt: "0.10", when: "1d ago", hash: "0xff54…5f3f" }
  ];
  var ICONS = {
    Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    Unshield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    Send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    Decrypt: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    Faucet: '<path d="M12 2v6"/><path d="M7 8v5a5 5 0 0 0 10 0V8"/><path d="M12 18v4"/>'
  };
  function addActivity(kind, tok, amt) {
    activity.unshift({ kind: kind, tok: tok, amt: amt, when: "just now", hash: kind === "Decrypt" ? null : "0x" + Math.abs(hashStr(tok + amt)).toString(16).slice(0, 4) + "…" + Math.abs(hashStr(amt + kind)).toString(16).slice(0, 4) });
    $("#activity-count").textContent = activity.length;
    renderActivity();
  }
  function renderActivity() {
    var list = $("#activity-list");
    list.innerHTML = "";
    if (!activity.length) {
      list.innerHTML = '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><strong>No activity yet</strong><span>Your wrap, unwrap, decrypt and faucet events will show here.</span></div>';
      return;
    }
    activity.forEach(function (a) {
      var it = el("div", "activity-item");
      it.innerHTML =
        '<div class="activity-left"><span class="activity-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[a.kind] || ICONS.Send) + "</svg></span>" +
          '<span class="activity-meta"><strong>' + a.kind + "</strong><span>" + a.tok + " · " + a.when + "</span></span></div>" +
        '<div class="activity-right"><span class="amt">' + a.amt + "</span>" +
          (a.hash
            ? '<a href="https://sepolia.etherscan.io/" target="_blank" rel="noopener">' + a.hash + "</a>"
            : '<span class="local-tag">local</span>') +
        "</div>";
      list.appendChild(it);
    });
  }

  // ---------- modals ----------
  function openModal(m) { m.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeModal(m) { m.classList.remove("open"); document.body.style.overflow = ""; }

  // ---------- render all ----------
  function renderAll() {
    renderDashboard();
    renderFlow();
    renderSend();
    renderFaucet();
    renderActivity();
    // add/create token CTAs
    applyCTA($("#add-token-submit"), "Add token", "add");
    applyCTA($("#create-token-submit"), "Deploy token", "deploy");
  }

  // ---------- wire events ----------
  function init() {
    $all(".nav-item, [data-view]").forEach(function (b) {
      if (b.dataset.view) b.addEventListener("click", function () { go(b.dataset.view); });
    });

    $("#sidebar-toggle").addEventListener("click", openSidebar);
    $("#scrim").addEventListener("click", closeSidebar);

    // wallet
    $("#wallet-connect").addEventListener("click", function () {
      state.connected = true; state.wrongNet = false; setConnected(true);
      $("#wallet-addr").textContent = "0x8f3a…C21b";
      toast("Wallet connected");
    });
    $("#wallet-menu-trigger").addEventListener("click", function (e) {
      e.stopPropagation();
      var m = $("#wallet-menu");
      m.hidden = !m.hidden;
      this.setAttribute("aria-expanded", String(!m.hidden));
    });
    $("#copy-addr").addEventListener("click", function () { toast("Address copied"); $("#wallet-menu").hidden = true; });
    $("#wallet-switch-net").addEventListener("click", function () {
      state.wrongNet = false; renderNetPill(); renderAll(); $("#wallet-menu").hidden = true; toast("Switched to Sepolia");
    });
    $("#wallet-disconnect").addEventListener("click", function () { setConnected(false); toast("Disconnected"); });

    // demo: toggle wrong-network by clicking the net pill while connected
    $("#net-pill").addEventListener("click", function () {
      if (!state.connected) return;
      state.wrongNet = !state.wrongNet; renderNetPill(); renderAll();
    });
    $("#net-pill").style.cursor = "pointer";
    $("#net-pill").title = "Demo: toggle network state";

    // dashboard
    $("#toggle-empty").addEventListener("click", function () { state.showEmpty = !state.showEmpty; renderDashboard(); });
    $("#add-token-btn").addEventListener("click", function () { openModal($("#token-modal")); });

    // flow
    $("#flow-input").addEventListener("input", function () { syncOutput(); resetFlowResult(); });
    $("#flow-max").addEventListener("click", function () {
      var t = TOKENS[state.flowTokenIdx];
      var v = state.direction === "shield" ? t.pub : (t.decrypted != null ? t.decrypted : 0);
      $("#flow-input").value = v || ""; syncOutput();
    });
    $("#flow-swap").addEventListener("click", function () {
      state.direction = state.direction === "shield" ? "unshield" : "shield";
      resetFlowResult(); renderFlow();
    });
    $("#flow-submit").addEventListener("click", function () { if (!blockReason()) runFlow(); });

    // send
    $("#send-submit").addEventListener("click", function () { if (!blockReason()) runSend(); });
    $("#send-to").addEventListener("input", function () { $("#send-to-err").hidden = true; });

    // faucet
    $("#faucet-submit").addEventListener("click", function () { if (!blockReason()) runFaucet(); });

    // token modal tabs
    $all("#token-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        $all("#token-tabs button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var add = b.dataset.tab === "add";
        $("#token-tab-add").hidden = !add;
        $("#token-tab-create").hidden = add;
      });
    });

    // modal close
    $all("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeModal(b.closest(".modal-backdrop")); });
    });
    $all(".modal-backdrop").forEach(function (bd) {
      bd.addEventListener("click", function (e) { if (e.target === bd) closeModal(bd); });
    });

    // global close: dropdowns, wallet menu, esc
    document.addEventListener("click", function () { closeAllDropdowns(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeAllDropdowns();
        $("#wallet-menu").hidden = true;
        $all(".modal-backdrop.open").forEach(closeModal);
        closeSidebar();
      }
    });

    setConnected(false);
    go("dashboard");
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
