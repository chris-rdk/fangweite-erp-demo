(() => {
  const D = window.AppData;
  const SEED = JSON.parse(JSON.stringify(window.AppData));
  const STORE_KEY = "fw-erp-v40";
  const OPEN_SO = new Set(["待审核", "审核通过", "已分仓", "出库中"]);
  const OPEN_PO = new Set(["待审核", "待发货", "已发货", "部分入库"]);
  const TODAY = "2026-08-30";
  const SESSION_KEY = "fw-erp-session";
  const NAV_KEY = "fw-erp-nav-collapsed";
  const ACCOUNTS = Object.fromEntries((D.roles || []).map((r) => [String(r.account || "").toLowerCase(), r.id]));
  const SALES_CHANNELS = D.company.salesChannels || ["电商", "线下经销商"];
  const LEAD_SOURCES = ["展会", "广告", "官网", "推荐", "电商"];
  const LEAD_STATUSES = ["已转商机", "无效"];
  const LEAD_OPEN = new Set(["待跟进", "已联系", "有效"]);
  const salesChannelOpts = (selected) => SALES_CHANNELS.map((c) => `<option${c === selected ? " selected" : ""}>${c}</option>`).join("");
  const $ = (sel, root = document) => root.querySelector(sel);

  const NAV = [
    { group: "总经办", items: [
      { id: "ai", label: "AI 工作台", ico: "✦" },
      { id: "dashboard", label: "经营驾驶舱", ico: "◉" },
      { id: "reports", label: "业务报表中心", ico: "▣" },
    ]},
    { group: "市场部", items: [
      { id: "leads", label: "线索管理", ico: "◎" },
    ]},
    { group: "销售部", items: [
      { id: "opps", label: "商机管理", ico: "◇" },
      { id: "orders", label: "订单中心", ico: "▤" },
    ]},
    { group: "供应链", items: [
      { id: "fulfillment", label: "采购履约", ico: "▤" },
      { id: "pos", label: "采购订单", ico: "▥" },
      { id: "products", label: "商品管理", ico: "▢" },
      { id: "inventory", label: "库存管理", ico: "▦" },
    ]},
    { group: "财务", items: [
      { id: "fin-ar", label: "应收管理", ico: "¥" },
      { id: "fin-ap", label: "应付管理", ico: "₮" },
      { id: "fin-cost", label: "库存成本", ico: "▦" },
      { id: "fin-ana", label: "经营分析", ico: "▣" },
    ]},
  ];

  const TITLES = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));
  const RIGHTS = {
    gm: ["*"],
    "sales-lead": ["crm", "order-create", "export"],
    sales: ["crm", "order-create", "export"],
    warehouse: ["stock", "fulfill", "export"],
    finance: ["finance", "export"],
    marketing: ["lead-capture", "export"],
  };

  const state = { role: "gm", route: "dashboard", filters: {}, page: 1, navCollapsed: false };
  const aiChat = [];
  const AI_SUGGEST = [
    "本月销售额和回款情况",
    "哪些订单缺货",
    "Kanglin 的应收和订单",
    "FW-VIT-002 库存和采购需求",
    "待审核的销售订单",
    "SO-202608-001 履约情况",
    "PO-202608-002 是为哪张订单补货",
  ];
  let confirmResolver = null;

  function hydrate() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.keys(SEED).forEach((k) => {
        if (saved[k] != null) D[k] = saved[k];
      });
    } catch (_) { /* ignore */ }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); } catch (_) { /* ignore */ }
  }
  hydrate();
  D.roles = JSON.parse(JSON.stringify(SEED.roles));
  syncLeadLinks();
  ["purchaseReturns", "salesReturns", "invoices", "quality", "gsp", "vouchers", "outsource", "priceLists", "replenishments"].forEach((k) => {
    if (!Array.isArray(D[k])) D[k] = [];
  });
  if (!D.settings) D.settings = { nearDays: 30, banDays: 0 };

  function orderLines(o) {
    if (!o) return [];
    if (Array.isArray(o.lines) && o.lines.length) return o.lines;
    o.lines = [{
      id: 1,
      productId: o.productId,
      qty: o.qty,
      unitPrice: o.unitPrice,
      discount: o.discount || 0,
      amount: o.amount,
    }];
    return o.lines;
  }
  function lineSummary(o) {
    const lines = orderLines(o);
    if (!lines.length) return "—";
    return lines.map((l) => {
      const p = product(l.productId);
      return p ? `${p.sku} ×${l.qty}` : "—";
    }).join("；");
  }
  function lineNames(o) {
    return orderLines(o).map((l) => product(l.productId)?.name || "").filter(Boolean).join("；");
  }
  function lineQtySum(o) {
    return orderLines(o).reduce((s, l) => s + Number(l.qty || 0), 0);
  }
  function lineSkuText(o) {
    const skus = orderLines(o).map((l) => product(l.productId)?.sku).filter(Boolean);
    return skus.length ? skus.join("；") : "—";
  }
  function orderAmtOf(o) {
    const lines = orderLines(o);
    if (lines.length) {
      return +lines.reduce((s, l) => s + Number(l.amount != null ? l.amount : Number(l.qty || 0) * Number(l.unitPrice || 0)), 0).toFixed(2);
    }
    return +Number(o?.amount || 0).toFixed(2);
  }
  function syncOrderMaster() {
    (D.salesOrders || []).forEach((o) => {
      const lines = orderLines(o);
      if (!lines.length) return;
      o.qty = lineQtySum(o);
      o.amount = orderAmtOf(o);
      o.productId = lines[0].productId;
      o.unitPrice = lines[0].unitPrice;
      o.receivable = ["已取消", "已驳回"].includes(o.status) ? 0 : o.amount;
      ensureOrderLineNos(o);
    });
  }
  function orderNeedBy(o) {
    return String(o?.needBy || "").slice(0, 10) || "—";
  }
  function applyLines(so, lines) {
    so.lines = lines;
    so.productId = lines[0].productId;
    so.qty = lines.reduce((s, l) => s + Number(l.qty), 0);
    so.unitPrice = lines[0].unitPrice;
    so.discount = lines.reduce((s, l) => s + Number(l.discount || 0), 0);
    so.amount = lines.reduce((s, l) => s + Number(l.amount), 0);
    so.receivable = ["已取消", "已驳回"].includes(so.status) ? 0 : so.amount;
    ensureOrderLineNos(so);
  }
  function lineNoOf(o, line) {
    if (!o || !line) return "—";
    return line.lineNo || `${o.orderNo}-${String(line.id || 1).padStart(2, "0")}`;
  }
  function ensureOrderLineNos(o) {
    if (!o) return [];
    orderLines(o).forEach((l, i) => {
      if (!l.id) l.id = i + 1;
      l.lineNo = `${o.orderNo}-${String(l.id).padStart(2, "0")}`;
    });
    return o.lines;
  }
  syncOrderMaster();
  function oppNoOf(o) {
    return (o && o.oppNo) || (o ? "OPP-" + String(o.id).padStart(3, "0") : "—");
  }
  function ensureOppNo(o) {
    if (o && !o.oppNo) o.oppNo = "OPP-" + String(o.id).padStart(3, "0");
    return o;
  }
  function orderSourceOpp(o) {
    if (!o || o.source !== "CRM成交" || !o.sourceId) return null;
    return byId(D.opportunities, o.sourceId) || null;
  }
  function orderSourceLead(o) {
    const opp = orderSourceOpp(o);
    return opp ? (D.leads || []).find((x) => x.id === opp.leadId) || null : null;
  }
  function replenishmentOfLine(o, line) {
    return (D.replenishments || []).find((r) => r.orderId === o.id && (r.lineId === line.id || r.lineNo === line.lineNo)) || null;
  }
  function replenishmentsOfOrder(o) {
    return (D.replenishments || []).filter((r) => r.orderId === o.id);
  }
  function poOfReplenishment(r) {
    if (!r) return null;
    return byId(D.purchaseOrders, r.poId) || (D.purchaseOrders || []).find((p) => poLines(p).some((l) => l.replenishmentId === r.id)) || null;
  }
  function demandTraceOf(rp) {
    if (!rp) return null;
    const so = order(rp.orderId);
    const line = so ? orderLines(so).find((l) => l.id === rp.lineId || l.lineNo === rp.lineNo) : null;
    const opp = so ? orderSourceOpp(so) : null;
    const lead = so ? orderSourceLead(so) : null;
    return { rp, so, line, opp, lead, customer: so ? customer(so.customerId) : null, po: poOfReplenishment(rp) };
  }
  function parseFormLines(fd, customerId) {
    const pids = fd.getAll("productId").map(Number);
    const qtys = fd.getAll("qty").map(Number);
    const lines = [];
    pids.forEach((pid, i) => {
      const p = product(pid);
      const qty = Number(qtys[i]);
      if (!p || !(qty > 0)) return;
      const unitPrice = listPrice(customerId, pid);
      lines.push({
        id: lines.length + 1,
        productId: pid,
        qty,
        unitPrice,
        discount: 0,
        amount: qty * unitPrice,
      });
    });
    return lines;
  }
  function poLines(p) {
    if (!p) return [];
    if (Array.isArray(p.lines) && p.lines.length) return p.lines;
    p.lines = [{
      id: 1, productId: p.productId, qty: p.qty, unitPrice: p.unitPrice,
      receivedQty: p.receivedQty || (p.status === "已入库" ? p.qty : 0),
    }];
    return p.lines;
  }
  function poAmount(p) { return poLines(p).reduce((s, l) => s + l.qty * l.unitPrice, 0); }
  function poQty(p) { return poLines(p).reduce((s, l) => s + Number(l.qty || 0), 0); }
  function poRecv(p) { return poLines(p).reduce((s, l) => s + Number(l.receivedQty || 0), 0); }
  function poRemain(p) { return poQty(p) - poRecv(p); }
  function poSkuText(p) {
    return poLines(p).map((l) => product(l.productId)?.sku).filter(Boolean).join(" / ") || "—";
  }
  function cfg() { return D.settings || { nearDays: 30, banDays: 0 }; }
  function listPrice(customerId, productId) {
    const p = product(productId);
    if (!p) return 0;
    const c = customer(customerId);
    const level = c?.priceLevel || c?.type || "零售";
    const hit = (D.priceLists || []).find((x) => x.level === level && x.productId === productId);
    if (hit) return hit.price;
    if (level === "经销商") return Math.round(p.price * 0.85);
    if (level === "VIP") return Math.round(p.price * 0.78);
    return p.price;
  }
  function matchedAr(ar) {
    return D.reconciliations.filter((x) => x.receivableId === ar.id && x.status === "匹配成功").reduce((s, x) => s + x.amount, 0);
  }
  function arOpenOf(customerId) {
    return D.receivables
      .filter((r) => r.customerId === customerId && r.status !== "已回款")
      .reduce((s, r) => s + Math.max(0, r.amount - matchedAr(r)), 0);
  }
  function gspPush(type, ref, productId, batchNo, qty, note) {
    const p = product(productId);
    D.gsp.unshift({
      id: nextId(D.gsp), type, ref, sku: p?.sku || "", batchNo: batchNo || "",
      qty, user: currentRole().name, at: nowStr(), note: note || "",
    });
  }
  function ensureVoucher(summary, debit, credit, amount, ref) {
    if ((D.vouchers || []).find((v) => v.ref === ref && v.summary === summary)) return;
    D.vouchers.unshift({
      id: nextId(D.vouchers),
      no: seqNo("JZ-202608-", D.vouchers, "no"),
      date: TODAY, summary, debit, credit, amount, ref, status: "已过账",
    });
  }
  (D.salesOrders || []).forEach((o) => { orderLines(o); ensureOrderLineNos(o); });
  (D.purchaseOrders || []).forEach((p) => poLines(p));
  (D.opportunities || []).forEach(ensureOppNo);

  const money = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  const money2 = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n) => (n * 100).toFixed(1) + "%";
  const byId = (arr, id) => (arr || []).find((x) => x.id === Number(id));
  const product = (id) => byId(D.products, id);
  const warehouse = (id) => byId(D.warehouses, id);
  const warehouseLabel = (id) => {
    const w = typeof id === "object" ? id : warehouse(id);
    return w ? `仓库${w.id}` : "—";
  };
  const customer = (id) => byId(D.customers, id);
  const seller = (id) => byId(D.sales, id);
  const supplier = (id) => byId(D.suppliers, id);
  const order = (id) => byId(D.salesOrders, id);
  const avail = (row) => row.frozen ? 0 : Number(row.qty) - Number(row.lockQty);
  const daysTo = (dateStr) => Math.ceil((new Date(dateStr + "T00:00:00") - new Date(TODAY + "T00:00:00")) / 86400000);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nowStr = () => TODAY + " " + new Date().toTimeString().slice(0, 5);
  const nextId = (arr) => Math.max(0, ...(arr || []).map((x) => x.id)) + 1;
  const seqNo = (prefix, arr, field) => {
    const nums = (arr || []).map((x) => Number(String(x[field]).replace(/\D/g, "").slice(-3)) || 0);
    return prefix + String(Math.max(0, ...nums, 0) + 1).padStart(3, "0");
  };
  const hasRight = (r) => {
    const rs = RIGHTS[state.role] || [];
    return rs.includes("*") || rs.includes(r);
  };
  const currentRole = () => D.roles.find((r) => r.id === state.role);
  const can = (mod) => {
    const inNav = NAV.some((g) => g.items.some((i) => i.id === mod));
    if (!inNav) return false;
    return state.role === "gm" || (currentRole()?.modules || []).includes(mod);
  };
  const mySalesId = () => {
    if (state.role === "sales-lead" || state.role === "sales") return D.sales[0]?.id || 1;
    const s = D.sales.find((x) => x.name === currentRole().name);
    return s ? s.id : null;
  };
  const isSalesScope = () => state.role === "sales";

  function maskPhone(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length < 7) return raw || "—";
    return d.slice(0, 3) + "****" + d.slice(-4);
  }
  function showPhone(raw) {
    if (hasRight("crm") && !hasRight("*") || state.role === "sales-lead" || state.role === "sales" || state.role === "marketing") return raw || "—";
    if (state.role === "finance") return maskPhone(raw);
    return maskPhone(raw);
  }

  function scopedLeads() {
    if (!isSalesScope()) return D.leads.slice();
    const sid = mySalesId();
    return D.leads.filter((l) => l.assignedTo === sid || l.assignedTo == null);
  }
  function scopedOpps() {
    if (!isSalesScope()) return D.opportunities.slice();
    return D.opportunities.filter((o) => o.ownerId === mySalesId());
  }
  function scopedOrders() {
    if (!isSalesScope()) return D.salesOrders.slice();
    return D.salesOrders.filter((o) => (customer(o.customerId)?.ownerId || 0) === mySalesId() || (customer(o.customerId)?.ownerId || 0) === 0);
  }
  function outboundOf(o) {
    return (D.outbound || []).filter((x) => x.orderId === o.id);
  }
  function isFulfillView() {
    return state.route === "fulfillment" || state.role === "warehouse";
  }
  function orderHome() {
    if (state.role === "warehouse" || !can("orders")) return "fulfillment";
    if (state.route === "fulfillment") return "fulfillment";
    return "orders";
  }
  function salesOrderStatus(o) {
    if (["待审核", "已驳回", "已取消", "已发货", "已完成"].includes(o.status)) return o.status;
    return "履约中";
  }
  function fulfillProgress(o) {
    const outs = outboundOf(o);
    if (!outs.length) return o.status === "待审核" ? "待预占" : "尚未预占";
    const pending = outs.filter((x) => x.status === "待出库").length;
    const done = outs.filter((x) => x.status === "已发货").length;
    return [pending ? `待出库 ${pending} 行` : "", done ? `已出库 ${done} 行` : ""].filter(Boolean).join(" · ") || "—";
  }
  function orderSourceCell(o) {
    const opp = orderSourceOpp(o);
    if (opp) return `<button class="linkish" data-act="opp" data-id="${opp.id}">${esc(oppNoOf(opp))}</button>`;
    return esc(o.source || "手工录入");
  }
  function orderSearchText(o, mode) {
    const sku = orderLines(o).map((l) => {
      const p = product(l.productId);
      return p ? `${p.sku} ${p.name}` : "";
    }).join(" ");
    const c = customer(o.customerId);
    if (mode === "sales") {
      const opp = orderSourceOpp(o);
      const lead = orderSourceLead(o);
      return [o.orderNo, o.source, oppNoOf(opp), leadNoOf(lead), sku, o.needBy].join(" ");
    }
    const extra = [
      warehouse(o.warehouseId)?.name,
      ...outboundOf(o).flatMap((ob) => [ob.outboundNo, ob.batchNo]),
      ...replenishmentsOfOrder(o).flatMap((r) => [r.no, r.lineNo, poOfReplenishment(r)?.poNo]),
    ];
    return [o.orderNo, c?.name, sku, o.needBy, ...extra].join(" ");
  }
  function filterOrderList(mode) {
    const f = state.filters;
    let list = scopedOrders();
    if (f.status === "缺货") list = list.filter((x) => orderHasShortage(x));
    else if (f.status === "履约中") list = list.filter((x) => ["审核通过", "已分仓", "出库中"].includes(x.status));
    else if (f.status === "待出库") list = list.filter((x) => outboundOf(x).some((ob) => ob.status === "待出库"));
    else if (f.status) list = list.filter((x) => x.status === f.status);
    if (mode === "sales" && f.channel) list = list.filter((x) => x.channel === f.channel);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((x) => orderSearchText(x, mode).toLowerCase().includes(q));
    }
    return list;
  }
  function scopedCustomers() {
    if (!isSalesScope()) return D.customers.slice();
    return D.customers.filter((c) => c.ownerId === mySalesId() || c.ownerId === 0);
  }

  function parseYmd(s) {
    const m = String(s || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dayDiff(from, to) {
    const a = parseYmd(from), b = parseYmd(to);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }
  function leadOpp(l) {
    if (!l) return null;
    return D.opportunities.find((o) => o.id === l.opportunityId || o.leadId === l.id) || null;
  }
  function oppOrders(o) {
    if (!o) return [];
    return D.salesOrders.filter((x) => x.source === "CRM成交" && x.sourceId === o.id);
  }
  function leadOrders(l) {
    return oppOrders(leadOpp(l));
  }
  function leadFollowStats(id) {
    const logs = (D.followups || []).filter((f) => f.leadId === id).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const last = logs[0];
    return { count: logs.length, lastAt: last?.at || "", next: last?.next || "", last };
  }
  function leadCpl(l) {
    const cost = (D.campaignCost || []).find((x) => x.channel === l.channel);
    if (!cost) return null;
    const n = D.leads.filter((x) => x.channel === l.channel).length || 1;
    return Math.round((cost.cost || 0) / n);
  }
  function leadProgressState(l) {
    const so = leadOrders(l)[0];
    const opp = leadOpp(l);
    const st = leadFollowStats(l.id);
    if (l.status === "无效") return { text: l.closeReason || "无效", kind: "invalid" };
    if (so) return { text: so.orderNo + " · " + so.status, kind: "order", id: so.id };
    if (opp) return { text: opp.stage, kind: "opp", id: opp.id };
    if (l.status === "待跟进") return { text: "待写进展", kind: "pool" };
    if (st.next && st.next <= TODAY) return { text: st.next + " 到期", kind: "due" };
    if (st.next) return { text: "下次 " + st.next, kind: "follow" };
    return { text: st.count ? "进展中" : "待写进展", kind: "follow" };
  }
  function writeLeadProgress(l) {
    if (!l) return null;
    const p = leadProgressState(l);
    l.progress = p.text;
    return p;
  }
  function progressHtml(p) {
    if (!p) return "—";
    if (p.kind === "order") return `<button class="linkish" data-act="order" data-id="${p.id}">${esc(p.text)}</button>`;
    if (p.kind === "opp") return `<button class="linkish" data-act="opp" data-id="${p.id}">${esc(p.text)}</button>`;
    if (p.kind === "due") return `<span style="color:var(--warn)">${esc(p.text)}</span>`;
    return esc(p.text);
  }
  function leadProgress(l) {
    return progressHtml(writeLeadProgress(l));
  }
  function leadSourceText(l) {
    return (l && l.source) || "—";
  }
  function leadNoOf(l) {
    return (l && l.leadNo) || (l ? "LD-" + String(l.id).padStart(3, "0") : "—");
  }
  function leadProduct(l) {
    return l?.productId ? product(l.productId) : null;
  }
  function leadSkuHtml(l) {
    const so = leadOrders(l)[0];
    if (so) return esc(lineSkuText(so));
    const p = leadProduct(l);
    if (!p) return esc(l?.interest || "—");
    return `${esc(p.sku)}<div class="tiny">${esc(p.name)}</div>`;
  }
  function leadCustomerName(l) {
    if (!l) return "—";
    if (l.company && l.company !== "Personal") return l.company;
    return l.name || "—";
  }
  function leadIsOpen(l) {
    return !!(l && LEAD_OPEN.has(l.status));
  }
  function leadStatusHtml(l) {
    if (l.status === "已转商机" || l.status === "无效") return badge(l.status);
    return "—";
  }
  function acquireTypeOfSource(source) {
    return ["广告", "官网", "电商"].includes(source) ? "线上投放" : "线下活动";
  }
  function applyLeadSource(l, source) {
    l.source = LEAD_SOURCES.includes(source) ? source : "展会";
    l.channel = l.source;
    l.acquireType = acquireTypeOfSource(l.source);
    l.salesChannel = l.source === "电商" ? "电商" : "线下经销商";
  }
  function normalizeLeadStatus(s) {
    return ({ 待分配: "待跟进", 跟进中: "已联系", 已转化: "已转商机" }[s] || s);
  }
  function leadOppLink(l) {
    const opp = leadOpp(l);
    return opp ? `<button class="linkish" data-act="opp" data-id="${opp.id}">${esc(oppNoOf(opp))}</button>` : "—";
  }
  function leadOrderLink(l) {
    const so = leadOrders(l)[0];
    return so ? `<button class="linkish" data-act="order" data-id="${so.id}">${esc(so.orderNo)}</button>` : "—";
  }
  function oppLeadLink(o) {
    const lead = o ? D.leads.find((l) => l.id === o.leadId) : null;
    return lead ? `<button class="linkish" data-act="lead" data-id="${lead.id}">${esc(leadNoOf(lead))}</button>` : "—";
  }
  function oppOrderLink(o) {
    const so = oppOrders(o)[0];
    return so ? `<button class="linkish" data-act="order" data-id="${so.id}">${esc(so.orderNo)}</button>` : "—";
  }
  function canWriteLead() {
    return hasRight("lead-capture") || hasRight("*");
  }
  function leadOwner(l) {
    if (l?.ownerName) return l.ownerName;
    if (l?.assignedTo) return seller(l.assignedTo)?.name || "";
    return "";
  }
  function applyOwnerName(l, name) {
    if (!l) return;
    l.ownerName = String(name || "").trim();
    const s = D.sales.find((x) => x.name === l.ownerName);
    l.assignedTo = s ? s.id : null;
  }
  function defaultOwnerName() {
    return seller(mySalesId())?.name || currentRole()?.name || "";
  }
  function canDeleteLead(l) {
    if (!l || !canWriteLead()) return false;
    if (leadOrders(l).length) return false;
    if (leadOpp(l)) return false;
    return true;
  }
  function oppProgressState(o) {
    const so = oppOrders(o)[0];
    if (so) return { text: so.orderNo + " · " + so.status, kind: "order", id: so.id };
    if (o.stage === "丢单") return { text: o.lossReason || "丢单", kind: "lost" };
    if (o.stage === "成交") return { text: "待下单", kind: "win" };
    return { text: o.expected ? o.stage + " · " + o.expected.slice(5) : o.stage, kind: "stage" };
  }
  function syncLeadLinks() {
    (D.leads || []).forEach((l) => {
      if (!l.capturedBy) l.capturedBy = "Marketing";
      if (!l.capturedDept) l.capturedDept = "市场部";
      if (!l.ownerName && l.assignedTo) l.ownerName = seller(l.assignedTo)?.name || "";
      const opp = (D.opportunities || []).find((o) => o.id === l.opportunityId || o.leadId === l.id);
      if (!l.leadNo) l.leadNo = "LD-" + String(l.id).padStart(3, "0");
      l.status = normalizeLeadStatus(l.status);
      if (!l.source) applyLeadSource(l, l.acquireType === "线上投放" ? "广告" : "展会");
      if (l.status === "无效") {
        if (opp) l.opportunityId = opp.id;
        writeLeadProgress(l);
        return;
      }
      if (opp) {
        l.opportunityId = opp.id;
        l.status = "已转商机";
        if (!l.convertedAt) l.convertedAt = opp.closeDate ? opp.closeDate + " 00:00" : l.createdAt;
        if (!l.potential) l.potential = opp.amount;
        if (!opp.amount && l.potential) opp.amount = l.potential;
      } else {
        l.opportunityId = null;
        if (l.status === "已转商机") l.status = "待跟进";
      }
      writeLeadProgress(l);
    });
  }
  function selOpts(list, selected) {
    return list.map((x) => `<option${x === selected ? " selected" : ""}>${x}</option>`).join("");
  }

  function badge(status) {
    const map = {
      上架: "ok", 下架: "mute", 合作中: "ok",
      待分配: "warn", 跟进中: "info", 已转化: "ok",
      待跟进: "warn", 已联系: "info", 有效: "ok", 已转商机: "ok", 无效: "mute",
      需求确认: "info", 方案报价: "info", 商务谈判: "warn", 成交: "ok", 丢单: "danger",
      待审核: "warn", 审核通过: "info", 已分仓: "info", 出库中: "warn", 已发货: "ok", 已完成: "ok", 已取消: "mute", 已驳回: "danger",
      待发货: "warn", 已入库: "ok", 待出库: "warn", 部分入库: "info",
      待收款: "warn", 部分回款: "info", 已回款: "ok", 坏账: "danger",
      未出库: "mute", 已收款: "ok", 部分收款: "info", 未收款: "warn", 逾期: "danger",
      未入库: "mute", 未付款: "warn", 待开票: "warn", 金额差异: "danger",
      出库差异: "warn", 开票差异: "warn", 采购差异: "info",
      已付款未入库: "danger", 已入库未收票: "warn", 发票金额不符: "danger",
      重复付款: "danger", 超额付款: "danger", 滞销: "warn",
      待核销: "warn", 已核销: "ok", 匹配成功: "ok", 异常待处理: "danger",
      缺货: "danger", 临期: "warn", 低于安全库存: "warn", 正常: "ok", 过期禁售: "danger", 冻结: "danger",
      待采购: "warn", 已覆盖: "ok",
      已发布: "ok", 评审中: "warn", 草稿: "mute",
      待付款: "warn", 待核对发票: "info", 已付款: "ok",
      已开具: "ok", 待开票: "warn", 已红冲: "mute",
      合格: "ok", 不合格: "danger", 待检: "warn",
      已过账: "ok", 待过账: "warn",
      入库: "ok", 出库: "warn", 锁定: "info", 盘盈: "ok", 盘亏: "danger", 调拨出: "info", 调拨入: "info",
      生产中: "info", 待放行: "warn", 已退货: "ok", 待入库: "warn",
      已批准: "ok", 已驳回: "danger",
    };
    return `<span class="${map[status] || "mute"}-tag">${esc(status)}</span>`;
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }
  function closeDrawer() {
    $("#drawer").hidden = true;
    $("#drawerMask").hidden = true;
    $("#drawer").classList.remove("wide");
  }
  function openDrawer(html, wide) {
    $("#drawer").innerHTML = html;
    $("#drawer").hidden = false;
    $("#drawerMask").hidden = false;
    $("#drawer").classList.toggle("wide", !!wide);
  }
  function confirmAsk(text) {
    return new Promise((resolve) => {
      confirmResolver = resolve;
      $("#confirmText").textContent = text;
      $("#confirmMask").hidden = false;
    });
  }

  function audit(action, target, detail) {
    D.auditLogs.unshift({
      id: nextId(D.auditLogs),
      at: nowStr(),
      user: currentRole().name,
      role: currentRole().title,
      action, target, detail,
    });
  }

  function addTx(row) {
    D.inventoryTx.unshift({
      id: nextId(D.inventoryTx),
      created_by: currentRole().name,
      at: nowStr(),
      ...row,
    });
  }

  function skuAvail(productId) {
    return fifoLots(productId).reduce((s, i) => s + avail(i), 0);
  }
  function skuAvailAt(productId, warehouseId) {
    const ban = cfg().banDays || 0;
    return (D.inventory || [])
      .filter((i) => i.productId === productId && Number(i.warehouseId) === Number(warehouseId) && !i.frozen && daysTo(i.expiryDate) >= ban)
      .reduce((s, i) => s + avail(i), 0);
  }
  function fulfillLineStats(o, line) {
    const outs = outboundOf(o).filter((x) => (line.id && x.lineId === line.id) || x.productId === line.productId);
    const reserved = [1, 2, 3].map((wid) => outs.filter((x) => Number(x.warehouseId) === wid).reduce((s, x) => s + Number(x.qty || 0), 0));
    const w1 = outs.length ? reserved[0] : skuAvailAt(line.productId, 1);
    const w2 = outs.length ? reserved[1] : skuAvailAt(line.productId, 2);
    const w3 = outs.length ? reserved[2] : skuAvailAt(line.productId, 3);
    const rp = replenishmentOfLine(o, line);
    const cover = outs.length ? reserved[0] + reserved[1] + reserved[2] : (w1 + w2 + w3);
    const short = rp ? Number(rp.shortageQty || 0) : Math.max(0, Number(line.qty || 0) - cover);
    const closed = ["已发货", "已完成", "已取消", "已驳回"].includes(o.status);
    const pending = rp ? Number(rp.shortageQty || 0) : (!closed && short > 0 ? short : 0);
    return { w1, w2, w3, short, pending, rp };
  }
  function fulfillGapHtml(st) {
    const n = st.pending || st.short;
    if (!n) return "—";
    const po = st.rp ? poOfReplenishment(st.rp) : null;
    if (po) return `<button class="linkish" data-act="po" data-id="${po.id}" style="color:var(--danger)">${n}</button>`;
    return `<span style="color:var(--danger)">${n}</span>`;
  }
  function sellableOnHand(productId) {
    const ban = cfg().banDays || 0;
    return (D.inventory || [])
      .filter((i) => i.productId === productId && !i.frozen && daysTo(i.expiryDate) >= ban)
      .reduce((s, i) => s + Number(i.qty || 0), 0);
  }
  function shippedQtyOf(orderId, productId) {
    return (D.outbound || [])
      .filter((x) => x.orderId === orderId && x.productId === productId && x.status === "已发货")
      .reduce((s, x) => s + Number(x.qty || 0), 0);
  }
  function salesDemandOf(productId) {
    let n = 0;
    (D.salesOrders || []).forEach((o) => {
      if (!OPEN_SO.has(o.status)) return;
      orderLines(o).forEach((l) => {
        if (l.productId !== productId) return;
        n += Math.max(0, Number(l.qty || 0) - shippedQtyOf(o.id, productId));
      });
    });
    return n;
  }
  function inboundOpenOf(productId, warehouseId) {
    let n = 0;
    (D.purchaseOrders || []).forEach((p) => {
      if (!OPEN_PO.has(p.status)) return;
      if (warehouseId != null && p.warehouseId != null && Number(p.warehouseId) !== Number(warehouseId)) return;
      poLines(p).forEach((l) => {
        if (l.productId !== productId) return;
        n += Math.max(0, Number(l.qty || 0) - Number(l.receivedQty || 0));
      });
    });
    return n;
  }
  function safetyFromOnHand(qty) {
    return Math.round(Number(qty || 0) * 0.2);
  }
  function purchaseNeedOf(productId) {
    const p = product(productId);
    const sales = salesDemandOf(productId);
    const safety = Number(p?.safety || 0);
    const available = sellableOnHand(productId);
    const inbound = inboundOpenOf(productId);
    const qty = Math.max(0, sales + safety - available - inbound);
    return { productId, sales, safety, available, inbound, qty };
  }
  function purchaseNeedList() {
    return D.products.filter((p) => p.status === 1).map((p) => ({
      product: p,
      ...purchaseNeedOf(p.id),
    }));
  }
  function generateDemandPOs(productIds) {
    const pos = [];
    (productIds || []).forEach((pid) => {
      const need = purchaseNeedOf(pid);
      if (need.qty <= 0) return;
      pos.push(createShortagePO(pid, need.qty, "采购需求"));
    });
    return pos;
  }
  function shortagePOsOf(orderNo) {
    const so = (D.salesOrders || []).find((o) => o.orderNo === orderNo);
    const rpPoIds = replenishmentsOfOrder(so).map((r) => r.poId).filter(Boolean);
    return (D.purchaseOrders || []).filter((p) => (p.sourceOrder === orderNo && p.source === "缺货自动补货") || rpPoIds.includes(p.id));
  }
  function orderCover(o) {
    return orderLines(o).map((l) => {
      const available = skuAvail(l.productId);
      return { line: l, available, short: Math.max(0, Number(l.qty) - available) };
    });
  }
  function orderHasShortage(o) {
    if (!o || ["已取消", "已驳回", "已完成", "已发货"].includes(o.status)) return false;
    if (o.shortage || shortagePOsOf(o.orderNo).length) return true;
    if (o.status === "待审核" || o.status === "审核通过") return orderCover(o).some((x) => x.short > 0);
    return false;
  }
  function fifoLots(productId, warehouseId) {
    const ban = cfg().banDays || 0;
    return D.inventory
      .filter((i) => i.productId === productId && avail(i) > 0 && daysTo(i.expiryDate) >= ban)
      .filter((i) => warehouseId == null || i.warehouseId === Number(warehouseId))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id - b.id);
  }

  function allocate(productId, qty, warehouseId) {
    const lots = fifoLots(productId, warehouseId);
    const picks = [];
    let need = qty;
    for (const lot of lots) {
      const take = Math.min(avail(lot), need);
      if (take <= 0) continue;
      picks.push({ lot, take, near: daysTo(lot.expiryDate) <= (cfg().nearDays || 30) });
      need -= take;
      if (need <= 0) break;
    }
    return { picks, short: need };
  }

  function lockPicks(picks, refNo) {
    picks.forEach(({ lot, take }) => {
      lot.lockQty += take;
      addTx({
        productId: lot.productId, warehouseId: lot.warehouseId, batchNo: lot.batchNo,
        type: "锁定", qty: take, before: lot.qty, after: lot.qty,
        refType: "销售订单", refNo, remark: "订单预占（近效期优先，过期批次已排除）",
      });
    });
  }

  function createReplenishment(orderRow, line, short, available) {
    const rp = {
      id: nextId(D.replenishments),
      no: seqNo("RP-202608-", D.replenishments, "no"),
      orderId: orderRow.id,
      lineId: line.id,
      lineNo: lineNoOf(orderRow, line),
      productId: line.productId,
      demandQty: Number(line.qty || 0),
      availableQty: available,
      shortageQty: short,
      poId: 0,
      poLineId: 0,
      status: "待采购",
      createdAt: nowStr(),
    };
    D.replenishments.unshift(rp);
    return rp;
  }
  function createShortagePO(productId, qty, orderNo, rp) {
    const p = product(productId);
    const po = {
      id: nextId(D.purchaseOrders),
      poNo: seqNo("PO-202608-", D.purchaseOrders, "poNo"),
      supplierId: 1,
      productId,
      qty,
      unitPrice: p.cost,
      orderDate: TODAY,
      expectedDate: "2026-09-08",
      actualDate: null,
      status: "待审核",
      source: orderNo === "采购需求" || orderNo === "安全库存预警" ? orderNo : "缺货自动补货",
      sourceOrder: orderNo === "采购需求" || orderNo === "安全库存预警" ? "" : orderNo,
      warehouseId: 1,
      receivedQty: 0,
      lines: [{ id: 1, productId, qty, unitPrice: p.cost, receivedQty: 0, replenishmentId: rp ? rp.id : 0 }],
    };
    D.purchaseOrders.unshift(po);
    if (rp) {
      rp.poId = po.id;
      rp.poLineId = po.lines[0].id;
      rp.status = "已转采购";
    }
    audit("缺货转采购", po.poNo, `${p.name} × ${qty}，来源 ${rp ? rp.lineNo + " / " + rp.no : orderNo}`);
    return po;
  }

  function createOutbound(orderRow, warehouseId, productId, qty, batchNo, lineId) {
    const ob = {
      id: nextId(D.outbound),
      outboundNo: seqNo("OUT-202608-", D.outbound, "outboundNo"),
      orderId: orderRow.id,
      lineId: lineId || 0,
      warehouseId,
      productId,
      batchNo: batchNo || "",
      qty,
      date: TODAY,
      status: "待出库",
      logistics: "",
      tracking: "",
    };
    D.outbound.unshift(ob);
    return ob;
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function ensureAR(orderRow, outboundRow) {
    let ar = D.receivables.find((r) => r.orderId === orderRow.id);
    if (ar) return ar;
    const due = addDays(TODAY, customer(orderRow.customerId)?.creditDays || 15);
    ar = {
      id: nextId(D.receivables),
      no: seqNo("AR-202608-", D.receivables, "no"),
      orderId: orderRow.id,
      outboundId: outboundRow ? outboundRow.id : 0,
      customerId: orderRow.customerId,
      amount: orderRow.receivable || orderRow.amount,
      status: "待收款",
      dueDate: due,
    };
    D.receivables.unshift(ar);
    audit("形成应收", ar.no, `出库后生成，关联 ${orderRow.orderNo}，到期 ${due}`);
    ensureVoucher("确认销售收入 " + orderRow.orderNo, "应收账款", "主营业务收入", ar.amount, ar.no);
    return ar;
  }

  function ensureAP(po) {
    if (D.payables.find((p) => p.poId === po.id)) return;
    const ap = {
      id: nextId(D.payables),
      no: seqNo("AP-202608-", D.payables, "no"),
      poId: po.id,
      supplierId: po.supplierId,
      amount: poAmount(po),
      status: "待核对发票",
      dueDate: addDays(TODAY, 15),
      invoiceNo: "",
      paidDate: null,
    };
    D.payables.unshift(ap);
    audit("形成应付", ap.no, `采购入库 ${po.poNo}`);
    ensureVoucher("采购入库 " + po.poNo, "库存商品", "应付账款", ap.amount, ap.no);
  }

  function approveOrder(id) {
    if (!hasRight("fulfill") && !hasRight("*")) { toast("当前部门无权审核订单"); return; }
    const o = order(id);
    if (!o || o.status !== "待审核") return;
    const lines = orderLines(o);
    const poNos = [];
    const grouped = new Map();
    let near = false;
    let lockedQty = 0;
    let anyShort = false;
    lines.forEach((line) => {
      const { picks, short } = allocate(line.productId, line.qty, null);
      if (short > 0) {
        anyShort = true;
        const covered = Number(line.qty || 0) - short;
        const rp = createReplenishment(o, line, short, covered);
        const need = purchaseNeedOf(line.productId);
        if (need.qty > 0) {
          const po = createShortagePO(line.productId, need.qty, o.orderNo, rp);
          poNos.push(po.poNo);
        }
      }
      if (picks.length) {
        lockPicks(picks, o.orderNo);
        picks.forEach((p) => {
          near = near || p.near;
          lockedQty += p.take;
          const key = line.productId + ":" + p.lot.warehouseId;
          const rec = grouped.get(key) || { productId: line.productId, lineId: line.id, warehouseId: p.lot.warehouseId, qty: 0, batch: p.lot.batchNo };
          rec.qty += p.take;
          rec.batch = p.lot.batchNo;
          grouped.set(key, rec);
        });
      }
    });
    grouped.forEach((rec) => createOutbound(o, rec.warehouseId, rec.productId, rec.qty, rec.batch, rec.lineId));
    const whs = [...new Set([...grouped.values()].map((r) => r.warehouseId))];
    o.warehouseId = whs[0] || null;
    o.shortage = anyShort;
    o.shortagePos = poNos.slice();
    const coverNote = anyShort && !poNos.length ? "，缺口由在途采购覆盖" : "";
    if (anyShort && !grouped.size) {
      o.status = "审核通过";
      audit("订单审核", o.orderNo, poNos.length ? `明细全部缺货，已按采购需求生成 ${poNos.join("、")}` : `明细缺货，在途采购已覆盖`);
      persist();
      toast(poNos.length ? `明细库存不足，已按采购需求生成 ${poNos.join("、")}` : "明细库存不足，在途采购已覆盖缺口");
      render();
      return;
    }
    o.status = anyShort ? "审核通过" : (whs.length > 1 ? "已分仓" : "出库中");
    audit("订单审核", o.orderNo, `${lines.length} 行明细，预占 ${lockedQty}` + (whs.length > 1 ? `，拆 ${whs.length} 仓` : "") + (poNos.length ? `，按需求转采购 ${poNos.join("、")}` : "") + coverNote + (near ? "，含临期批次" : ""));
    persist();
    toast(o.orderNo + ` 已审核（${lines.length} 行）` + (whs.length > 1 ? `，拆 ${whs.length} 仓` : "") + (poNos.length ? "，已按采购需求补货" : "") + coverNote + (near ? "，含临期" : ""));
    render();
  }

  function rejectOrder(id) {
    if (!hasRight("fulfill") && !hasRight("*")) { toast("当前部门无权审核订单"); return; }
    const o = order(id);
    if (!o || o.status !== "待审核") return;
    o.status = "已驳回";
    o.receivable = 0;
    o.shortage = false;
    audit("订单驳回", o.orderNo, "审核不通过，未预占库存、未生成出库与采购");
    persist();
    toast(o.orderNo + " 已驳回（审核不通过）");
    render();
  }

  function shipOutbound(id) {
    if (!hasRight("fulfill") && !hasRight("*")) { toast("当前部门无权出库"); return; }
    const ob = byId(D.outbound, id);
    if (!ob || ob.status === "已发货") return;
    let lot = D.inventory.find((i) => i.productId === ob.productId && i.warehouseId === ob.warehouseId && i.batchNo === ob.batchNo);
    if (!lot || avail(lot) + (lot.lockQty > 0 ? lot.lockQty : 0) < ob.qty) {
      const { picks, short } = allocate(ob.productId, ob.qty, ob.warehouseId);
      if (short > 0) { toast("可用库存不足，且过期批次已禁售"); return; }
      lot = picks[0].lot;
      ob.batchNo = lot.batchNo;
    }
    if (daysTo(lot.expiryDate) < cfg().banDays) { toast("该批次已过效期策略禁售线，禁止出库"); return; }
    if (lot.frozen) { toast("该批次已冻结，禁止出库"); return; }
    const take = ob.qty;
    const before = lot.qty;
    const fromLock = Math.min(lot.lockQty, take);
    lot.lockQty -= fromLock;
    lot.qty -= take;
    ob.status = "已发货";
    ob.logistics = ob.logistics || "顺丰";
    ob.tracking = ob.tracking || ("SF" + TODAY.replace(/-/g, "") + String(ob.id).padStart(3, "0"));
    addTx({
      productId: lot.productId, warehouseId: lot.warehouseId, batchNo: lot.batchNo,
      type: "出库", qty: -take, before, after: lot.qty,
      refType: "出库单", refNo: ob.outboundNo, remark: "FIFO 出库确认",
    });
    const so = order(ob.orderId);
    const related = D.outbound.filter((x) => x.orderId === so.id);
    const allShipped = related.every((x) => x.status === "已发货");
    so.status = allShipped ? "已发货" : "出库中";
    ensureAR(so, ob);
    gspPush("出库复核", ob.outboundNo, ob.productId, ob.batchNo, take, "FIFO 出库确认");
    audit("出库确认", ob.outboundNo, `${product(ob.productId).name} × ${take}，批次 ${ob.batchNo}`);
    persist();
    toast(ob.outboundNo + " 已出库，应收已生成");
    render();
  }

  function completeOrder(id) {
    const o = order(id);
    if (!o || o.status !== "已发货") return;
    o.status = "已完成";
    audit("订单签收", o.orderNo, "客户签收，订单完成");
    persist();
    toast(o.orderNo + " 已完成");
    render();
  }

  function inboundLot(productId, warehouseId, qty, poNo, qcOk) {
    const prod = product(productId);
    const batchNo = "B260830" + String(nextId(D.inventory)).padStart(2, "0");
    let row = D.inventory.find((i) => i.productId === productId && i.warehouseId === warehouseId && i.batchNo === batchNo);
    const exp = addDays(TODAY, prod.shelfLife);
    if (!row) {
      row = {
        id: nextId(D.inventory), productId, warehouseId, batchNo,
        productionDate: TODAY, expiryDate: exp, qty: 0, lockQty: 0, frozen: qcOk ? 0 : 1,
      };
      D.inventory.push(row);
    }
    const before = row.qty;
    if (qcOk) row.qty += qty;
    else { row.qty += qty; row.frozen = 1; }
    addTx({
      productId, warehouseId, batchNo, type: "入库", qty,
      before, after: row.qty, refType: "采购入库单", refNo: poNo,
      remark: qcOk ? "验收合格入库" : "质检不合格，批次冻结",
    });
    return row;
  }

  function receivePO(id, lineQtys, warehouseId, qcOk) {
    if (!hasRight("stock") && !hasRight("*")) { toast("无权入库"); return; }
    const p = byId(D.purchaseOrders, id);
    if (!p || p.status === "已入库") return;
    const wh = Number(warehouseId || p.warehouseId || 1);
    const lines = poLines(p);
    let took = 0;
    lines.forEach((line) => {
      const remain = line.qty - (line.receivedQty || 0);
      const take = Math.min(remain, Number(lineQtys[line.id] ?? lineQtys[String(line.id)] ?? 0));
      if (take <= 0) return;
      const lot = inboundLot(line.productId, wh, take, p.poNo, qcOk);
      line.receivedQty = (line.receivedQty || 0) + take;
      took += take;
      D.quality.unshift({
        id: nextId(D.quality), no: seqNo("QC-202608-", D.quality, "no"),
        poId: p.id, productId: line.productId, batchNo: lot.batchNo,
        qtyOk: qcOk ? take : 0, qtyNg: qcOk ? 0 : take,
        result: qcOk ? "合格" : "不合格", inspector: currentRole().name, date: TODAY,
        remark: qcOk ? "到货验收" : "验收不合格冻结",
      });
      gspPush("购进验收", p.poNo, line.productId, lot.batchNo, take, qcOk ? "合格入库" : "不合格冻结");
    });
    p.receivedQty = poRecv(p);
    p.productId = lines[0].productId;
    p.qty = poQty(p);
    if (p.receivedQty >= poQty(p)) {
      p.status = "已入库";
      p.actualDate = TODAY;
    } else if (p.receivedQty > 0) {
      p.status = "部分入库";
    }
    if (qcOk && took > 0) ensureAP(p);
    audit("采购收货", p.poNo, `本次数 ${took}，累计 ${p.receivedQty}/${poQty(p)}，${qcOk ? "合格" : "不合格冻结"}`);
    persist();
    toast(p.poNo + (p.status === "已入库" ? " 已全部入库" : " 部分收货 " + took));
    render();
  }

  function inboundPO(id) {
    const p = byId(D.purchaseOrders, id);
    if (!p) return;
    const qtys = {};
    poLines(p).forEach((l) => { qtys[l.id] = l.qty - (l.receivedQty || 0); });
    receivePO(id, qtys, p.warehouseId || 1, true);
  }

  function matchPayment(payId, silent) {
    if (!hasRight("finance") && !hasRight("*")) { if (!silent) toast("无权核销"); return false; }
    const pay = byId(D.payments, payId);
    if (!pay) return false;
    const open = D.receivables
      .filter((r) => r.customerId === pay.customerId && r.status !== "已回款")
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
    if (!open.length) { if (!silent) toast("未找到可匹配的应收单"); return false; }
    let left = pay.amount;
    let any = false;
    open.forEach((ar) => {
      if (left <= 0) return;
      const already = D.reconciliations.filter((x) => x.receivableId === ar.id && x.status === "匹配成功").reduce((s, x) => s + x.amount, 0);
      const remain = +(ar.amount - already).toFixed(2);
      if (remain <= 0) return;
      const take = Math.min(remain, left);
      const exactOne = take === remain || take === pay.amount;
      D.reconciliations.unshift({
        id: nextId(D.reconciliations),
        receivableId: ar.id,
        paymentId: pay.id,
        amount: take,
        date: TODAY,
        status: Math.abs(take - remain) < 0.01 || Math.abs(take - pay.amount) < 0.01 ? "匹配成功" : "异常待处理",
        remark: exactOne ? "客户+金额一致" : `核销 ${take}，剩余应收 ${remain}`,
      });
      if (take >= remain - 0.01) ar.status = "已回款";
      else ar.status = "部分回款";
      left = +(left - take).toFixed(2);
      any = true;
    });
    if (left > 0.01) {
      D.reconciliations.unshift({
        id: nextId(D.reconciliations),
        receivableId: open[0].id,
        paymentId: pay.id,
        amount: left,
        date: TODAY,
        status: "异常待处理",
        remark: `回款余额 ${left} 未分配`,
      });
      pay.status = "待核销";
      if (!silent) toast("部分匹配失败，已进入差异清单");
    } else {
      pay.status = "已核销";
      if (!silent) toast(any ? "自动核销完成（多单匹配）" : "无匹配");
    }
    audit("回款核销", pay.no, pay.status);
    if (!silent) {
      persist();
      setRoute("fin-ar", false);
    }
    return pay.status === "已核销";
  }

  function autoReconcile() {
    if (!hasRight("finance") && !hasRight("*")) { toast("无权核销"); return; }
    const pending = (D.payments || []).filter((p) => p.status === "待核销");
    if (!pending.length) { toast("没有待核销收款"); return; }
    let ok = 0;
    pending.forEach((p) => { if (matchPayment(p.id, true)) ok += 1; });
    persist();
    toast(ok ? `自动对账完成，核销 ${ok} 笔` : "自动对账未匹配到应收");
    setRoute("fin-ar", false);
  }

  function paginate(list, size = 10) {
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size));
    if (state.page > pages) state.page = 1;
    return { rows: list.slice((state.page - 1) * size, state.page * size), total, pages };
  }
  function pagerHtml(total, pages) {
    return `<div class="pager">共 ${total} 条 · 第 ${state.page}/${pages} 页
      <button class="btn ghost" data-act="page" data-dir="-1" ${state.page <= 1 ? "disabled" : ""}>上一页</button>
      <button class="btn ghost" data-act="page" data-dir="1" ${state.page >= pages ? "disabled" : ""}>下一页</button>
    </div>`;
  }

  function inventoryStatus(row) {
    const p = product(row.productId);
    const a = avail(row);
    if (row.frozen) return "冻结";
    if (daysTo(row.expiryDate) < (cfg().banDays || 0)) return "过期禁售";
    if (a <= 0) return "缺货";
    if (daysTo(row.expiryDate) <= (cfg().nearDays || 30)) return "临期";
    const total = D.inventory.filter((i) => i.productId === row.productId).reduce((s, i) => s + avail(i), 0);
    if (total < p.safety) return "低于安全库存";
    return "正常";
  }

  function metrics() {
    const activeOrders = scopedOrders().filter((o) => !["已取消", "已驳回"].includes(o.status));
    const salesAmt = activeOrders.reduce((s, o) => s + orderAmtOf(o), 0);
    const arAmt = D.receivables.reduce((s, r) => s + r.amount, 0);
    const paid = D.reconciliations.filter((r) => r.status === "匹配成功").reduce((s, r) => s + r.amount, 0);
    const arOpen = D.receivables.filter((r) => r.status !== "已回款").reduce((s, r) => s + (r.amount - D.reconciliations.filter((x) => x.receivableId === r.id && x.status === "匹配成功").reduce((a, x) => a + x.amount, 0)), 0);
    const converted = scopedLeads().filter((l) => l.status === "已转商机").length;
    const leadRate = scopedLeads().length ? converted / scopedLeads().length : 0;
    const invValue = D.inventory.reduce((s, i) => s + Math.max(avail(i), 0) * (product(i.productId)?.cost || 0), 0);
    const cogs = activeOrders.reduce((s, o) => s + orderLines(o).reduce((a, l) => a + l.qty * (product(l.productId)?.cost || 0), 0), 0);
    const cogsDay = (cogs || salesAmt * 0.42) / 30;
    const turnover = cogsDay ? invValue / cogsDay : 0;
    const skuTotal = D.products.filter((p) => p.status === 1).length;
    const stockMap = {};
    D.inventory.forEach((i) => { stockMap[i.productId] = (stockMap[i.productId] || 0) + avail(i); });
    const oos = D.products.filter((p) => p.status === 1 && (stockMap[p.id] || 0) <= 0).length;
    const near = D.inventory.filter((i) => daysTo(i.expiryDate) <= (cfg().nearDays || 30) && daysTo(i.expiryDate) >= (cfg().banDays || 0) && avail(i) > 0);
    const low = D.products.filter((p) => p.status === 1 && (stockMap[p.id] || 0) > 0 && (stockMap[p.id] || 0) < p.safety);
    const pendingPay = D.payments.filter((p) => p.status === "待核销");
    const pendingPo = D.purchaseOrders.filter((p) => OPEN_PO.has(p.status));
    const purchaseNeeds = purchaseNeedList();
    const purchaseNeedOpen = purchaseNeeds.filter((x) => x.qty > 0);
    const dueOpps = scopedOpps().filter((o) => ["需求确认", "方案报价", "商务谈判"].includes(o.stage) && o.expected <= "2026-09-05");
    const diff = D.reconciliations.filter((r) => r.status === "异常待处理");
    const shippedOnTime = activeOrders.filter((o) => ["已发货", "已完成"].includes(o.status)).length;
    const fulfillRate = activeOrders.length ? shippedOnTime / activeOrders.length : 0;
    const won = scopedOpps().filter((o) => o.stage === "成交").length;
    const winRate = scopedOpps().length ? won / scopedOpps().length : 0;
    const channelLeads = {};
    const acquireLeads = Object.fromEntries(LEAD_SOURCES.map((s) => [s, 0]));
    scopedLeads().forEach((l) => {
      channelLeads[l.channel] = (channelLeads[l.channel] || 0) + 1;
      const src = l.source || "展会";
      acquireLeads[src] = (acquireLeads[src] || 0) + 1;
    });
    const channelSales = { 电商: 0, 线下经销商: 0 };
    activeOrders.forEach((o) => { channelSales[o.channel] = (channelSales[o.channel] || 0) + o.amount; });
    const apOpen = (D.payables || []).filter((p) => p.status !== "已付款").reduce((s, p) => s + p.amount, 0);
    const gross = salesAmt - cogs;
    const grossRate = salesAmt ? gross / salesAmt : 0;
    return {
      salesAmt, arAmt, paid, arOpen, leadRate, converted, turnover, oos, skuTotal,
      near, low, pendingPay, pendingPo, purchaseNeeds, purchaseNeedOpen, dueOpps, diff, fulfillRate, winRate, stockMap, channelLeads, acquireLeads, channelSales, activeOrders,
      apOpen, grossRate, cogs, invValue,
    };
  }

  function dailySalesSeries() {
    const days = [];
    const base = new Date(TODAY + "T00:00:00");
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      days.push({ date: key, amount: 0 });
    }
    const map = Object.fromEntries(days.map((x) => [x.date, x]));
    D.salesOrders.forEach((o) => {
      if (o.status === "已取消" || o.status === "已驳回") return;
      const key = (o.createdAt || "").slice(5, 10);
      if (map[key]) map[key].amount += orderAmtOf(o);
    });
    return days;
  }

  function arRemainOf(ar) {
    const matched = D.reconciliations.filter((x) => x.receivableId === ar.id && x.status === "匹配成功").reduce((s, x) => s + x.amount, 0);
    return +(ar.amount - matched).toFixed(2);
  }
  function arOfOrder(o) {
    return (D.receivables || []).find((r) => r.orderId === o.id) || null;
  }
  function paymentsOfAr(ar) {
    if (!ar) return [];
    const ids = new Set((D.reconciliations || []).filter((x) => x.receivableId === ar.id).map((x) => x.paymentId));
    return (D.payments || []).filter((p) => ids.has(p.id) || (p.orderId && p.orderId === ar.orderId));
  }
  function pendingPaysOfCustomer(customerId) {
    return (D.payments || []).filter((p) => p.customerId === customerId && p.status === "待核销");
  }
  function salesCollectStatus(o) {
    const outs = outboundOf(o);
    const shipped = outs.filter((x) => x.status === "已发货");
    const ar = arOfOrder(o);
    if (!outs.length) return "未出库";
    if (!shipped.length) return "待出库";
    if (!ar) return "待收款";
    if (ar.status === "已回款") return "已收款";
    if (ar.status === "部分回款") return "部分收款";
    return "待收款";
  }
  function salesCollectRows() {
    return scopedOrders()
      .filter((o) => o.status !== "已取消" && o.status !== "已驳回")
      .map((o) => {
        const outs = outboundOf(o);
        const ar = arOfOrder(o);
        const pays = paymentsOfAr(ar);
        const pending = (ar && ar.status !== "已回款") ? pendingPaysOfCustomer(o.customerId) : [];
        return { o, outs, ar, pays, pending, collectStatus: salesCollectStatus(o) };
      });
  }
  function inboundNoOf(po) {
    if (!(poRecv(po) > 0 || po.status === "已入库" || po.status === "部分入库")) return "";
    return String(po.poNo || "").replace(/^PO-/, "IN-");
  }
  function apOfPo(po) {
    return (D.payables || []).find((p) => p.poId === po.id) || null;
  }
  function purchasePayStatus(po) {
    if (!inboundNoOf(po)) return "未入库";
    const ap = apOfPo(po);
    if (ap && ap.status === "已付款") return "已付款";
    return "待付款";
  }
  function purchasePayRows() {
    return (D.purchaseOrders || []).map((p) => ({ p, inboundNo: inboundNoOf(p), ap: apOfPo(p), payStatus: purchasePayStatus(p) }));
  }
  function invoiceOfOrder(o) {
    return (D.invoices || []).find((i) => i.orderId === o.id) || null;
  }
  function arPaidAmt(ar) {
    if (!ar) return 0;
    return +(ar.amount - arRemainOf(ar)).toFixed(2);
  }
  function arDueOf(o, ar, outs) {
    if (ar?.dueDate) return ar.dueDate;
    const days = Number(customer(o.customerId)?.creditDays || 0);
    if (!days) return "";
    const ship = (outs || outboundOf(o)).find((x) => x.status === "已发货");
    const base = ship?.date || String(o.createdAt || "").slice(0, 10);
    return base ? addDays(base, days) : "";
  }
  function arDisplayStatus(row) {
    if (row.collectStatus === "已收款") return "已收款";
    if (row.ar) {
      const due = arDueOf(row.o, row.ar, row.outs);
      if (due && due < TODAY && (row.collectStatus === "待收款" || row.collectStatus === "部分收款")) return "逾期";
      return row.collectStatus === "部分收款" ? "部分收款" : "未收款";
    }
    return "未形成应收";
  }
  function lineUnitPrice(o, ob) {
    const lines = orderLines(o);
    const hit = (ob.lineId && lines.find((l) => l.id === ob.lineId)) || lines.find((l) => l.productId === ob.productId);
    return Number(hit?.unitPrice || product(ob.productId)?.price || 0);
  }
  function outboundAmtOf(row, shippedOnly = true) {
    return +row.outs
      .filter((x) => !shippedOnly || x.status === "已发货")
      .reduce((s, x) => s + Number(x.qty || 0) * lineUnitPrice(row.o, x), 0)
      .toFixed(2);
  }
  function invAmtOf(row) {
    return Number(invoiceOfOrder(row.o)?.amount || 0);
  }
  function collectAmtOf(row) {
    return arPaidAmt(row.ar);
  }
  function salesFin(row) {
    const orderAmt = orderAmtOf(row.o);
    const shipAmt = outboundAmtOf(row, true);
    const invAmt = invAmtOf(row);
    const payAmt = collectAmtOf(row);
    const arAmt = Number(row.ar?.amount || 0);
    const openAmt = row.ar ? +Math.max(0, arAmt - payAmt).toFixed(2) : 0;
    return { orderAmt, shipAmt, invAmt, payAmt, openAmt, arAmt };
  }
  function salesDiffs(row) {
    const a = salesFin(row);
    const shipped = row.outs.some((x) => x.status === "已发货");
    const diffs = [];
    if (!shipped) return { status: row.outs.length ? "待出库" : "未出库", diffs, ...a };
    if (Math.abs(a.orderAmt - a.shipAmt) > 0.01) diffs.push("出库差异 " + money2(a.orderAmt - a.shipAmt));
    if (!a.invAmt) return { status: "待开票", diffs, ...a };
    if (Math.abs(a.shipAmt - a.invAmt) > 0.01) diffs.push("开票差异 " + money2(a.shipAmt - a.invAmt));
    if (a.payAmt + 0.01 < a.invAmt) diffs.push("未收款 " + money2(a.invAmt - a.payAmt));
    if (a.payAmt > a.invAmt + 0.01) diffs.push("超额收款 " + money2(a.payAmt - a.invAmt));
    let status = "匹配成功";
    if (diffs.some((d) => d.startsWith("未收款"))) status = arDisplayStatus(row) === "逾期" ? "逾期" : "待收款";
    else if (diffs.length) status = "金额差异";
    return { status, diffs, ...a };
  }
  function salesMatchStatus(row) {
    return salesDiffs(row).status;
  }
  function salesGap(row) {
    return salesMatchStatus(row) !== "匹配成功";
  }
  function inboundAmtOf(row) {
    return +poLines(row.p).reduce((s, l) => s + Number(l.receivedQty || 0) * Number(l.unitPrice || 0), 0).toFixed(2);
  }
  function purchaseFin(row) {
    const poAmt = poAmount(row.p);
    const inAmt = inboundAmtOf(row);
    const invAmt = row.ap?.invoiceNo ? Number(row.ap.amount || 0) : 0;
    const payAmt = row.ap?.status === "已付款" ? Number(row.ap.amount || 0) : 0;
    const apCount = (D.payables || []).filter((p) => p.poId === row.p.id).length;
    return { poAmt, inAmt, invAmt, payAmt, apCount };
  }
  function purchaseIssues(row) {
    const a = purchaseFin(row);
    const issues = [];
    if (a.payAmt > 0.01 && a.inAmt < 0.01) issues.push("已付款未入库");
    if (a.inAmt > 0.01 && a.invAmt < 0.01) issues.push("已入库未收票");
    if (a.invAmt > 0.01 && Math.abs(a.invAmt - a.poAmt) > 0.01 && Math.abs(a.invAmt - a.inAmt) > 0.01) issues.push("发票金额不符");
    if (a.apCount > 1) issues.push("重复付款");
    if (a.payAmt > Math.max(a.invAmt, a.inAmt, a.poAmt) + 0.01) issues.push("超额付款");
    if (a.inAmt > 0.01 && Math.abs(a.poAmt - a.inAmt) > 0.01) issues.push("采购差异");
    return issues;
  }
  function purchaseMatchStatus(row) {
    const issues = purchaseIssues(row).filter((x) => x !== "采购差异");
    if (issues[0]) return issues[0];
    if (!row.inboundNo) return "未入库";
    if (!row.ap?.invoiceNo) return "待开票";
    if (row.payStatus !== "已付款") return "待付款";
    return "匹配成功";
  }
  function purchaseGap(row) {
    return purchaseIssues(row).length > 0 || purchaseMatchStatus(row) !== "匹配成功";
  }
  function apPlanDate(row) {
    return row.ap?.dueDate || (row.p.actualDate ? addDays(row.p.actualDate, 15) : (row.p.expectedDate || ""));
  }
  function lotCost(i) {
    return Number(product(i.productId)?.cost || 0);
  }
  function lotValue(i) {
    return +(Math.max(0, Number(i.qty || 0)) * lotCost(i)).toFixed(2);
  }
  function monthPurchaseCost() {
    return (D.purchaseOrders || []).reduce((s, p) => {
      const d = p.actualDate || "";
      if (!d.startsWith("2026-08")) return s;
      return s + inboundAmtOf({ p });
    }, 0);
  }
  function stocktakePnL() {
    return (D.inventoryTx || []).filter((t) => t.type === "盘盈" || t.type === "盘亏").reduce((s, t) => s + Number(t.qty || 0) * (product(t.productId)?.cost || 0), 0);
  }
  function soldQtyOf(pid) {
    return scopedOrders().filter((o) => !["已取消", "已驳回"].includes(o.status)).reduce((s, o) => (
      s + orderLines(o).filter((l) => l.productId === pid).reduce((a, l) => a + Number(l.qty || 0), 0)
    ), 0);
  }
  function isSlowLot(i) {
    const sold = soldQtyOf(i.productId);
    return sold <= 0 || Number(i.qty || 0) > sold * 2;
  }
  function issueSalesInvoice(orderId) {
    const o = order(orderId);
    if (!o) return;
    if (invoiceOfOrder(o)) { toast("已开票"); return; }
    const shipped = outboundOf(o).filter((x) => x.status === "已发货");
    if (!shipped.length) { toast("未出库，不能开票"); return; }
    const amt = +shipped.reduce((s, x) => s + Number(x.qty || 0) * lineUnitPrice(o, x), 0).toFixed(2);
    D.invoices.unshift({
      id: nextId(D.invoices), no: seqNo("FP-202608-", D.invoices, "no"),
      orderId: o.id, customerId: o.customerId, amount: amt,
      tax: +(amt / 1.13 * 0.13).toFixed(2),
      type: customer(o.customerId)?.type === "电商" ? "电子普票" : "专票",
      status: "已开具", date: TODAY,
    });
    audit("开具发票", D.invoices[0].no, o.orderNo);
    persist();
    toast("已开票 " + D.invoices[0].no);
    render();
  }
  function financeTab() {
    const r = state.route;
    if (r === "fin-ap" || r === "fin-buy") return "ap";
    if (r === "fin-ar" || r === "fin-sales") return "ar";
    if (r === "fin-cost") return "cost";
    if (r === "fin-ana") return "ana";
    const t = state.filters.tab;
    if (t === "ap" || t === "buy" || t === "purchase") return "ap";
    if (t === "sales" || t === "match" || t === "rec" || t === "quad") return "ar";
    if (t === "cost" || t === "stock") return "cost";
    if (t === "ana" || t === "analysis") return "ana";
    return "ar";
  }

  function inboxBrief(roleId) {
    return {
      gm: "跨部门待处理事项，点击下钻到对应模块。",
      marketing: "维护线索：新建、修改、删除。销售写最新进展并转商机。",
      "sales-lead": "写线索最新进展，推进商机，成交后转订单。",
      sales: "写线索最新进展，推进商机，成交后转订单。",
      warehouse: "审核预占、出库履约，并按采购需求补货。",
      finance: "业务财务一体化对账：应收、应付、库存成本、经营分析。",
    }[roleId] || "点击下钻处理。";
  }

  function dueFollowLeadCount() {
    const scoped = new Set(scopedLeads().map((l) => l.id));
    const ids = new Set();
    (D.followups || []).forEach((f) => {
      if (!f.next || f.next > TODAY || !scoped.has(f.leadId)) return;
      const l = byId(D.leads, f.leadId);
      if (l && leadIsOpen(l)) ids.add(f.leadId);
    });
    return ids.size;
  }

  function inboxItems() {
    const role = state.role;
    const isGm = role === "gm";
    const isMkt = role === "marketing";
    const isSales = role === "sales-lead" || role === "sales";
    const isWh = role === "warehouse";
    const isFin = role === "finance";
    const m = metrics();
    const leads = scopedLeads();
    const orders = scopedOrders();
    const openLeadN = leads.filter((l) => leadIsOpen(l)).length;
    const converted = leads.filter((l) => l.status === "已转商机").length;
    const pendingSo = orders.filter((o) => o.status === "待审核").length;
    const rejected = orders.filter((o) => o.status === "已驳回").length;
    const shortage = orders.filter((o) => orderHasShortage(o)).length;
    const shipped = orders.filter((o) => o.status === "已发货").length;
    const pendingOb = (D.outbound || []).filter((o) => o.status === "待出库").length;
    const apInv = (D.payables || []).filter((p) => p.status === "待核对发票").length;
    const apPay = (D.payables || []).filter((p) => p.status === "待付款").length;
    const holdLots = (D.inventory || []).filter((i) => i.frozen || inventoryStatus(i) === "过期禁售").length;
    const creditOver = scopedCustomers().filter((c) => c.creditLimit && arOpenOf(c.id) > c.creditLimit).length;
    const dueFollow = dueFollowLeadCount();
    const items = [];
    const add = (ok, item) => { if (ok && item.count > 0) items.push(item); };

    add(isSales || isGm || isMkt, { title: "进行中线索", hint: "写最新进展，或转商机 / 标无效", count: openLeadN, level: "warn", route: "leads" });
    add(isMkt || isGm, { title: "本月已转商机", hint: "销售线索已转商机", count: converted, level: "info", route: "leads", status: "已转商机" });

    add(isGm, { title: "进展已到期", hint: "约定下次进展日已到", count: dueFollow, level: "warn", route: "leads" });
    add(isSales || isGm, { title: "商机即将到期", hint: "预计成交日临近，请推进或关单", count: m.dueOpps.length, level: "warn", route: "opps" });
    add(isSales, { title: "订单已驳回", hint: "按审核意见改完后重新下单", count: rejected, level: "danger", route: "orders", status: "已驳回" });
    add(isSales, { title: "订单待供应链审核", hint: "已提交需求，等待预占出库", count: pendingSo, level: "info", route: "orders", status: "待审核" });
    add(isSales, { title: "订单缺货待补货", hint: "仓库审核后已转采购，成交未中断", count: shortage, level: "warn", route: "orders", status: "缺货" });
    add(isSales, { title: "客户信用超额", hint: "未清应收超过信用额度", count: creditOver, level: "danger", route: "orders" });

    add(isWh || isGm, { title: "销售订单待审核", hint: "通过后预占库存并生成出库单", count: pendingSo, level: "warn", route: "fulfillment", status: "待审核" });
    add(isWh || isGm, { title: "订单待出库", hint: "打开订单确认出库后扣库存并生成应收", count: pendingOb, level: "warn", route: "fulfillment", status: "待出库" });
    add(isWh || isGm, { title: "已发货待签收", hint: "客户签收后订单完成", count: shipped, level: "info", route: "fulfillment", status: "已发货" });
    add(isWh || isGm, { title: "订单缺货待补货", hint: "有货先出，缺口按采购需求补", count: shortage, level: "danger", route: "fulfillment" });
    add(isWh || isGm, { title: "采购单待审核", hint: "在采购订单中审核", count: D.purchaseOrders.filter((p) => p.status === "待审核").length, level: "warn", route: "pos", status: "待审核" });
    add(isWh || isGm, { title: "采购在途待收货", hint: "在采购订单中收货", count: D.purchaseOrders.filter((p) => OPEN_PO.has(p.status) && p.status !== "待审核").length, level: "info", route: "pos", status: "在途" });
    add(isWh || isGm, { title: "临期批次", hint: "近效期优先出库", count: m.near.length, level: "warn", route: "inventory", status: "临期" });
    add(isWh, { title: "低于安全库存", hint: "可售在库已低于安全水位", count: m.low.length, level: "warn", route: "inventory", status: "低于安全库存" });
    add(isWh, { title: "冻结 / 过期批次", hint: "禁售，不参与预占与出库", count: holdLots, level: "danger", route: "inventory" });

    add(isFin || isGm, { title: "收款待核销", hint: "收款尚未核到销售订单", count: m.pendingPay.length, level: "warn", route: "fin-ar" });
    add(isFin || isGm, { title: "对账差异待处理", hint: "核销状态为异常待处理", count: m.diff.length, level: "danger", route: "fin-ar" });
    add(isFin, { title: "应付未付款", hint: "采购入库后待付款", count: apPay + apInv, level: "warn", route: "fin-ap", status: "未付款" });
    add(isFin, { title: "逾期应收", hint: "到期未收齐", count: salesCollectRows().filter((r) => arDisplayStatus(r) === "逾期").length, level: "danger", route: "fin-ar", status: "逾期" });
    add(isFin, { title: "出库待开票", hint: "销售链缺发票", count: salesCollectRows().filter((r) => salesMatchStatus(r) === "待开票").length, level: "info", route: "fin-ar", status: "异常" });

    add(isGm, { title: "订单已驳回", hint: "销售需改单后重下", count: rejected, level: "danger", route: "orders", status: "已驳回" });

    const rank = { danger: 0, warn: 1, info: 2 };
    items.sort((a, b) => (rank[a.level] ?? 1) - (rank[b.level] ?? 1));
    return items;
  }

  function inboxListHtml(items) {
    if (!items.length) return `<p class="tiny inbox-empty">当前没有需要处理的事项</p>`;
    return `<ul class="todo-list">${items.map((it) => `<li class="click-row" data-act="go" data-route="${it.route}"${it.status ? ` data-status="${esc(it.status)}"` : ""}${it.tab ? ` data-tab="${esc(it.tab)}"` : ""}>
      <span><b>${esc(it.title)}</b>${it.hint ? `<em>${esc(it.hint)}</em>` : ""}</span>
      <b class="todo-n ${it.level === "danger" ? "danger" : it.level === "info" ? "info" : "warn"}">${it.count}</b>
    </li>`).join("")}</ul>`;
  }

  function inboxPanelHtml() {
    const role = currentRole();
    const items = inboxItems();
    return `<div class="bell-head"><h4>待办 · ${esc(role.name)}</h4><span class="tiny">${items.length ? items.length + " 项" : "暂无"}</span></div>
      <p class="tiny">${esc(inboxBrief(role.id))}</p>
      ${inboxListHtml(items)}`;
  }

  function refreshInboxUi() {
    const panel = $("#bellPanel");
    if (panel && !panel.hidden) panel.innerHTML = inboxPanelHtml();
  }

  function lineChart(values, labels) {
    const w = 560, h = 180, pad = 28;
    const max = Math.max(...values) * 1.12 || 1;
    const step = (w - pad * 2) / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    const area = d + ` L${pts.at(-1)[0]},${h - pad} L${pts[0][0]},${h - pad} Z`;
    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#426bba"/><text x="${p[0]}" y="${h - 8}" text-anchor="middle" font-size="11" fill="#586166">${labels[i]}</text>`).join("");
    return `<svg class="chart-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${area}" fill="rgba(66,107,186,.12)"/><path d="${d}" fill="none" stroke="#426bba" stroke-width="2.5"/>${dots}</svg>`;
  }
  function pieChart(items) {
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    const cx = 90, cy = 90, r = 68;
    let a0 = -Math.PI / 2;
    const colors = ["#426bba", "#4aa3c7", "#2a8a64", "#b07a12", "#6b8fd0"];
    const paths = items.map((it, idx) => {
      const ang = (it.value / total) * Math.PI * 2;
      const a1 = a0 + ang;
      const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0);
      const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
      const large = ang > Math.PI ? 1 : 0;
      const path = `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[idx % colors.length]}"/>`;
      a0 = a1;
      return path;
    }).join("");
    const legend = items.map((it, idx) => `<span><i style="background:${colors[idx % colors.length]}"></i>${esc(it.label)} ${pct(it.value / total)}</span>`).join("");
    return `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><svg class="chart-pie" viewBox="0 0 180 180" width="180" height="180">${paths}<circle cx="90" cy="90" r="38" fill="#ffffff"/></svg><div class="legend">${legend}</div></div>`;
  }
  function chartMax(values) {
    return Math.max(1, ...values.map((v) => Number(v) || 0));
  }
  function barChart(items, fmt) {
    const rows = (items || []).filter((it) => it && it.label != null);
    if (!rows.length) return `<p class="tiny">暂无数据</p>`;
    const w = 560, h = 200, padT = 22, padB = 28, padX = 24;
    const max = chartMax(rows.map((it) => it.value));
    const slot = (w - padX * 2) / rows.length;
    const gap = Math.min(10, slot * 0.28);
    const thin = rows.length > 10;
    const step = thin ? Math.ceil(rows.length / 7) : 1;
    const bars = rows.map((it, i) => {
      const bh = (Number(it.value) / max) * (h - padT - padB);
      const x = padX + i * slot + gap / 2;
      const y = h - padB - bh;
      const show = !thin || i % step === 0 || i === rows.length - 1;
      const lab = show ? `<text x="${x + (slot - gap) / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#586166">${esc(it.label)}</text>` : "";
      const val = Number(it.value) ? `<text x="${x + (slot - gap) / 2}" y="${Math.max(12, y - 4)}" text-anchor="middle" font-size="10" fill="#4a5160">${esc(fmt ? fmt(it.value) : it.value)}</text>` : "";
      return `<rect x="${x}" y="${y}" width="${Math.max(4, slot - gap)}" height="${Math.max(0, bh)}" rx="3" fill="${it.color || "#426bba"}"/>${val}${lab}`;
    }).join("");
    return `<svg class="chart-bar" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
  }
  function comboBarLine(labels, bars, lineVals) {
    const n = labels.length;
    if (!n) return `<p class="tiny">暂无数据</p>`;
    const w = 560, h = 200, padT = 18, padB = 28, padX = 28;
    const maxB = chartMax(bars);
    const maxL = chartMax(lineVals);
    const slot = (w - padX * 2) / n;
    const thin = n > 10;
    const step = thin ? Math.ceil(n / 7) : 1;
    const rects = bars.map((v, i) => {
      const bh = (Number(v) / maxB) * (h - padT - padB);
      const x = padX + i * slot + slot * 0.18;
      return `<rect x="${x}" y="${h - padB - bh}" width="${slot * 0.64}" height="${Math.max(0, bh)}" rx="3" fill="rgba(66,107,186,.55)"/>`;
    }).join("");
    const pts = lineVals.map((v, i) => [padX + i * slot + slot * 0.5, h - padB - (Number(v) / maxL) * (h - padT - padB)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    const dots = pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="#2a8a64"/>`).join("");
    const labs = labels.map((lb, i) => (thin && i % step && i !== n - 1) ? "" : `<text x="${padX + i * slot + slot * 0.5}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#586166">${esc(lb)}</text>`).join("");
    return `<svg class="chart-bar" viewBox="0 0 ${w} ${h}">${rects}<path d="${d}" fill="none" stroke="#2a8a64" stroke-width="2"/>${dots}${labs}</svg>`;
  }
  function hBarChart(items, fmt) {
    const rows = (items || []).slice(0, 8);
    if (!rows.length) return `<p class="tiny">暂无数据</p>`;
    const max = chartMax(rows.map((it) => it.value));
    return `<div class="funnel">${rows.map((it) => `<div class="funnel-row"><span>${esc(it.label)}</span><div class="funnel-bar" style="width:${Math.max(12, (Number(it.value) / max) * 100)}%">${esc(fmt ? fmt(it.value) : it.value)}</div></div>`).join("")}</div>`;
  }
  function reportDayRange() {
    const start = new Date("2026-08-12T00:00:00");
    const end = new Date(TODAY + "T00:00:00");
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      days.push({ iso: `${d.getFullYear()}-${m}-${day}`, label: `${Number(m)}/${Number(day)}` });
    }
    return days;
  }
  function countByDay(list, dateOf) {
    const days = reportDayRange();
    const map = Object.fromEntries(days.map((d) => [d.iso, 0]));
    (list || []).forEach((row) => {
      const iso = String(dateOf(row) || "").slice(0, 10);
      if (map[iso] != null) map[iso] += 1;
    });
    return days.map((d) => ({ label: d.label, value: map[d.iso] }));
  }
  function sumByDay(list, dateOf, amountOf) {
    const days = reportDayRange();
    const map = Object.fromEntries(days.map((d) => [d.iso, 0]));
    (list || []).forEach((row) => {
      const iso = String(dateOf(row) || "").slice(0, 10);
      if (map[iso] != null) map[iso] += Number(amountOf(row) || 0);
    });
    return days.map((d) => ({ label: d.label, iso: d.iso, value: map[d.iso] }));
  }
  function skuSalesRank(limit) {
    const map = {};
    scopedOrders().filter((o) => !["已取消", "已驳回"].includes(o.status)).forEach((o) => {
      orderLines(o).forEach((l) => {
        const p = product(l.productId);
        if (!p) return;
        const rec = map[p.id] || { sku: p.sku, name: p.name, qty: 0, amt: 0 };
        rec.qty += Number(l.qty || 0);
        rec.amt += Number(l.amount || l.qty * l.unitPrice || 0);
        map[p.id] = rec;
      });
    });
    return Object.values(map).sort((a, b) => b.amt - a.amt).slice(0, limit || 6);
  }
  function rptKpis(items) {
    return `<div class="kpis">${items.map((it) => `<article class="kpi${it.route ? " kpi-link" : ""}"${it.route ? ` data-act="go" data-route="${it.route}"${it.status ? ` data-status="${esc(it.status)}"` : ""}` : ""}>
      <div class="label">${esc(it.label)}</div>
      <div class="value">${it.value}</div>
      ${it.delta ? `<div class="delta${it.tone ? " " + it.tone : ""}">${esc(it.delta)}</div>` : ""}
    </article>`).join("")}</div>`;
  }
  function rptCard(title, sub, body) {
    return `<div class="card rpt-card"><h3>${esc(title)}${sub ? `<span>${esc(sub)}</span>` : ""}</h3>${body}</div>`;
  }

  function productOptions(selected) {
    return D.products.filter((p) => p.status === 1).map((p) => `<option value="${p.id}" ${Number(selected) === p.id ? "selected" : ""}>${esc(p.sku)} ${esc(p.name)}</option>`).join("");
  }
  function productCategories() {
    const seen = [];
    D.products.forEach((p) => {
      if (p.category && !seen.includes(p.category)) seen.push(p.category);
    });
    return seen;
  }
  function productsByCategory(cat) {
    return D.products.filter((p) => p.status === 1 && p.category === cat);
  }
  function leadInterestOpts(cat, selectedId) {
    const rows = productsByCategory(cat);
    if (!rows.length) return `<option value="">该分类暂无在售商品</option>`;
    return rows.map((p) => `<option value="${p.id}" ${Number(selectedId) === p.id ? "selected" : ""}>${esc(p.sku)} ${esc(p.name)}</option>`).join("");
  }
  function applyLeadProduct(l, pid) {
    const p = product(pid);
    l.productId = p ? p.id : null;
    l.interest = p ? p.name : "";
    if (p) l.segment = p.category;
  }
  function customerOptions(selected) {
    return scopedCustomers().map((c) => `<option value="${c.id}" ${Number(selected) === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  }

  function tablePage(toolbar, thead, rowsHtml, list, emptyText) {
    const { rows, total, pages } = paginate(list);
    const body = rows.length ? rowsHtml(rows) : `<tr><td class="empty" colspan="12">${emptyText || "没有匹配的记录"}</td></tr>`;
    return `${toolbar}<div class="card" style="padding:0"><div class="table-wrap"><table class="data"><thead>${thead}</thead><tbody>${body}</tbody></table></div><div style="padding:0 16px 12px">${pagerHtml(total, pages)}</div></div>`;
  }

  function exportBtn(kind) {
    return hasRight("export") ? `<button class="btn ghost" data-act="export" data-kind="${kind}">导出 CSV</button>` : "";
  }

  /* ---------- views ---------- */
  function viewDashboard() {
    const m = metrics();
    const funnel = [
      { name: "线索", n: scopedLeads().length },
      { name: "商机", n: scopedOpps().length },
      { name: "报价", n: scopedOpps().filter((o) => ["方案报价", "商务谈判", "成交"].includes(o.stage)).length },
      { name: "谈判", n: scopedOpps().filter((o) => ["商务谈判", "成交"].includes(o.stage)).length },
      { name: "成交", n: scopedOpps().filter((o) => o.stage === "成交").length },
    ];
    const maxF = funnel[0].n || 1;
    const alerts = [
      ...D.inventory.filter((i) => inventoryStatus(i) === "缺货" || inventoryStatus(i) === "过期禁售").slice(0, 2).map((i) => ({ sku: product(i.productId).sku, name: product(i.productId).name, st: inventoryStatus(i) })),
      ...m.near.slice(0, 2).map((i) => ({ sku: product(i.productId).sku, name: product(i.productId).name, st: "临期" })),
      ...m.low.slice(0, 2).map((p) => ({ sku: p.sku, name: p.name, st: "低于安全库存" })),
    ].slice(0, 5);
    const pieItems = Object.entries(m.channelSales).map(([label, value]) => ({ label, value }));
    const acquirePie = Object.entries(m.acquireLeads).map(([label, value]) => ({ label, value }));

    return `<section class="hero">
        <div>
          <h1>Pharmavite OS 经营驾驶舱</h1>
          <p>订单输入形成需求，仓库按库存履约供给；供给不足由采购补充。市场获客交销售跟进，成交后走电商或线下经销商。</p>
        </div>
        <div class="hero-stats">
          <div>在营 SKU<b>${m.skuTotal} / ${D.company.skuCount}</b></div>
          <div>仓库<b>华东 · 华南 · 华北</b></div>
          <div>本月有效订单<b>${m.activeOrders.length}</b></div>
          <div>待收款<b>${money(m.arOpen)}</b></div>
        </div>
      </section>
      <div class="kpis chain">
        <article class="kpi kpi-link" data-act="go" data-route="orders"><div class="label">需求 · 订单输入</div><div class="value">${scopedOrders().filter((o) => !["已取消", "已驳回", "已完成"].includes(o.status)).length}</div><div class="delta">待履约销售订单</div></article>
        <article class="kpi kpi-link" data-act="go" data-route="fulfillment"><div class="label">供给 · 仓库履约</div><div class="value">${D.outbound.filter((o) => o.status !== "已发货").length}</div><div class="delta">待出库 / 履约中</div></article>
        <article class="kpi kpi-link" data-act="go" data-route="fulfillment"><div class="label">补充 · 采购履约</div><div class="value">${m.purchaseNeedOpen.length}</div><div class="delta">销售需求 + 安全库存 − 可用 − 未到货</div></article>
      </div>
      <div class="kpis">
        <article class="kpi kpi-link" data-act="go" data-route="orders"><div class="label">本月销售额</div><div class="value">${money(m.salesAmt)}</div><div class="delta up">点击下钻订单</div></article>
        <article class="kpi kpi-link" data-act="go" data-route="fin-ar"><div class="label">本月回款率</div><div class="value">${pct(m.paid / (m.arAmt || 1))}</div><div class="delta up">应收管理</div></article>
        <article class="kpi kpi-link" data-act="go" data-route="inventory"><div class="label">库存周转</div><div class="value">${Math.round(m.turnover)} 天</div><div class="delta down">按进销存成本测算</div></article>
        <article class="kpi kpi-link" data-act="go" data-route="leads"><div class="label">进行中线索</div><div class="value">${scopedLeads().filter((l) => leadIsOpen(l)).length}</div></article>
      </div>
      <div class="grid-2">
        <div class="card"><h3>销售趋势（近 7 日）</h3>${(() => { const series = dailySalesSeries(); return lineChart(series.map((d) => d.amount), series.map((d) => d.date)); })()}</div>
        <div class="card"><h3>销售渠道贡献</h3>${pieItems.some((i) => i.value) ? pieChart(pieItems) : ""}</div>
      </div>
      <div class="grid-2 eq">
        <div class="card"><h3>市场获客结构</h3>
          <p class="tiny">按线索来源看获客结构：展会 / 广告 / 官网 / 推荐 / 电商。</p>
          ${acquirePie.some((i) => i.value) ? pieChart(acquirePie) : "<p class='tiny'>暂无线索</p>"}
        </div>
        <div class="card"><h3>销售漏斗</h3><div class="funnel">${funnel.map((f) => `<div class="funnel-row"><span>${f.name}</span><div class="funnel-bar" style="width:${Math.max(28, (f.n / maxF) * 100)}%">${f.n}</div><span>${pct(f.n / maxF)}</span></div>`).join("")}</div></div>
      </div>
      <div class="grid-2 eq">
        <div class="card"><h3>库存预警 TOP5</h3><ul class="alert-list">${alerts.map((a) => `<li class="click-row" data-act="go" data-route="inventory"><span><b>${esc(a.sku)}</b> ${esc(a.name)}</span>${badge(a.st)}</li>`).join("")}</ul></div>
        <div class="card"><h3>财务协同</h3><ul class="fin-list">
          <li class="click-row" data-act="go" data-route="fin-ar" data-status="未收款"><span>未收款</span><b class="num">${money(m.arOpen)}</b></li>
          <li class="click-row" data-act="go" data-route="fin-ap" data-status="未付款"><span>未付款</span><b class="num">${money(m.apOpen)}</b></li>
          <li class="click-row" data-act="go" data-route="fin-ar" data-status="异常"><span>应收对账未齐</span><b class="num">${salesCollectRows().filter((r) => salesMatchStatus(r) !== "匹配成功").length}</b></li>
          <li class="click-row" data-act="go" data-route="fin-cost"><span>库存金额</span><b class="num">${money(m.invValue != null ? m.invValue : 0)}</b></li>
        </ul></div>
      </div>`;
  }

  function viewLeads() {
    const f = state.filters;
    const canWrite = canWriteLead();
    const all = scopedLeads();
    let list = all;
    if (f.status) list = list.filter((x) => x.status === f.status);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((x) => {
        const p = leadProduct(x);
        const so = leadOrders(x)[0];
        return [leadNoOf(x), x.name, p?.sku, p?.name, so ? lineSkuText(so) : ""].join(" ").toLowerCase().includes(q);
      });
    }
    const toolbar = `<div class="toolbar">
      <div class="tabs">
        ${["", ...LEAD_STATUSES].map((s) => `<button data-act="filter" data-k="status" data-v="${s}" class="${(f.status || "") === s ? "active" : ""}">${s || "全部"}</button>`).join("")}
      </div>
      <div class="filters">
        <input data-act="q" placeholder="Lead ID / 联系人 / SKU" value="${esc(f.q || "")}" />
        ${canWrite ? `<button class="btn" data-act="form" data-form="lead">新建</button>` : ""}
        ${exportBtn("leads")}
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>Lead ID</th><th>联系人</th><th>SKU</th><th>状态</th><th>关联商机</th><th>关联订单</th>${canWrite ? "<th></th>" : ""}</tr>`,
      (rows) => rows.map((l) => `<tr class="click-row" data-act="lead" data-id="${l.id}">
        <td class="num">${esc(leadNoOf(l))}</td>
        <td><b>${esc(l.name || "—")}</b></td>
        <td class="num">${leadSkuHtml(l)}</td>
        <td>${leadStatusHtml(l)}</td>
        <td>${leadOppLink(l)}</td>
        <td>${leadOrderLink(l)}</td>
        ${canWrite ? `<td><button type="button" class="linkish" data-act="lead-edit" data-id="${l.id}">edit</button>${canDeleteLead(l) ? ` <button type="button" class="linkish" data-act="lead-del" data-id="${l.id}" title="delete" aria-label="delete">delete</button>` : ""}</td>` : ""}
      </tr>`).join(""), list, all.length ? "没有匹配的记录" : "还没有线索，点「新建」录入");
  }

  function viewOpps() {
    const f = state.filters;
    const all = scopedOpps();
    let list = all;
    if (f.status) list = list.filter((x) => x.stage === f.status);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((x) => {
        const lead = D.leads.find((l) => l.id === x.leadId);
        const so = oppOrders(x)[0];
        return [oppNoOf(x), leadNoOf(lead), so?.orderNo, x.amount].join(" ").toLowerCase().includes(q);
      });
    }
    const stages = ["需求确认", "方案报价", "商务谈判", "成交", "丢单"];
    const toolbar = `<div class="toolbar">
      <div class="tabs">
        <button data-act="filter" data-k="status" data-v="" class="${!f.status ? "active" : ""}">全部</button>
        ${stages.map((s) => `<button data-act="filter" data-k="status" data-v="${s}" class="${f.status === s ? "active" : ""}">${s}</button>`).join("")}
      </div>
      <div class="filters"><input data-act="q" placeholder="OPP ID / 线索 / 订单" value="${esc(f.q || "")}" />${exportBtn("opps")}</div>
    </div>`;
    return tablePage(toolbar, `<tr><th>OPP ID</th><th>关联线索</th><th>关联订单</th><th>金额</th><th>阶段</th></tr>`,
      (rows) => rows.map((o) => `<tr class="click-row" data-act="opp" data-id="${o.id}">
        <td class="num">${esc(oppNoOf(o))}</td>
        <td>${oppLeadLink(o)}</td>
        <td>${oppOrderLink(o)}</td>
        <td class="num">${money(o.amount)}</td>
        <td>${badge(o.stage)}</td>
      </tr>`).join(""), list);
  }

  function viewOrders() {
    const f = state.filters;
    const list = filterOrderList("sales");
    const statuses = ["待审核", "履约中", "已发货", "已完成", "已驳回", "已取消"];
    const toolbar = `<div class="toolbar">
      <div class="tabs">
        <button data-act="filter" data-k="status" data-v="" class="${!f.status ? "active" : ""}">全部</button>
        ${statuses.map((s) => `<button data-act="filter" data-k="status" data-v="${s}" class="${f.status === s ? "active" : ""}">${s}</button>`).join("")}
      </div>
      <div class="filters">
        <input data-act="q" placeholder="SO ID / SKU" value="${esc(f.q || "")}" />
        ${hasRight("order-create") || hasRight("*") ? `<button class="btn" data-act="form" data-form="order">新建订单</button>` : ""}
        ${exportBtn("orders")}
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>SO ID</th><th>来源</th><th>SKU</th><th>数量</th><th>金额</th><th>要货</th><th>状态</th></tr>`,
      (rows) => rows.map((o) => `<tr class="click-row" data-act="order" data-id="${o.id}">
        <td class="num">${esc(o.orderNo)}</td>
        <td>${orderSourceCell(o)}</td>
        <td class="num">${esc(lineSkuText(o))}</td>
        <td class="num">${lineQtySum(o)}</td>
        <td class="num">${money(orderAmtOf(o))}</td>
        <td class="num">${esc(orderNeedBy(o))}</td>
        <td>${badge(salesOrderStatus(o))}</td>
      </tr>`).join(""), list);
  }

  function viewFulfillment() {
    const f = state.filters;
    const list = filterOrderList("fulfill").flatMap((o) => orderLines(o).map((line) => ({ o, line })));
    const toolbar = `<div class="toolbar">
      <div class="filters">
        <input data-act="q" placeholder="SO ID / SKU" value="${esc(f.q || "")}" />
        ${exportBtn("fulfillment")}
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>SO ID</th><th>SKU</th><th>销售需求</th><th>要货时间</th><th>仓库1</th><th>仓库2</th><th>仓库3</th><th>待补货</th></tr>`,
      (rows) => rows.map(({ o, line }) => {
        const p = product(line.productId);
        const st = fulfillLineStats(o, line);
        return `<tr class="click-row" data-act="order" data-id="${o.id}">
        <td class="num">${esc(o.orderNo)}</td>
        <td class="num">${esc(p?.sku || "—")}</td>
        <td class="num">${line.qty}</td>
        <td class="num">${esc(orderNeedBy(o))}</td>
        <td class="num">${st.w1}</td>
        <td class="num">${st.w2}</td>
        <td class="num">${st.w3}</td>
        <td class="num">${fulfillGapHtml(st)}</td>
      </tr>`;
      }).join(""), list);
  }

  function viewPOs() {
    const f = state.filters;
    const canStock = hasRight("stock") || hasRight("*");
    let list = (D.purchaseOrders || []).slice();
    if (f.status === "在途") list = list.filter((p) => OPEN_PO.has(p.status) && p.status !== "待审核");
    else if (f.status) list = list.filter((p) => p.status === f.status);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((p) => [p.poNo, poSkuText(p), p.source, p.sourceOrder, supplier(p.supplierId)?.name].join(" ").toLowerCase().includes(q));
    }
    const toolbar = `<div class="toolbar">
      <div class="tabs">${[["", "全部"], ["待审核", "待审核"], ["在途", "在途"], ["已入库", "已入库"]].map(([k, l]) => `<button data-act="filter" data-k="status" data-v="${k}" class="${(f.status || "") === k ? "active" : ""}">${l}</button>`).join("")}</div>
      <div class="filters">
        <input data-act="q" placeholder="PO / SKU / 供应商" value="${esc(f.q || "")}" />
        ${canStock ? `<button class="btn" data-act="form" data-form="po">新建采购</button>` : ""}
        ${exportBtn("pos")}
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>采购订单</th><th>供应商</th><th>SKU</th><th>订购</th><th>已收</th><th>金额</th><th>预计到货</th><th>仓库</th><th>状态</th></tr>`,
      (rows) => rows.map((p) => `<tr class="click-row" data-act="po" data-id="${p.id}">
        <td class="num">${esc(p.poNo)}</td>
        <td>${esc(supplier(p.supplierId)?.name || "—")}</td>
        <td class="num">${esc(poSkuText(p))}</td>
        <td class="num">${poQty(p)}</td>
        <td class="num">${poRecv(p)}</td>
        <td class="num">${money2(poAmount(p))}</td>
        <td class="num">${esc(p.expectedDate || "—")}</td>
        <td>${esc(warehouseLabel(p.warehouseId))}</td>
        <td>${badge(p.status)}</td>
      </tr>`).join(""), list);
  }

  function viewProducts() {
    const f = state.filters;
    let list = D.products.slice();
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((p) => (p.sku + p.name + (p.spec || "")).toLowerCase().includes(q));
    }
    const toolbar = `<div class="toolbar">
      <div class="filters">
        <input data-act="q" placeholder="SKU / 名称 / 规格" value="${esc(f.q || "")}" />
        ${hasRight("stock") || hasRight("*") ? `<button class="btn" data-act="form" data-form="product">新建商品</button>` : ""}
        ${exportBtn("products")}
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>SKU</th><th>商品名称</th><th>规格</th></tr>`,
      (rows) => rows.map((p) => `<tr class="click-row" data-act="product" data-id="${p.id}">
        <td class="num">${esc(p.sku)}</td>
        <td><b>${esc(p.name)}</b></td>
        <td>${esc(p.spec || "—")}</td>
      </tr>`).join(""), list);
  }

  function viewInventory() {
    const f = state.filters;
    let list = D.inventory.slice();
    if (f.wh) list = list.filter((x) => String(x.warehouseId) === String(f.wh));
    if (f.status) list = list.filter((x) => inventoryStatus(x) === f.status);
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((x) => (product(x.productId).sku + product(x.productId).name + x.batchNo).toLowerCase().includes(q));
    }
    const toolbar = `<div class="toolbar">
      <div class="tabs">${["", "低于安全库存", "正常"].map((s) => `<button data-act="filter" data-k="status" data-v="${s}" class="${(f.status || "") === s ? "active" : ""}">${s || "全部批次"}</button>`).join("")}</div>
      <div class="filters">
        <input data-act="q" placeholder="SKU / 批次" value="${esc(f.q || "")}" />
        <select data-act="filter" data-k="wh"><option value="">全部仓库</option>${D.warehouses.map((w) => `<option value="${w.id}" ${String(f.wh) === String(w.id) ? "selected" : ""}>${warehouseLabel(w)}</option>`).join("")}</select>
      </div>
    </div>`;
    return tablePage(toolbar, `<tr><th>仓库</th><th>SKU</th><th>商品</th><th>批次</th><th>效期</th><th>在库</th><th>安全库存</th><th>采购在途</th></tr>`,
      (rows) => rows.map((i) => {
        const p = product(i.productId);
        const d = daysTo(i.expiryDate);
        const inbound = inboundOpenOf(i.productId, i.warehouseId);
        return `<tr>
          <td>${esc(warehouseLabel(i.warehouseId))}</td>
          <td class="num">${esc(p.sku)}</td><td>${esc(p.name)}</td>
          <td class="num">${esc(i.batchNo)}</td>
          <td class="num">${esc(i.expiryDate)} <span style="color:var(--muted)">(${d}天)</span></td>
          <td class="num">${i.qty}${Number(i.lockQty) > 0 ? `<div class="tiny">预占 ${i.lockQty}</div>` : ""}</td>
          <td class="num">${safetyFromOnHand(i.qty)}</td>
          <td class="num">${inbound || "—"}</td>
        </tr>`;
      }).join(""), list);
  }

  function viewFinance() {
    const f = state.filters;
    const tab = financeTab();
    const canFin = hasRight("finance") || hasRight("*");
    const m = metrics();
    const arRows = salesCollectRows();
    const apRows = purchasePayRows();
    const arPaidAmtSum = arRows.reduce((s, r) => s + collectAmtOf(r), 0);
    const arInvSum = arRows.reduce((s, r) => s + invAmtOf(r), 0);
    const arOpenSum = arRows.reduce((s, r) => s + salesFin(r).openAmt, 0);
    const arOverSum = arRows.filter((r) => arDisplayStatus(r) === "逾期").reduce((s, r) => s + salesFin(r).openAmt, 0);
    const apPaidSum = apRows.reduce((s, r) => s + purchaseFin(r).payAmt, 0);
    const apInSum = apRows.reduce((s, r) => s + purchaseFin(r).inAmt, 0);
    const apInvSum = apRows.reduce((s, r) => s + purchaseFin(r).invAmt, 0);
    const apOpenSum = apRows.reduce((s, r) => s + (r.ap && r.ap.status !== "已付款" ? Number(r.ap.amount || 0) : 0), 0);
    const nearVal = (m.near || []).reduce((s, i) => s + lotValue(i), 0);
    const pnl = stocktakePnL();
    const buyCost = monthPurchaseCost();
    const fee = (D.campaignCost || []).reduce((s, c) => s + Number(c.cost || 0), 0);
    const profit = m.salesAmt - m.cogs - fee;
    const ph = tab === "ap" ? "采购订单 / SKU / 供应商"
      : tab === "cost" ? "SKU / 批次 / 仓库"
      : tab === "ana" ? "SKU / 客户 / 渠道"
      : "销售订单 / SKU / 客户";
    const exportKind = ({ ar: "finance-ar", ap: "finance-ap", cost: "finance-cost", ana: "finance-ana" })[tab];
    const toolbar = `<div class="toolbar">
      <div class="filters">
        ${tab === "ana" ? "" : `<input data-act="q" placeholder="${ph}" value="${esc(f.q || "")}" />`}
        ${canFin && tab === "ar" ? `<button class="btn" data-act="form" data-form="payment">登记收款</button><button class="btn ghost" data-act="import-bank">导入银行流水</button><button class="btn ghost" data-act="auto-match">执行自动对账</button>` : ""}
        ${exportBtn(exportKind)}
      </div>
    </div>`;
    const kpi = (items, wide) => `<div class="kpis${wide ? " wide" : ""}">${items.map((it) => `<article class="kpi"><div class="label">${it.label}</div><div class="value">${it.value}</div></article>`).join("")}</div>`;

    if (tab === "ap") {
      let list = apRows.slice();
      if (f.status === "已付款") list = list.filter((r) => r.payStatus === "已付款");
      else if (f.status === "未付款") list = list.filter((r) => r.payStatus !== "已付款");
      else if (f.status === "付款计划") list = list.filter((r) => r.payStatus !== "已付款" && apPlanDate(r)).sort((a, b) => String(apPlanDate(a)).localeCompare(String(apPlanDate(b))));
      else if (f.status === "异常") list = list.filter((r) => purchaseGap(r));
      if (f.q) {
        const q = f.q.toLowerCase();
        list = list.filter((r) => [r.p.poNo, poSkuText(r.p), r.p.status, r.inboundNo, r.ap?.no, r.ap?.invoiceNo, supplier(r.p.supplierId)?.name, ...purchaseIssues(r), purchaseMatchStatus(r)].join(" ").toLowerCase().includes(q));
      }
      const sub = `<div class="toolbar"><div class="tabs">${[["", "采购订单"], ["已付款", "已付款"], ["未付款", "未付款"], ["付款计划", "付款计划"], ["异常", "对账异常"]].map(([k, l]) => `<button data-act="filter" data-k="status" data-v="${k}" class="${(f.status || "") === k ? "active" : ""}">${l}</button>`).join("")}</div>
        <p class="tiny">与采购订单同一批 PO。看付款进度，并核对订 / 入 / 票 / 付。入库后才形成应付。</p></div>`;
      return toolbar + kpi([
        { label: "采购订单金额", value: money(apRows.reduce((s, r) => s + purchaseFin(r).poAmt, 0)) },
        { label: "已入库金额", value: money(apInSum) },
        { label: "已收发票", value: money(apInvSum) },
        { label: "已付款", value: money(apPaidSum) },
        { label: "未付款", value: money(apOpenSum) },
        { label: "对账异常", value: apRows.filter((r) => purchaseGap(r)).length },
      ], true) + sub + tablePage("", `<tr><th>采购订单</th><th>SKU</th><th>订购</th><th>供应商</th><th>金额</th><th>已入库</th><th>已收发票</th><th>已付款</th><th>未付款</th><th>计划付款日</th><th>采购状态</th><th>对账</th><th></th></tr>`,
        (rows) => rows.map((r) => {
          const a = purchaseFin(r);
          const unpaid = r.ap && r.ap.status !== "已付款" ? +Number(r.ap.amount || 0).toFixed(2) : 0;
          const issues = purchaseIssues(r);
          const st = purchaseMatchStatus(r);
          const act = canFin && issues.includes("已入库未收票") && r.ap
            ? `<button class="btn ghost" data-act="ap-inv" data-id="${r.ap.id}">登记发票</button>`
            : (canFin && r.ap && r.ap.status !== "已付款" && r.inboundNo ? `<button class="btn" data-act="ap-pay" data-id="${r.ap.id}">确认付款</button>` : "");
          return `<tr class="click-row" data-act="po" data-id="${r.p.id}">
          <td class="num">${esc(r.p.poNo)}</td>
          <td class="num">${esc(poSkuText(r.p))}</td>
          <td class="num">${poQty(r.p)}</td>
          <td>${esc(supplier(r.p.supplierId)?.name || "—")}</td>
          <td class="num">${money2(a.poAmt)}</td>
          <td class="num">${money2(a.inAmt)}</td>
          <td class="num">${money2(a.invAmt)}</td>
          <td class="num">${money2(a.payAmt)}</td>
          <td class="num">${money2(unpaid)}</td>
          <td class="num">${esc(apPlanDate(r) || "—")}</td>
          <td>${badge(r.p.status)}</td>
          <td>${badge(st)}${issues.filter((x) => x !== st).map((x) => badge(x)).join("")}</td>
          <td>${act}</td>
        </tr>`;
        }).join(""), list);
    }

    if (tab === "cost") {
      let list = D.inventory.slice();
      if (f.status === "临期") list = list.filter((i) => daysTo(i.expiryDate) <= (cfg().nearDays || 30) && daysTo(i.expiryDate) >= 0 && Number(i.qty) > 0);
      else if (f.status === "滞销") list = list.filter((i) => Number(i.qty) > 0 && isSlowLot(i));
      if (f.q) {
        const q = f.q.toLowerCase();
        list = list.filter((i) => [product(i.productId)?.sku, product(i.productId)?.name, i.batchNo, warehouseLabel(i.warehouseId)].join(" ").toLowerCase().includes(q));
      }
      const sub = `<div class="toolbar"><div class="tabs">${[["", "全部批次"], ["临期", "临期"], ["滞销", "滞销"]].map(([k, l]) => `<button data-act="filter" data-k="status" data-v="${k}" class="${(f.status || "") === k ? "active" : ""}">${l}</button>`).join("")}</div>
        <p class="tiny">SKU × 仓库 × 批次 × 数量 × 成本单价。看库存值多少钱，不只看还有多少盒。</p></div>`;
      return toolbar + kpi([
        { label: "当前库存金额", value: money(m.invValue) },
        { label: "本月采购成本", value: money(buyCost) },
        { label: "销售成本", value: money(m.cogs) },
        { label: "库存周转", value: Math.round(m.turnover) + " 天" },
        { label: "临期库存金额", value: money(nearVal) },
        { label: "盘盈盘亏", value: money(pnl) },
      ], true) + sub + tablePage("", `<tr><th>SKU</th><th>商品</th><th>仓库</th><th>批次</th><th>数量</th><th>成本单价</th><th>库存金额</th><th>效期</th></tr>`,
        (rows) => rows.map((i) => {
          const p = product(i.productId);
          return `<tr>
            <td class="num">${esc(p?.sku || "—")}</td>
            <td>${esc(p?.name || "—")}</td>
            <td>${esc(warehouseLabel(i.warehouseId))}</td>
            <td class="num">${esc(i.batchNo)}</td>
            <td class="num">${i.qty}</td>
            <td class="num">${money2(lotCost(i))}</td>
            <td class="num">${money2(lotValue(i))}</td>
            <td class="num">${esc(i.expiryDate)} <span style="color:var(--muted)">(${daysTo(i.expiryDate)}天)</span></td>
          </tr>`;
        }).join(""), list);
    }

    if (tab === "ana") {
      const dim = f.status || "sku";
      const bySku = skuSalesRank(12).map((x) => {
        const p = D.products.find((pr) => pr.sku === x.sku);
        const cogs = x.qty * (p?.cost || 0);
        let paid = 0;
        m.activeOrders.forEach((o) => {
          const lineAmt = orderLines(o).filter((l) => l.productId === p?.id).reduce((s, l) => s + Number(l.amount || l.qty * l.unitPrice || 0), 0);
          if (!lineAmt || !o.amount) return;
          paid += collectAmtOf({ o, ar: arOfOrder(o), outs: [], pays: [], pending: [] }) * (lineAmt / o.amount);
        });
        return { label: x.sku, sub: x.name, sales: x.amt, cogs, gross: x.amt - cogs, paid };
      });
      const byCh = SALES_CHANNELS.map((ch) => {
        const os = m.activeOrders.filter((o) => o.channel === ch);
        const sales = os.reduce((s, o) => s + o.amount, 0);
        const cogs = os.reduce((s, o) => s + orderLines(o).reduce((a, l) => a + l.qty * (product(l.productId)?.cost || 0), 0), 0);
        const paid = os.reduce((s, o) => s + collectAmtOf({ o, ar: arOfOrder(o), outs: [], pays: [], pending: [] }), 0);
        return { label: ch, sub: os.length + " 单", sales, cogs, gross: sales - cogs, paid };
      });
      const byCust = {};
      m.activeOrders.forEach((o) => {
        const name = customer(o.customerId)?.name || "—";
        const rec = byCust[name] || { label: name, sub: customer(o.customerId)?.region || "", sales: 0, cogs: 0, paid: 0 };
        rec.sales += o.amount;
        rec.cogs += orderLines(o).reduce((a, l) => a + l.qty * (product(l.productId)?.cost || 0), 0);
        rec.paid += collectAmtOf({ o, ar: arOfOrder(o), outs: [], pays: [], pending: [] });
        byCust[name] = rec;
      });
      const byRegion = {};
      m.activeOrders.forEach((o) => {
        const name = customer(o.customerId)?.region || "—";
        const rec = byRegion[name] || { label: name, sub: "", sales: 0, cogs: 0, paid: 0 };
        rec.sales += o.amount;
        rec.cogs += orderLines(o).reduce((a, l) => a + l.qty * (product(l.productId)?.cost || 0), 0);
        rec.paid += collectAmtOf({ o, ar: arOfOrder(o), outs: [], pays: [], pending: [] });
        byRegion[name] = rec;
      });
      const monthMap = {};
      m.activeOrders.forEach((o) => {
        const key = String(o.createdAt || "").slice(0, 7) || "2026-08";
        const rec = monthMap[key] || { label: key, sub: "", sales: 0, cogs: 0, paid: 0 };
        rec.sales += o.amount;
        rec.cogs += orderLines(o).reduce((a, l) => a + l.qty * (product(l.productId)?.cost || 0), 0);
        rec.paid += collectAmtOf({ o, ar: arOfOrder(o), outs: [], pays: [], pending: [] });
        monthMap[key] = rec;
      });
      const rows = dim === "channel" ? byCh
        : dim === "customer" ? Object.values(byCust).sort((a, b) => b.sales - a.sales)
        : dim === "region" ? Object.values(byRegion).sort((a, b) => b.sales - a.sales)
        : dim === "month" ? Object.values(monthMap)
        : bySku;
      rows.forEach((r) => { r.gross = r.sales - r.cogs; });
      const sub = `<div class="toolbar"><div class="tabs">${[["sku", "产品/SKU"], ["channel", "电商/经销商"], ["customer", "客户"], ["region", "区域"], ["month", "月份"]].map(([k, l]) => `<button data-act="filter" data-k="status" data-v="${k}" class="${dim === k ? "active" : ""}">${l}</button>`).join("")}</div>
        <p class="tiny">销售额 → 销售成本 → 毛利 → 费用 → 利润。给总经办看经营结果，不是财务流水。</p></div>`;
      const pie = rows.filter((r) => r.sales).map((r) => ({ label: r.label, value: r.sales }));
      return toolbar + kpi([
        { label: "销售额", value: money(m.salesAmt) },
        { label: "销售成本", value: money(m.cogs) },
        { label: "毛利", value: money(m.salesAmt - m.cogs) },
        { label: "费用", value: money(fee) },
        { label: "利润", value: money(profit) },
      ], true) + sub + `<div class="grid-2" style="margin-top:8px">
        <div class="card"><h3>构成</h3>${pie.length ? pieChart(pie) : "<p class='tiny'>暂无</p>"}</div>
        <div class="card"><h3>毛利结构</h3>${barChart(rows.slice(0, 8).map((r) => ({ label: r.label, value: r.gross })), money)}</div>
      </div>` + tablePage("", `<tr><th>维度</th><th>说明</th><th>销售额</th><th>销售成本</th><th>毛利</th><th>回款</th></tr>`,
        (xs) => xs.map((r) => `<tr>
          <td>${esc(r.label)}</td><td>${esc(r.sub || "—")}</td>
          <td class="num">${money2(r.sales)}</td>
          <td class="num">${money2(r.cogs)}</td>
          <td class="num">${money2(r.gross)}</td>
          <td class="num">${money2(r.paid || 0)}</td>
        </tr>`).join(""), rows);
    }

    let list = arRows.slice();
    if (f.status === "已收款") list = list.filter((r) => arDisplayStatus(r) === "已收款");
    else if (f.status === "未收款") list = list.filter((r) => ["未收款", "部分收款"].includes(arDisplayStatus(r)));
    else if (f.status === "逾期") list = list.filter((r) => arDisplayStatus(r) === "逾期");
    else if (f.status === "异常" || f.status === "未齐" || f.status === "差异") list = list.filter((r) => salesGap(r));
    if (f.q) {
      const q = f.q.toLowerCase();
      list = list.filter((r) => [r.o.orderNo, lineSkuText(r.o), salesOrderStatus(r.o), salesMatchStatus(r), customer(r.o.customerId)?.name, ...r.pays.map((x) => x.no)].join(" ").toLowerCase().includes(q));
    }
    const sub = `<div class="toolbar"><div class="tabs">${[["", "销售订单"], ["已收款", "已收款"], ["未收款", "未收款"], ["逾期", "逾期应收"], ["异常", "对账异常"]].map(([k, l]) => `<button data-act="filter" data-k="status" data-v="${k}" class="${(f.status || "") === k ? "active" : ""}">${l}</button>`).join("")}</div>
      <p class="tiny">与订单中心同一批销售订单。看收款进度，并核对订 / 出 / 票 / 收。出库后才形成应收。</p></div>`;
    return toolbar + kpi([
      { label: "销售订单金额", value: money(arRows.reduce((s, r) => s + orderAmtOf(r.o), 0)) },
      { label: "已开票金额", value: money(arInvSum) },
      { label: "已收款金额", value: money(arPaidAmtSum) },
      { label: "未收款金额", value: money(arOpenSum) },
      { label: "逾期应收", value: money(arOverSum) },
      { label: "对账异常", value: arRows.filter((r) => salesGap(r)).length },
    ], true) + sub + tablePage("", `<tr><th>SO ID</th><th>SKU</th><th>数量</th><th>金额</th><th>客户</th><th>出库</th><th>已开票</th><th>已收款</th><th>未收款</th><th>账期</th><th>到期</th><th>订单状态</th><th>对账</th><th></th></tr>`,
      (rows) => rows.map((r) => {
        const a = salesFin(r);
        const d = salesDiffs(r);
        const st = arDisplayStatus(r);
        const days = Number(customer(r.o.customerId)?.creditDays || 0);
        const act = canFin && d.status === "待开票"
          ? `<button class="btn" data-act="issue-inv" data-id="${r.o.id}">开票</button>`
          : (canFin && r.pending[0]
            ? `<button class="btn" data-act="match" data-id="${r.pending[0].id}">核销收款</button>`
            : (canFin && r.ar && st !== "已收款" && (r.collectStatus === "待收款" || r.collectStatus === "部分收款")
              ? `<button class="btn" data-act="form" data-form="payment" data-oid="${r.o.id}">登记收款</button>` : ""));
        return `<tr class="click-row" data-act="order" data-id="${r.o.id}">
          <td class="num">${esc(r.o.orderNo)}</td>
          <td class="num">${esc(lineSkuText(r.o))}</td>
          <td class="num">${lineQtySum(r.o)}</td>
          <td class="num">${money(a.orderAmt)}</td>
          <td>${esc(customer(r.o.customerId)?.name || "—")}</td>
          <td class="num">${money2(a.shipAmt)}</td>
          <td class="num">${money2(a.invAmt)}</td>
          <td class="num">${money2(a.payAmt)}</td>
          <td class="num">${money2(a.openAmt)}</td>
          <td class="num">${days ? days + " 天" : "现款"}</td>
          <td class="num">${esc(arDueOf(r.o, r.ar, r.outs) || "—")}</td>
          <td>${badge(salesOrderStatus(r.o))}</td>
          <td>${badge(d.status)}${st === "逾期" && d.status !== "逾期" ? badge("逾期") : ""}${d.diffs.map((x) => `<div class="tiny">${esc(x)}</div>`).join("")}</td>
          <td>${act}</td>
        </tr>`;
      }).join(""), list);
  }

  const REPORT_DEPTS = [
    { id: "market", label: "市场" },
    { id: "sales", label: "销售" },
    { id: "supply", label: "供应链" },
    { id: "finance", label: "财务" },
  ];
  const REPORT_CATALOG = [
    { id: "mkt-daily", dept: "market", period: "daily", no: "RPT-MKT-D", title: "市场获客日报", status: "已发布", meta: "线索 · 来源 · 跟进" },
    { id: "mkt-month", dept: "market", period: "month", no: "RPT-MKT-M", title: "市场投放月报", status: "已发布", meta: "投放费用 · 转化" },
    { id: "sales-daily", dept: "sales", period: "daily", no: "RPT-SAL-D", title: "销售业绩日报", status: "已发布", meta: "订单 · 渠道 · SKU" },
    { id: "sales-month", dept: "sales", period: "month", no: "RPT-SAL-M", title: "销售经营月报", status: "已发布", meta: "漏斗 · 成交 · 履约" },
    { id: "supply-daily", dept: "supply", period: "daily", no: "RPT-SUP-D", title: "仓配履约日报", status: "已发布", meta: "出库 · 缺货 · 补货" },
    { id: "supply-month", dept: "supply", period: "month", no: "RPT-SUP-M", title: "进销存月报", status: "评审中", meta: "周转 · 安全库存" },
    { id: "fin-daily", dept: "finance", period: "daily", no: "RPT-FIN-D", title: "资金回款日报", status: "已发布", meta: "出库 · 收款" },
    { id: "fin-month", dept: "finance", period: "month", no: "RPT-FIN-M", title: "财务经营月报", status: "已发布", meta: "收付 · 毛利" },
  ];
  function defaultReportDept() {
    if (state.role === "marketing") return "market";
    if (state.role === "sales" || state.role === "sales-lead") return "sales";
    if (state.role === "warehouse") return "supply";
    if (state.role === "finance") return "finance";
    return "sales";
  }
  function sourceConversionRows() {
    return LEAD_SOURCES.map((src) => {
      const rows = scopedLeads().filter((l) => (l.source || "展会") === src);
      const converted = rows.filter((l) => l.status === "已转商机").length;
      return { src, n: rows.length, converted, rate: converted / (rows.length || 1) };
    });
  }
  function reportBody(rpt, m) {
    const leads = scopedLeads();
    const todayLeads = leads.filter((l) => String(l.createdAt || "").slice(0, 10) === TODAY).length;
    const todayOrders = m.activeOrders.filter((o) => String(o.createdAt || "").slice(0, 10) === TODAY);
    const todayAmt = todayOrders.reduce((s, o) => s + o.amount, 0);
    const adCost = (D.campaignCost || []).reduce((s, c) => s + Number(c.cost || 0), 0);
    const srcRows = sourceConversionRows();
    const skuRank = skuSalesRank(6);
    const saleDays = sumByDay(m.activeOrders, (o) => o.createdAt, (o) => o.amount);
    const cum = [];
    saleDays.reduce((s, d) => { const n = s + d.value; cum.push(n); return n; }, 0);
    const pendingSo = scopedOrders().filter((o) => o.status === "待审核").length;
    const shortageN = scopedOrders().filter((o) => orderHasShortage(o)).length;
    const pendingOb = (D.outbound || []).filter((o) => o.status === "待出库");
    const shippedOb = (D.outbound || []).filter((o) => o.status === "已发货");
    const whBars = D.warehouses.map((w) => ({
      label: warehouseLabel(w),
      value: D.inventory.filter((i) => i.warehouseId === w.id).reduce((s, i) => s + Math.max(avail(i), 0), 0),
    }));
    const needTop = m.purchaseNeedOpen.slice().sort((a, b) => b.qty - a.qty).slice(0, 6);
    const funnel = [
      { name: "线索", n: leads.length },
      { name: "商机", n: scopedOpps().length },
      { name: "报价", n: scopedOpps().filter((o) => ["方案报价", "商务谈判", "成交"].includes(o.stage)).length },
      { name: "成交", n: scopedOpps().filter((o) => o.stage === "成交").length },
      { name: "有效订单", n: m.activeOrders.length },
    ];
    const maxF = funnel[0].n || 1;
    const channelPie = SALES_CHANNELS.map((ch) => ({ label: ch, value: m.channelSales[ch] || 0 }));
    const acquirePie = LEAD_SOURCES.map((src) => ({ label: src, value: m.acquireLeads[src] || 0 })).filter((x) => x.value);
    const payDays = sumByDay(D.reconciliations.filter((r) => r.status === "匹配成功"), (r) => r.date, (r) => r.amount);
    const custAr = {};
    D.receivables.forEach((r) => {
      const name = customer(r.customerId)?.name || "—";
      custAr[name] = (custAr[name] || 0) + arRemainOf(r);
    });
    const custArBars = Object.entries(custAr).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    if (rpt.id === "mkt-daily") {
      const followDays = countByDay(D.followups, (f) => f.at);
      return rptKpis([
        { label: "线索总量", value: leads.length, delta: "市场录入", route: "leads" },
        { label: "今日新增", value: todayLeads, delta: TODAY, tone: todayLeads ? "up" : "", route: "leads" },
        { label: "已转商机", value: m.converted, route: "opps" },
        { label: "线索转化率", value: pct(m.leadRate), delta: "已转商机 / 线索" },
      ]) + `<div class="rpt-grid">
        ${rptCard("新增线索", "08-12 起按日", barChart(countByDay(leads, (l) => l.createdAt)))}
        ${rptCard("来源结构", "当前线索", acquirePie.length ? pieChart(acquirePie) : "<p class='tiny'>暂无线索</p>")}
        ${rptCard("跟进记录", "销售写进展", barChart(followDays))}
        ${rptCard("来源转化", "支撑投放取舍", `<div class="table-wrap"><table class="data"><thead><tr><th>来源</th><th>线索</th><th>已转商机</th><th>转化率</th></tr></thead><tbody>${srcRows.map((r) => `<tr><td>${esc(r.src)}</td><td class="num">${r.n}</td><td class="num">${r.converted}</td><td class="num">${pct(r.rate)}</td></tr>`).join("")}</tbody></table></div>`)}
      </div>`;
    }
    if (rpt.id === "mkt-month") {
      const costBars = (D.campaignCost || []).map((c) => ({ label: c.channel, value: c.cost }));
      const typePie = [
        { label: "线上投放", value: leads.filter((l) => l.acquireType === "线上投放").length },
        { label: "线下活动", value: leads.filter((l) => l.acquireType !== "线上投放").length },
      ];
      return rptKpis([
        { label: "本月线索", value: leads.length, route: "leads" },
        { label: "投放费用", value: money(adCost), delta: "展会 / 广告 / 电商 / 推荐" },
        { label: "单线索成本", value: money(adCost / (leads.length || 1)), delta: "费用 / 线索数" },
        { label: "转化率", value: pct(m.leadRate) },
      ]) + `<div class="rpt-grid">
        ${rptCard("投放费用", "按线索来源记账", barChart(costBars, money))}
        ${rptCard("获客方式", "线上 / 线下", pieChart(typePie))}
        ${rptCard("来源结构", "线索来源", acquirePie.length ? pieChart(acquirePie) : "<p class='tiny'>暂无线索</p>")}
        ${rptCard("投放决策", "高转化来源优先补预算", `<ul class="fin-list">
          <li><span>展会转化</span><b>${pct((srcRows.find((r) => r.src === "展会") || {}).rate || 0)}</b></li>
          <li><span>广告转化</span><b>${pct((srcRows.find((r) => r.src === "广告") || {}).rate || 0)}</b></li>
          <li><span>已转商机金额口径</span><b>${money(scopedOpps().filter((o) => o.leadId).reduce((s, o) => s + o.amount, 0))}</b></li>
          <li><span>建议</span><b>展会线索已出成交单，广告仍在跟进</b></li>
        </ul>`)}
      </div>`;
    }
    if (rpt.id === "sales-daily") {
      return rptKpis([
        { label: "有效订单金额", value: money(m.salesAmt), route: "orders" },
        { label: "今日下单", value: money(todayAmt), delta: `${todayOrders.length} 笔`, tone: todayAmt ? "up" : "" },
        { label: "待审核", value: pendingSo, route: "orders", status: "待审核" },
        { label: "缺货订单", value: shortageN, delta: "需采购履约", tone: shortageN ? "down" : "up", route: "fulfillment" },
      ]) + `<div class="rpt-grid">
        ${rptCard("订单金额", "柱为当日，线为累计", comboBarLine(saleDays.map((d) => d.label), saleDays.map((d) => d.value), cum))}
        ${rptCard("销售渠道", "有效订单金额", channelPie.some((i) => i.value) ? pieChart(channelPie) : "<p class='tiny'>暂无订单</p>")}
        ${rptCard("SKU 贡献", "按订单行金额", hBarChart(skuRank.map((x) => ({ label: x.sku, value: x.amt })), money))}
        ${rptCard("当日决策", "审核 / 缺货优先", `<ul class="alert-list">
          ${m.activeOrders.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((o) => `<li class="click-row" data-act="order" data-id="${o.id}"><span><b>${esc(o.orderNo)}</b> ${esc(lineSkuText(o))}</span><span>${money(o.amount)} ${badge(salesOrderStatus(o))}${orderHasShortage(o) ? badge("缺货") : ""}</span></li>`).join("")}
        </ul>`)}
      </div>`;
    }
    if (rpt.id === "sales-month") {
      return rptKpis([
        { label: "本月销售额", value: money(m.salesAmt), route: "orders" },
        { label: "成交率", value: pct(m.winRate), route: "opps" },
        { label: "履约率", value: pct(m.fulfillRate), route: "fulfillment" },
        { label: "人均产出", value: money(m.salesAmt / Math.max(1, (D.sales || []).length)) },
      ]) + `<div class="rpt-grid">
        ${rptCard("日销售趋势", "本月有效订单", lineChart(saleDays.map((d) => d.value), saleDays.map((d) => d.label)))}
        ${rptCard("销售漏斗", "线索到订单", `<div class="funnel">${funnel.map((f) => `<div class="funnel-row"><span>${f.name}</span><div class="funnel-bar" style="width:${Math.max(28, (f.n / maxF) * 100)}%">${f.n}</div><span>${pct(f.n / maxF)}</span></div>`).join("")}</div>`)}
        ${rptCard("渠道结构", "电商 / 线下经销商", channelPie.some((i) => i.value) ? pieChart(channelPie) : "<p class='tiny'>暂无订单</p>")}
        ${rptCard("商机阶段", "本月管道", `<div class="table-wrap"><table class="data"><thead><tr><th>阶段</th><th>数量</th><th>金额</th></tr></thead><tbody>${["需求确认", "方案报价", "商务谈判", "成交", "丢单"].map((st) => {
          const rows = scopedOpps().filter((o) => o.stage === st);
          return `<tr><td>${esc(st)}</td><td class="num">${rows.length}</td><td class="num">${money(rows.reduce((s, o) => s + o.amount, 0))}</td></tr>`;
        }).join("")}</tbody></table></div>`)}
      </div>`;
    }
    if (rpt.id === "supply-daily") {
      return rptKpis([
        { label: "待出库", value: pendingOb.length, route: "fulfillment" },
        { label: "缺货率", value: pct(m.oos / (m.skuTotal || 1)), route: "inventory" },
        { label: "待补货 SKU", value: m.purchaseNeedOpen.length, route: "fulfillment" },
        { label: "临期批次", value: m.near.length, delta: "30 天内", tone: m.near.length ? "down" : "up" },
      ]) + `<div class="rpt-grid">
        ${rptCard("仓库在库", "可销量", barChart(whBars))}
        ${rptCard("出库状态", "当前出库单", pieChart([{ label: "待出库", value: pendingOb.length }, { label: "已发货", value: shippedOb.length }]))}
        ${rptCard("采购需求 TOP", "销售+安全−可用−在途", hBarChart(needTop.map((x) => ({ label: x.product.sku, value: x.qty }))))}
        ${rptCard("履约预警", "点击下钻库存", `<ul class="alert-list">${[
          ...m.purchaseNeedOpen.slice(0, 3).map((x) => ({ sku: x.product.sku, name: x.product.name, st: "待补货" })),
          ...m.low.slice(0, 2).map((p) => ({ sku: p.sku, name: p.name, st: "低于安全库存" })),
          ...m.near.slice(0, 2).map((i) => ({ sku: product(i.productId).sku, name: product(i.productId).name, st: "临期" })),
        ].slice(0, 6).map((a) => `<li class="click-row" data-act="go" data-route="inventory" data-q="${esc(a.sku)}"><span><b>${esc(a.sku)}</b> ${esc(a.name)}</span>${badge(a.st)}</li>`).join("") || "<p class='tiny'>暂无预警</p>"}</ul>`)}
      </div>`;
    }
    if (rpt.id === "supply-month") {
      const invValue = D.inventory.reduce((s, i) => s + Math.max(avail(i), 0) * (product(i.productId)?.cost || 0), 0);
      const safetyBars = D.products.filter((p) => p.status === 1).map((p) => {
        const on = m.stockMap[p.id] || 0;
        return { sku: p.sku, safety: p.safety, on, gap: p.safety - on };
      }).filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 6);
      const outDays = countByDay(D.outbound, (o) => o.date);
      return rptKpis([
        { label: "库存周转", value: `${Math.round(m.turnover)} 天`, route: "inventory" },
        { label: "在库成本", value: money(invValue) },
        { label: "在途采购", value: m.pendingPo.length, route: "pos" },
        { label: "低于安全库存", value: m.low.length, tone: m.low.length ? "down" : "up", route: "inventory", status: "低于安全库存" },
      ]) + `<div class="rpt-grid">
        ${rptCard("仓库在库", "三仓可销量", barChart(whBars))}
        ${rptCard("安全库存缺口", "安全 − 可用 > 0", hBarChart(safetyBars.map((x) => ({ label: x.sku, value: x.gap }))))}
        ${rptCard("出库单日序", "含待出库", barChart(outDays))}
        ${rptCard("进销存摘要", "本月单据", `<ul class="fin-list">
          <li><span>销售需求驱动补货</span><b>${m.purchaseNeedOpen.length} SKU</b></li>
          <li><span>未到货采购</span><b>${m.pendingPo.map((p) => p.poNo).join(" · ") || "无"}</b></li>
          <li><span>已发货出库</span><b>${shippedOb.length} 笔</b></li>
          <li><span>临期 / 低水位</span><b>${m.near.length} / ${m.low.length}</b></li>
        </ul>`)}
      </div>`;
    }
    if (rpt.id === "fin-daily") {
      return rptKpis([
        { label: "本月应收", value: money(m.arAmt), route: "fin-ar" },
        { label: "已核销", value: money(m.paid), tone: "up" },
        { label: "未清应收", value: money(m.arOpen), tone: m.arOpen ? "down" : "up", route: "fin-ar" },
        { label: "回款率", value: pct(m.paid / (m.arAmt || 1)) },
      ]) + `<div class="rpt-grid">
        ${rptCard("回款进度", "柱为当日核销", barChart(payDays, money))}
        ${rptCard("应收结构", "已核 / 未清", pieChart([{ label: "已核销", value: m.paid }, { label: "未清应收", value: m.arOpen }]))}
        ${rptCard("客户未清", "按剩余应收", hBarChart(custArBars, money))}
        ${rptCard("收付事项", "出库收款优先", `<ul class="fin-list">
          <li class="click-row" data-act="go" data-route="fin-ar" data-status="异常"><span>对账差异</span><b>${m.diff.length} 笔</b></li>
          <li class="click-row" data-act="go" data-route="fin-ar"><span>待核销收款</span><b>${m.pendingPay.length} 笔</b></li>
          <li class="click-row" data-act="go" data-route="fin-ap" data-status="未付款"><span>未付款</span><b>${money(m.apOpen)}</b></li>
          <li><span>建议</span><b>${m.arOpen ? "SO-202608-002 已出库待收款" : "出库收款已清"}</b></li>
        </ul>`)}
      </div>`;
    }
    const quad = [
      { label: "有效订单", value: m.salesAmt },
      { label: "应收", value: m.arAmt },
      { label: "已回款", value: m.paid },
      { label: "未清应付", value: m.apOpen },
    ];
    return rptKpis([
      { label: "毛利率", value: pct(m.grossRate) },
      { label: "销售收入", value: money(m.salesAmt) },
      { label: "销售成本", value: money(m.cogs) },
      { label: "未清应付", value: money(m.apOpen), route: "fin-ap", status: "" },
    ]) + `<div class="rpt-grid">
      ${rptCard("收付金额", "订单 / 出库收款 / 入库付款", barChart(quad, money))}
      ${rptCard("渠道收入", "有效订单", channelPie.some((i) => i.value) ? pieChart(channelPie) : "<p class='tiny'>暂无订单</p>")}
      ${rptCard("对账进度", "销售 / 采购链路", barChart([
        { label: "已齐", value: salesCollectRows().filter((r) => salesMatchStatus(r) === "匹配成功").length + purchasePayRows().filter((r) => purchaseMatchStatus(r) === "匹配成功").length },
        { label: "未齐", value: salesCollectRows().filter((r) => salesMatchStatus(r) !== "匹配成功").length + purchasePayRows().filter((r) => purchaseMatchStatus(r) !== "匹配成功").length },
      ]))}
      ${rptCard("月度结论", "经营决策", `<ul class="fin-list">
        <li><span>回款率</span><b>${pct(m.paid / (m.arAmt || 1))}</b></li>
        <li><span>毛利率</span><b>${pct(m.grossRate)}</b></li>
        <li><span>收款差异率</span><b>${pct(m.diff.length / (D.reconciliations.length || 1))}</b></li>
        <li><span>建议</span><b>先清电商未收款，再跟 PO-002 到货后的应付</b></li>
      </ul>`)}
    </div>`;
  }
  function viewReports() {
    const m = metrics();
    const dept = state.filters.dept || defaultReportDept();
    const list = REPORT_CATALOG.filter((r) => r.dept === dept);
    const rpt = list.find((r) => r.id === state.filters.rpt) || list[0] || REPORT_CATALOG[0];
    const periodLabel = rpt.period === "daily" ? "日报 · T+1" : "月报 · 2026年8月";
    return `<div class="rpt-page">
      <div class="rpt-toolbar">
        <div class="tabs rpt-depts">
          ${REPORT_DEPTS.map((d) => `<button data-act="filter" data-k="dept" data-v="${d.id}" class="${dept === d.id ? "active" : ""}">${d.label}</button>`).join("")}
        </div>
        <div class="tabs">
          ${list.map((r) => `<button data-act="filter" data-k="rpt" data-v="${r.id}" class="${r.id === rpt.id ? "active" : ""}">${esc(r.title)}</button>`).join("")}
        </div>
      </div>
      <div class="rpt-main">
        <div class="rpt-title">
          <div>
            <h2>${esc(rpt.title)}</h2>
            <p class="tiny">${esc(rpt.no)} · ${esc(periodLabel)} · 基准日 ${esc(TODAY)}</p>
          </div>
          ${badge(rpt.status)}
        </div>
        ${reportBody(rpt, m)}
      </div>
    </div>`;
  }

  function viewOutsource() {
    const canStock = hasRight("stock") || hasRight("*");
    return tablePage(`<div class="toolbar"><span class="tiny">委托生产工单。待放行需质检合格后入库。</span>
      ${canStock ? `<button class="btn" data-act="form" data-form="ww">新建委外</button>` : ""}</div>`,
      `<tr><th>工单</th><th>工厂</th><th>成品</th><th>数量</th><th>计划</th><th>状态</th><th></th></tr>`,
      (rows) => rows.map((w) => `<tr>
        <td class="num">${esc(w.no)}</td>
        <td>${esc(w.factory)}</td>
        <td>${esc(product(w.productId).name)}</td>
        <td class="num">${w.qty}</td>
        <td class="num">${esc(w.planDate)}</td>
        <td>${badge(w.status)}</td>
        <td>${canStock && w.status === "待放行" ? `<button class="btn" data-act="ww-release" data-id="${w.id}">检验放行入库</button>` : canStock && w.status === "生产中" ? `<button class="btn ghost" data-act="ww-wait" data-id="${w.id}">完成待放行</button>` : ""}</td>
      </tr>`).join(""), (D.outsource || []).slice());
  }

  /* ---------- drawers / forms ---------- */
  function leadKvHtml(l) {
    return `<div class="kv" style="margin-top:16px">
      <b>联系人</b><span>${esc(l.name || "—")} · ${esc(showPhone(l.phoneFull || l.phone))}</span>
      <b>SKU</b><span>${leadSkuHtml(l)}</span>
      <b>状态</b><span>${leadStatusHtml(l)}</span>
      <b>关联商机</b><span>${leadOppLink(l)}</span>
      <b>关联订单</b><span>${leadOrderLink(l)}</span>
      ${l.status === "无效" && l.closeReason ? `<b>原因</b><span>${esc(l.closeReason)}</span>` : ""}
    </div>`;
  }
  function leadLogsHtml(l, limit) {
    const logs = D.followups.filter((f) => f.leadId === l.id).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const shown = limit ? logs.slice(0, limit) : logs;
    if (shown.length) return shown.map((f) => `<div class="lead-log"><b>${esc(f.at)}</b> · ${esc(f.type)}<div>${esc(f.content)}</div></div>`).join("");
    return leadIsOpen(l) ? `<p class="tiny">还没有最新进展</p>` : "";
  }
  function leadFollowFormHtml(l) {
    const crm = hasRight("crm") || hasRight("*");
    if (!crm || !leadIsOpen(l)) return "";
    return `<form data-form="followup" data-id="${l.id}" class="form-grid" style="margin-top:12px">
      <label>最新进展<textarea name="content" required></textarea></label>
      <button class="btn" type="submit">保存最新进展</button>
    </form>`;
  }
  function leadCrmBtns(l) {
    const crm = hasRight("crm") || hasRight("*");
    if (!crm || !leadIsOpen(l)) return "";
    return `<button class="btn gold" data-act="to-opp" data-id="${l.id}">转商机</button>
      <button class="btn danger" data-act="lead-invalid" data-id="${l.id}">无效</button>`;
  }
  function showLead(id) {
    const l = byId(D.leads, id);
    openDrawer(`
      <h2>${esc(leadNoOf(l))} · ${esc(l.name || "—")}</h2>
      <div class="actions" style="margin-top:0">
        ${canWriteLead() ? `<button class="btn ghost" data-act="lead-edit" data-id="${l.id}">edit</button>` : ""}
        ${canDeleteLead(l) ? `<button class="btn danger" data-act="lead-del" data-id="${l.id}" title="delete" aria-label="delete">delete</button>` : ""}
        ${leadCrmBtns(l)}
        <button class="btn ghost" id="closeDrawerBtn">关闭</button>
      </div>
      ${leadKvHtml(l)}
      ${leadLogsHtml(l, 1)}
      ${leadFollowFormHtml(l)}
    `);
  }

  function poSourceHtml(p) {
    const rps = (D.replenishments || []).filter((r) => r.poId === p.id || poLines(p).some((l) => l.replenishmentId === r.id));
    if (!rps.length) {
      return `${esc(p.source || "手工")}${p.sourceOrder ? `<div>${esc(p.sourceOrder)}</div>` : ""}`;
    }
    return rps.map((r) => {
      const tr = demandTraceOf(r);
      return `<div>${esc(r.no)}</div><div>${esc(r.lineNo || tr?.so?.orderNo || "")}${tr?.line ? ` · 缺 ${r.shortageQty}` : ""}</div>`;
    }).join("");
  }
  function orderChainHtml(o, line) {
    const opp = orderSourceOpp(o);
    const lead = orderSourceLead(o);
    const rp = line ? replenishmentOfLine(o, line) : null;
    const po = rp ? poOfReplenishment(rp) : null;
    const parts = [];
    if (lead) parts.push(`<button class="linkish" data-act="lead" data-id="${lead.id}">${esc(leadNoOf(lead))}</button>`);
    if (opp) parts.push(`<button class="linkish" data-act="opp" data-id="${opp.id}">${esc(oppNoOf(opp))}</button>`);
    parts.push(`<button class="linkish" data-act="order" data-id="${o.id}">${esc(o.orderNo)}</button>`);
    if (line) parts.push(esc(lineNoOf(o, line)));
    if (rp) parts.push(`${esc(rp.no)} 缺 ${rp.shortageQty}`);
    if (po) parts.push(`<button class="linkish" data-act="po" data-id="${po.id}">${esc(po.poNo)}</button>`);
    return parts.join(" → ");
  }

  function showOppPeek(id) {
    const o = byId(D.opportunities, id);
    const so = oppOrders(o)[0];
    openDrawer(`
      <h2>${esc(oppNoOf(o))}</h2>
      <div class="kv">
        <b>阶段</b><span>${badge(o.stage)}</span>
        <b>金额</b><span>${money(o.amount)}</span>
        <b>关联订单</b><span>${so ? `<button class="linkish" data-act="order" data-id="${so.id}">${esc(so.orderNo)}</button>` : "—"}</span>
      </div>
      <div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>
    `);
  }
  function showOrderPeek(id) {
    const o = order(id);
    const opp = orderSourceOpp(o);
    openDrawer(`
      <h2>${esc(o.orderNo)}</h2>
      <div class="kv">
        <b>状态</b><span>${badge(salesOrderStatus(o))}${orderHasShortage(o) ? ` ${badge("缺货")}` : ""}</span>
        <b>金额</b><span>${money(orderAmtOf(o))}</span>
        <b>SKU</b><span>${esc(lineSummary(o))}</span>
        <b>关联商机</b><span>${opp ? `<button class="linkish" data-act="opp" data-id="${opp.id}">${esc(oppNoOf(opp))}</button>` : "—"}</span>
      </div>
      <div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>
    `);
  }
  function showOpp(id) {
    if (state.route === "leads") return showOppPeek(id);
    const o = byId(D.opportunities, id);
    const stages = ["需求确认", "方案报价", "商务谈判", "成交", "丢单"];
    const idx = stages.indexOf(o.stage);
    const crm = hasRight("crm") || hasRight("*");
    const lead = D.leads.find((x) => x.id === o.leadId);
    if (lead && lead.potential && !o.amount) o.amount = lead.potential;
    const winForm = crm && o.stage === "商务谈判";
    openDrawer(`
      <h2>${esc(oppNoOf(o))}</h2>
      <div class="actions" style="margin-top:0">
        ${crm && (o.stage === "需求确认" || o.stage === "方案报价") ? `<button class="btn" data-act="opp-next" data-id="${o.id}">推进到「${stages[idx + 1]}」</button>` : ""}
        ${crm && ["需求确认", "方案报价", "商务谈判"].includes(o.stage) ? `<button class="btn danger" data-act="opp-lose" data-id="${o.id}">丢单</button>` : ""}
        <button class="btn ghost" id="closeDrawerBtn">关闭</button>
      </div>
      <div class="kv" style="margin-top:16px">
        <b>关联线索</b><span>${oppLeadLink(o)}</span>
        <b>关联订单</b><span>${oppOrderLink(o)}</span>
        <b>金额</b><span>${money(o.amount)}</span>
        <b>阶段</b><span>${badge(o.stage)}</span>
        ${o.lossReason ? `<b>原因</b><span>${esc(o.lossReason)}</span>` : ""}
      </div>
      ${winForm ? `<form data-form="win" data-id="${o.id}" class="form-grid" style="margin-top:16px">
        <label>转订单客户<select name="customerId">${customerOptions(o.customerId || 1)}</select></label>
        <div><span class="tiny">一单可对应多个 SKU，可继续添加</span>
          <div id="orderLineBox">${lineRowHtml(1, 10)}${lineRowHtml(5, 10)}${lineRowHtml(7, 10)}</div>
          <button type="button" class="btn ghost" data-act="add-line">添加 SKU</button>
        </div>
        <label>收货地址<input name="address" value="${esc(customer(o.customerId || 1)?.address || "")}" required /></label>
        <label>要货日期<input name="needBy" type="date" value="2026-09-10" required /></label>
        <button class="btn gold" type="submit">成交并生成销售订单</button>
      </form>` : ""}
    `, winForm);
  }

  function showOrder(id) {
    if (state.route === "leads" || state.route === "opps") return showOrderPeek(id);
    if (isFulfillView()) showOrderFulfill(id);
    else showOrderSales(id);
  }
  function orderSwitchBtn(id, mode) {
    if (mode === "fulfill" && can("fulfillment")) return `<button class="btn ghost" data-act="order-view" data-mode="fulfill" data-id="${id}">采购履约</button>`;
    if (mode === "sales" && can("orders")) return `<button class="btn ghost" data-act="order-view" data-mode="sales" data-id="${id}">商务视图</button>`;
    return "";
  }
  function showOrderSales(id) {
    const o = order(id);
    const lines = orderLines(o);
    const row = { o, outs: outboundOf(o), ar: arOfOrder(o), pays: [], pending: [], collectStatus: salesCollectStatus(o) };
    const a = String(state.route || "").startsWith("fin-") ? salesFin(row) : null;
    openDrawer(`
      <h2>${esc(o.orderNo)}</h2>
      <div class="actions" style="margin-top:0">
        ${orderSwitchBtn(o.id, "fulfill")}
        <button class="btn ghost" id="closeDrawerBtn">关闭</button>
      </div>
      <div class="kv" style="margin-top:16px">
        <b>来源</b><span>${orderSourceCell(o)}</span>
        ${orderSourceLead(o) ? `<b>关联线索</b><span><button class="linkish" data-act="lead" data-id="${orderSourceLead(o).id}">${esc(leadNoOf(orderSourceLead(o)))}</button></span>` : ""}
        <b>客户</b><span>${esc(customer(o.customerId)?.name || "—")}</span>
        <b>金额</b><span>${money(orderAmtOf(o))}</span>
        <b>要货</b><span>${esc(orderNeedBy(o))}</span>
        <b>状态</b><span>${badge(salesOrderStatus(o))}${orderHasShortage(o) ? ` ${badge("缺货")}` : ""}</span>
        ${a ? `<b>已开票</b><span>${money2(a.invAmt)}</span>
        <b>已收款</b><span>${money2(a.payAmt)}</span>
        <b>未收款</b><span>${money2(a.openAmt)}</span>
        <b>收款</b><span>${badge(arDisplayStatus(row))}</span>` : ""}
      </div>
      <div class="table-wrap" style="margin-top:16px"><table class="data">
        <thead><tr><th>SKU</th><th>数量</th><th>金额</th></tr></thead>
        <tbody>${lines.map((l) => {
          const p = product(l.productId);
          return `<tr><td class="num">${esc(p?.sku || "—")}</td><td class="num">${l.qty}</td><td class="num">${money(l.amount)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    `);
  }
  function showOrderFulfill(id) {
    const o = order(id);
    const lines = orderLines(o);
    const outs = outboundOf(o);
    const canApprove = hasRight("fulfill") || hasRight("*");
    openDrawer(`
      <h2>${esc(o.orderNo)}</h2>
      <div class="kv" style="margin-top:8px"><b>要货时间</b><span>${esc(orderNeedBy(o))}</span></div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>SKU</th><th>销售需求</th><th>仓库1</th><th>仓库2</th><th>仓库3</th><th>待补货</th></tr></thead>
        <tbody>${lines.map((line) => {
          const p = product(line.productId);
          const st = fulfillLineStats(o, line);
          return `<tr><td class="num">${esc(p?.sku || "—")}</td><td class="num">${line.qty}</td><td class="num">${st.w1}</td><td class="num">${st.w2}</td><td class="num">${st.w3}</td><td class="num">${fulfillGapHtml(st)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="actions">
        ${o.status === "待审核" && canApprove ? `<button class="btn" data-act="approve" data-id="${o.id}">审核通过并预占</button><button class="btn ghost" data-act="reject" data-id="${o.id}">审核不通过</button>` : ""}
        ${canApprove ? outs.filter((x) => x.status === "待出库").map((x) => `<button class="btn" data-act="ship" data-id="${x.id}">出库 ${esc(product(x.productId).sku)} ×${x.qty}</button>`).join("") : ""}
        ${o.status === "已发货" && canApprove ? `<button class="btn gold" data-act="complete" data-id="${o.id}">客户签收完成</button>` : ""}
        ${orderSwitchBtn(o.id, "sales")}
        <button class="btn ghost" id="closeDrawerBtn">关闭</button>
      </div>
    `, true);
  }

  function showPO(id) {
    const p = byId(D.purchaseOrders, id);
    if (!p) return;
    const lines = poLines(p);
    openDrawer(`
      <h2>${esc(p.poNo)}</h2>
      <div class="meta">${esc(supplier(p.supplierId).name)} · ${badge(p.status)} · ${esc(p.source || "手工")}</div>
      <p class="tiny">供应链与销售订单按订单行 + SKU 关联，不按整单。</p>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>采购行</th><th>SKU</th><th>订购</th><th>补货单</th><th>订单行</th><th>缺货</th></tr></thead>
        <tbody>${lines.map((l) => {
          const pr = product(l.productId);
          const rp = (D.replenishments || []).find((r) => r.id === l.replenishmentId || (r.poId === p.id && r.productId === l.productId));
          return `<tr>
            <td class="num">${esc(p.poNo)}-${String(l.id).padStart(2, "0")}</td>
            <td>${esc(pr?.sku || "")}<div class="tiny">${esc(pr?.name || "")}</div></td>
            <td class="num">${l.qty}</td>
            <td class="num">${rp ? esc(rp.no) : "—"}</td>
            <td class="num">${rp ? esc(rp.lineNo) : "—"}</td>
            <td class="num">${rp ? rp.shortageQty : "—"}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      ${lines.map((l) => {
        const rp = (D.replenishments || []).find((r) => r.id === l.replenishmentId || (r.poId === p.id && r.productId === l.productId));
        const tr = demandTraceOf(rp);
        if (!tr || !tr.so) return "";
        return `<h3 style="margin:18px 0 8px;font-size:14px">反查 · ${esc(rp.no)}</h3>
          <div class="kv">
            <b>补货</b><span>${esc(rp.no)} · ${esc(product(rp.productId)?.sku || "")} 缺 ${rp.shortageQty}（行需求 ${rp.demandQty} · 当时可用 ${rp.availableQty}）</span>
            <b>订单行</b><span><button class="linkish" data-act="order" data-id="${tr.so.id}">${esc(tr.line ? lineNoOf(tr.so, tr.line) : rp.lineNo)}</button></span>
            <b>销售订单</b><span><button class="linkish" data-act="order" data-id="${tr.so.id}">${esc(tr.so.orderNo)}</button> · ${esc(tr.so.status)}</span>
            <b>客户</b><span>${esc(tr.customer?.name || "—")}</span>
            <b>商机</b><span>${tr.opp ? `<button class="linkish" data-act="opp" data-id="${tr.opp.id}">${esc(oppNoOf(tr.opp))} ${esc(tr.opp.name)}</button>` : "—"}</span>
            <b>线索</b><span>${tr.lead ? `<button class="linkish" data-act="lead" data-id="${tr.lead.id}">${esc(leadNoOf(tr.lead))} ${esc(tr.lead.name)} · ${esc(tr.lead.company)}</button> · ${esc(leadSourceText(tr.lead))}` : "—"}</span>
            <b>链路</b><span>${orderChainHtml(tr.so, tr.line)}</span>
          </div>`;
      }).join("")}
      <div class="actions">
        ${hasRight("stock") || hasRight("*") ? (
          p.status === "待审核"
            ? `<button class="btn" data-act="po-approve" data-id="${p.id}">审核</button>`
            : (poRemain(p) > 0 ? `<button class="btn" data-act="po-recv" data-id="${p.id}">收货</button>` : "")
        ) : ""}
        <button class="btn ghost" id="closeDrawerBtn">关闭</button>
      </div>
    `, true);
  }

  function openLead(id) {
    showLead(id);
  }
  function formLead(id) {
    if (!canWriteLead()) { toast("仅市场部可维护线索"); return; }
    const l = id ? byId(D.leads, Number(id)) : null;
    const cats = productCategories();
    const cat = (l && cats.includes(l.segment) ? l.segment : "") || product(l?.productId)?.category || cats[0] || "";
    const pid = l?.productId || productsByCategory(cat)[0]?.id || "";
    openDrawer(`<h2>${l ? "edit " + esc(leadNoOf(l)) : "新建线索"}</h2>
      <form data-form="lead" ${l ? `data-id="${l.id}"` : ""} class="form-grid">
      <div class="form-row"><label>联系人<input name="name" required value="${esc(l?.name || "")}" /></label>
      <label>联系方式<input name="phone" required placeholder="11位手机号" value="${esc(l?.phoneFull || l?.phone || "")}" /></label></div>
      <div class="form-row">
        <label>商品分类<select name="productCat" data-act="lead-cat">${selOpts(cats, cat)}</select></label>
        <label>感兴趣产品<select name="productId">${leadInterestOpts(cat, pid)}</select></label>
      </div>
      <button class="btn" type="submit">保存</button>
    </form>
    <div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`);
  }
  function lineRowHtml(selected, qty) {
    return `<div class="order-line">
      <label>SKU<select name="productId">${productOptions(selected)}</select></label>
      <label>数量<input name="qty" type="number" min="1" value="${qty || 10}" required /></label>
      <button type="button" class="btn ghost" data-act="remove-line" title="删除此行">×</button>
    </div>`;
  }
  function formOrder() {
    openDrawer(`<h2>新建销售订单</h2><form data-form="order" class="form-grid">
      <label>客户<select name="customerId">${customerOptions()}</select></label>
      <label>销售渠道<select name="channel">${salesChannelOpts("线下经销商")}</select></label>
      <div><span class="tiny">一单可对应多个 SKU，可继续添加</span>
        <div id="orderLineBox">${lineRowHtml()}${lineRowHtml(5, 10)}</div>
        <button type="button" class="btn ghost" data-act="add-line">添加 SKU</button>
      </div>
      <label>收货地址<input name="address" placeholder="省市区街道" required /></label>
      <label>要货日期<input name="needBy" type="date" value="2026-09-10" required /></label>
      <button class="btn" type="submit">提交待审核</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function formPayment(orderId) {
    const so = orderId ? order(Number(orderId)) : null;
    const ar = so ? arOfOrder(so) : null;
    const remain = ar ? arRemainOf(ar) : "";
    const cid = so?.customerId;
    openDrawer(`<h2>登记收款</h2>
      ${so ? `<p class="tiny">${esc(so.orderNo)} · ${esc(lineSkuText(so))} ×${lineQtySum(so)} · 订单 ${money(orderAmtOf(so))}${ar ? " · 应收余额 " + money2(remain) : " · 尚未出库，未形成应收"}</p><form data-form="payment" class="form-grid"><input type="hidden" name="orderId" value="${so.id}" />` : `<form data-form="payment" class="form-grid">`}
      <label>客户<select name="customerId">${D.customers.map((c) => `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <div class="form-row"><label>金额<input name="amount" type="number" step="0.01" required value="${remain}" /></label>
      <label>方式<select name="method"><option>银行转账</option><option>支付宝</option><option>微信</option></select></label></div>
      <button class="btn" type="submit">${so ? "确认收款" : "保存待核销"}</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function formProduct() {
    openDrawer(`<h2>新建商品</h2><form data-form="product" class="form-grid">
      <label>SKU<input name="sku" required placeholder="FW-XXX-001" /></label>
      <label>商品名称<input name="name" required /></label>
      <label>规格<input name="spec" value="60粒/瓶" required /></label>
      <button class="btn" type="submit">保存</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`);
  }
  function formPO(pid, qty) {
    const need = pid ? purchaseNeedOf(pid) : null;
    const q = qty > 0 ? qty : (need && need.qty > 0 ? need.qty : 10);
    const hint = need ? `建议数量 ${need.qty}（销售 ${need.sales} + 安全 ${need.safety} − 可用 ${need.available} − 未到货 ${need.inbound}）` : "数量可按采购需求公式填写。";
    openDrawer(`<h2>新建采购单（可多行）</h2>
      <p class="tiny">${esc(hint)}</p>
      <form data-form="po" class="form-grid">
      <label>供应商<select name="supplierId">${D.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
      <label>收货仓<select name="warehouseId">${D.warehouses.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("")}</select></label>
      <div><span class="tiny">采购明细</span>
        <div id="orderLineBox">${pid ? lineRowHtml(pid, q) : `${lineRowHtml()}${lineRowHtml()}`}</div>
        <button type="button" class="btn ghost" data-act="add-line">添加商品行</button>
      </div>
      <label>预计到货<input name="expectedDate" type="date" value="2026-09-10" /></label>
      <button class="btn" type="submit">提交待审核</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function formReceive(id) {
    const p = byId(D.purchaseOrders, id);
    const lines = poLines(p);
    openDrawer(`<h2>采购收货 · ${esc(p.poNo)}</h2>
      <p class="tiny">${esc(supplier(p.supplierId).name)} · 已收 ${poRecv(p)} / ${poQty(p)}</p>
      <form data-form="receive" data-id="${p.id}" class="form-grid">
        ${lines.map((l) => {
          const remain = l.qty - (l.receivedQty || 0);
          return `<div class="form-row">
            <label>${esc(product(l.productId).name)}<input type="hidden" name="lineId" value="${l.id}" />
              <div class="tiny">订 ${l.qty} · 已收 ${l.receivedQty || 0}</div></label>
            <label>本次收货<input name="recvQty" type="number" min="0" max="${Math.max(remain, 0)}" value="${remain}" /></label>
          </div>`;
        }).join("")}
        <div class="form-row">
          <label>收货仓<select name="warehouseId">${D.warehouses.map((w) => `<option value="${w.id}" ${w.id === (p.warehouseId || 1) ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>
          <label>验收结论<select name="qc"><option value="1">合格入库</option><option value="0">不合格冻结</option></select></label>
        </div>
        <button class="btn" type="submit">确认收货</button>
      </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function formWW() {
    openDrawer(`<h2>新建委外工单</h2><form data-form="ww" class="form-grid">
      <label>工厂<select name="factory">${D.suppliers.map((s) => `<option>${esc(s.name)}</option>`).join("")}</select></label>
      <label>成品<select name="productId">${productOptions()}</select></label>
      <div class="form-row"><label>数量<input name="qty" type="number" min="1" value="1000" required /></label>
      <label>计划完工<input name="planDate" type="date" value="2026-09-20" /></label></div>
      <button class="btn" type="submit">下达生产</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`);
  }
  function formTransfer() {
    openDrawer(`<h2>仓间调拨</h2><form data-form="transfer" class="form-grid">
      <label>商品<select name="productId">${productOptions()}</select></label>
      <div class="form-row"><label>调出仓<select name="from">${D.warehouses.map((w) => `<option value="${w.id}">${esc(warehouseLabel(w))}</option>`).join("")}</select></label>
      <label>调入仓<select name="to">${D.warehouses.map((w) => `<option value="${w.id}" ${w.id === 2 ? "selected" : ""}>${esc(warehouseLabel(w))}</option>`).join("")}</select></label></div>
      <label>数量<input name="qty" type="number" min="1" value="10" required /></label>
      <button class="btn" type="submit">执行调拨（FIFO）</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function formStocktake() {
    openDrawer(`<h2>库存盘点</h2><form data-form="stocktake" class="form-grid">
      <label>批次<select name="invId">${D.inventory.map((i) => `<option value="${i.id}">${esc(warehouseLabel(i.warehouseId))} · ${esc(product(i.productId).sku)} · ${esc(i.batchNo)} 账面 ${i.qty}</option>`).join("")}</select></label>
      <label>实盘数量<input name="qty" type="number" min="0" required /></label>
      <label>说明<input name="remark" value="周期盘点" /></label>
      <button class="btn" type="submit">过账盘盈盘亏</button>
    </form><div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`, true);
  }
  function showProduct(id) {
    const p = product(id);
    openDrawer(`<h2>${esc(p.sku)}</h2>
      <div class="kv">
        <b>商品名称</b><span>${esc(p.name)}</span>
        <b>规格</b><span>${esc(p.spec || "—")}</span>
      </div>
      <div class="actions"><button class="btn ghost" id="closeDrawerBtn">关闭</button></div>`);
  }
  const FORMS = { lead: formLead, order: formOrder, payment: formPayment, product: formProduct, po: formPO, transfer: formTransfer, stocktake: formStocktake, ww: formWW };

  function handleForm(form) {
    const type = form.dataset.form;
    const fd = new FormData(form);
    const val = (k) => String(fd.get(k) || "").trim();
    if (type === "ai") {
      runAIAsk(val("q"));
      return;
    }
    if (type === "lead") {
      if (!canWriteLead()) { toast("仅市场部可维护线索"); return; }
      const phoneRaw = val("phone");
      const editId = Number(form.dataset.id || 0);
      if (editId) {
        const l = byId(D.leads, editId);
        if (!l) { toast("线索不存在"); return; }
        l.name = val("name");
        applyLeadProduct(l, Number(val("productId")));
        if (!l.productId) { toast("请选择感兴趣产品"); return; }
        l.channel = l.source || l.channel;
        if (phoneRaw && !phoneRaw.includes("*")) {
          l.phone = maskPhone(phoneRaw);
          l.phoneFull = phoneRaw;
        }
        writeLeadProgress(l);
        audit("修改线索", leadNoOf(l), l.name);
        toast("已更新");
      } else {
        const created = {
          id: nextId(D.leads), leadNo: seqNo("LD-", D.leads, "leadNo"),
          name: val("name"), phone: maskPhone(phoneRaw), phoneFull: phoneRaw,
          company: "", title: "", region: "",
          channel: "", campaign: "",
          segment: "", interest: "", productId: null,
          potential: 0, intent: "中",
          capturedBy: "Marketing", capturedDept: "市场部",
          status: "待跟进", assignedTo: null, ownerName: "", createdAt: nowStr(), closeReason: "", opportunityId: null, progress: "待写进展",
        };
        applyLeadSource(created, "展会");
        applyLeadProduct(created, Number(val("productId")));
        if (!created.productId) { toast("请选择感兴趣产品"); return; }
        applyOwnerName(created, defaultOwnerName());
        writeLeadProgress(created);
        D.leads.unshift(created);
        audit("录入线索", leadNoOf(created), created.source);
        toast("已保存 " + leadNoOf(created));
      }
    } else if (type === "followup") {
      const leadId = Number(form.dataset.id);
      const l = byId(D.leads, leadId);
      D.followups.unshift({ id: nextId(D.followups), leadId, at: nowStr(), type: val("type") || "跟进", content: val("content"), next: val("next") || "" });
      if (!leadOwner(l)) applyOwnerName(l, defaultOwnerName());
      writeLeadProgress(l);
      audit("写最新进展", l.name, val("content").slice(0, 40));
      persist(); toast("最新进展已保存"); render(); openLead(leadId); return;
    } else if (type === "order") {
      const cid = Number(val("customerId"));
      const lines = parseFormLines(fd, cid);
      if (!lines.length) { toast("请至少添加一行有效 SKU"); return; }
      const c = customer(cid);
      const so = {
        id: nextId(D.salesOrders),
        orderNo: seqNo("SO-202608-", D.salesOrders, "orderNo"),
        channel: val("channel"), customerId: cid, productId: lines[0].productId, qty: 0,
        unitPrice: lines[0].unitPrice, discount: 0, receiver: c.name, phone: c.phone,
        address: val("address"), warehouseId: null, status: "待审核",
        source: "手工录入", sourceId: 0, createdAt: nowStr(), needBy: val("needBy") || "", amount: 0, receivable: 0, lines: [],
      };
      applyLines(so, lines);
      D.salesOrders.unshift(so);
      audit("新建订单", so.orderNo, lines.map((l) => product(l.productId).name + "×" + l.qty).join("，"));
      toast(`订单已提交，共 ${lines.length} 行明细（价目 ${c.priceLevel || c.type}）`);
      closeDrawer(); persist(); setRoute("orders"); return;
    } else if (type === "win") {
      const oid = Number(form.dataset.id);
      const opp = byId(D.opportunities, oid);
      opp.customerId = Number(val("customerId"));
      const lines = parseFormLines(fd, opp.customerId);
      if (!lines.length) { toast("请至少添加一行有效 SKU"); return; }
      opp.stage = "成交";
      opp.winReason = "商务条款达成";
      opp.closeDate = TODAY;
      const c = customer(opp.customerId);
      const so = {
        id: nextId(D.salesOrders),
        orderNo: seqNo("SO-202608-", D.salesOrders, "orderNo"),
        channel: c.type === "电商" ? "电商" : "线下经销商", customerId: opp.customerId, productId: lines[0].productId, qty: 0,
        unitPrice: lines[0].unitPrice, discount: 0, receiver: c.name, phone: c.phone,
        address: val("address"), warehouseId: null, status: "待审核",
        source: "CRM成交", sourceId: opp.id, createdAt: nowStr(), needBy: val("needBy") || "", amount: 0, receivable: 0, lines: [],
      };
      applyLines(so, lines);
      D.salesOrders.unshift(so);
      const lead = byId(D.leads, opp.leadId);
      if (lead) {
        lead.status = "已转商机";
        lead.convertedAt = lead.convertedAt || nowStr();
        lead.opportunityId = opp.id;
        lead.potential = so.amount;
        writeLeadProgress(lead);
      }
      audit("商机成交转单", so.orderNo, lines.length + " 行明细");
      toast("已生成 " + so.orderNo + `（${lines.length} 行）`);
      closeDrawer(); persist(); setRoute("orders"); return;
    } else if (type === "payment") {
      const oid = Number(val("orderId") || 0);
      const pay = {
        id: nextId(D.payments), no: seqNo("PAY-202608-", D.payments, "no"),
        customerId: Number(val("customerId")), amount: Number(val("amount")),
        date: TODAY, method: val("method"), account: "手工登记", status: "待核销",
        orderId: oid || 0,
      };
      D.payments.unshift(pay);
      audit("登记收款", pay.no, money2(pay.amount) + (oid ? " · " + (order(oid)?.orderNo || "") : ""));
      toast("收款已登记");
      if (oid) {
        persist();
        closeDrawer();
        matchPayment(pay.id);
        return;
      }
    } else if (type === "product") {
      D.products.push({
        id: nextId(D.products), sku: val("sku"), name: val("name"), spec: val("spec"),
        category: productCategories()[0] || "", brand: "Forvet", shelfLife: 730,
        price: 99, cost: 30, safety: 40, status: 1,
      });
      audit("新建商品", val("sku"), val("name"));
      toast("商品已上架");
    } else if (type === "product-edit") {
      const p = product(Number(form.dataset.id));
      p.safety = Number(val("safety"));
      p.status = Number(val("status"));
      audit("维护商品", p.sku, "安全库存 " + p.safety);
      toast("已保存");
    } else if (type === "po") {
      const pids = fd.getAll("productId").map(Number);
      const qtys = fd.getAll("qty").map(Number);
      const lines = [];
      pids.forEach((pid, i) => {
        const p = product(pid);
        const qty = Number(qtys[i]);
        if (!p || !(qty > 0)) return;
        lines.push({ id: lines.length + 1, productId: pid, qty, unitPrice: p.cost, receivedQty: 0 });
      });
      if (!lines.length) { toast("请至少添加一行有效 SKU"); return; }
      D.purchaseOrders.unshift({
        id: nextId(D.purchaseOrders), poNo: seqNo("PO-202608-", D.purchaseOrders, "poNo"),
        supplierId: Number(val("supplierId")), productId: lines[0].productId, qty: lines.reduce((s, l) => s + l.qty, 0),
        unitPrice: lines[0].unitPrice, orderDate: TODAY, expectedDate: val("expectedDate"),
        actualDate: null, status: "待审核", source: "手工采购", warehouseId: Number(val("warehouseId") || 1),
        receivedQty: 0, lines,
      });
      audit("新建采购", D.purchaseOrders[0].poNo, lines.length + " 行");
      toast("采购单已提交（" + lines.length + " 行）");
      state.route = "pos";
      state.filters = {};
      if (location.hash.slice(1) !== "pos") location.hash = "pos";
    } else if (type === "receive") {
      const ids = fd.getAll("lineId");
      const qtys = fd.getAll("recvQty");
      const map = {};
      ids.forEach((id, i) => { map[id] = Number(qtys[i] || 0); });
      receivePO(Number(form.dataset.id), map, val("warehouseId"), val("qc") !== "0");
      closeDrawer();
      return;
    } else if (type === "ww") {
      D.outsource.unshift({
        id: nextId(D.outsource), no: seqNo("WW-202608-", D.outsource, "no"),
        factory: val("factory"), productId: Number(val("productId")), qty: Number(val("qty")),
        planDate: val("planDate"), status: "生产中", remark: "手工下达",
      });
      audit("委外下达", D.outsource[0].no, product(Number(val("productId"))).name);
      toast("委外工单已下达");
    } else if (type === "transfer") {
      const pid = Number(val("productId"));
      const qty = Number(val("qty"));
      const from = Number(val("from"));
      const to = Number(val("to"));
      if (from === to) { toast("调出调入仓不能相同"); return; }
      const { picks, short } = allocate(pid, qty, from);
      if (short > 0) { toast("调出仓可用不足或批次过期禁售"); return; }
      picks.forEach(({ lot, take }) => {
        lot.qty -= take;
        addTx({ productId: pid, warehouseId: from, batchNo: lot.batchNo, type: "调拨出", qty: -take, before: lot.qty + take, after: lot.qty, refType: "调拨单", refNo: "TR-" + TODAY.replace(/-/g, ""), remark: "仓间调拨" });
        let dest = D.inventory.find((i) => i.productId === pid && i.warehouseId === to && i.batchNo === lot.batchNo);
        if (!dest) {
          dest = { id: nextId(D.inventory), productId: pid, warehouseId: to, batchNo: lot.batchNo, productionDate: lot.productionDate, expiryDate: lot.expiryDate, qty: 0, lockQty: 0 };
          D.inventory.push(dest);
        }
        dest.qty += take;
        addTx({ productId: pid, warehouseId: to, batchNo: lot.batchNo, type: "调拨入", qty: take, before: dest.qty - take, after: dest.qty, refType: "调拨单", refNo: "TR-" + TODAY.replace(/-/g, ""), remark: "仓间调拨" });
      });
      audit("仓间调拨", product(pid).sku, `${warehouseLabel(from)} → ${warehouseLabel(to)} × ${qty}`);
      toast("调拨完成");
    } else if (type === "stocktake") {
      const row = byId(D.inventory, Number(val("invId")));
      const qty = Number(val("qty"));
      const diff = qty - row.qty;
      const before = row.qty;
      row.qty = qty;
      addTx({
        productId: row.productId, warehouseId: row.warehouseId, batchNo: row.batchNo,
        type: diff >= 0 ? "盘盈" : "盘亏", qty: diff, before, after: row.qty,
        refType: "盘点单", refNo: seqNo("PD-202608-", D.inventoryTx, "id") , remark: val("remark"),
      });
      audit("库存盘点", row.batchNo, (diff >= 0 ? "盘盈 " : "盘亏 ") + Math.abs(diff));
      toast("盘点已过账");
    }
    persist();
    closeDrawer();
    render();
  }

  function runAIAsk(q) {
    const text = String(q || "").trim();
    if (!text) return;
    if (state.role !== "gm") { toast("仅总经办可使用 AI 工作台"); return; }
    const html = typeof window.ForvetAsk === "function"
      ? window.ForvetAsk(text, { D, TODAY, money, money2, pct, esc })
      : "<p class='ai-p'>问答模块未加载</p>";
    aiChat.push({ role: "user", text });
    aiChat.push({ role: "ai", html });
    audit("AI询问", text.slice(0, 48), "总经办工作台");
    persist();
    if (state.route !== "ai") setRoute("ai", false);
    else render();
  }

  function viewAI() {
    const m = metrics();
    const pendingSo = D.salesOrders.filter((o) => o.status === "待审核").length;
    const shortage = D.salesOrders.filter((o) => o.shortage).length;
    const pendingOb = D.outbound.filter((o) => o.status === "待出库").length;
    const shortcuts = [
      { route: "orders", label: "销售订单", ico: "▤" },
      { route: "pos", label: "采购订单", ico: "▥" },
      { route: "inventory", label: "库存管理", ico: "▦" },
      { route: "fin-ar", label: "应收管理", ico: "¥" },
    ];
    const log = aiChat.length
      ? aiChat.map((msg) => msg.role === "user"
        ? `<div class="ai-msg user"><div class="ai-bubble">${esc(msg.text)}</div><div class="ai-user" aria-hidden="true">我</div></div>`
        : `<div class="ai-msg bot"><div class="ai-avatar" aria-hidden="true">✦</div><div class="ai-bubble">${msg.html}</div></div>`).join("")
      : `<div class="ai-msg bot"><div class="ai-avatar" aria-hidden="true">✦</div><div class="ai-bubble">
          <p class="ai-p">你好，我是 Pharmavite OS 经营助手。只根据系统里已有单据回答，不编造数字。</p>
          <ul class="ai-bullets">
            <li>问销售额、回款、库存、缺货、采购需求</li>
            <li>直接输入单号、SKU、客户名</li>
            <li>点右侧快捷入口可下钻到对应模块</li>
          </ul>
        </div></div>`;
    return `<div class="ai-shell">
      <div class="ai-desk">
        <div class="ai-toolbar">
          <p class="tiny">答案只读当前演示数据 · 基准日 ${esc(TODAY)}</p>
          ${aiChat.length ? `<button class="btn ghost" type="button" data-act="ai-clear">清空对话</button>` : ""}
        </div>
        <div class="ai-log" id="aiLog">${log}</div>
        <div class="ai-dock">
          <div class="ai-suggest">${AI_SUGGEST.map((s) => `<button type="button" class="ai-chip" data-act="ai-ask" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
          <form data-form="ai" class="ai-composer">
            <span class="ai-mark" aria-hidden="true">✦</span>
            <textarea id="aiInput" name="q" rows="1" placeholder="描述你想查的经营数据，或使用上方快捷提问…" required></textarea>
            <button class="ai-send" type="submit" aria-label="发送">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </form>
        </div>
      </div>
      <aside class="ai-rail">
        <section class="ai-panel">
          <h3>快捷入口</h3>
          <div class="ai-quick">${shortcuts.map((x) => `<button type="button" class="ai-quick-btn" data-act="go" data-route="${x.route}"><span class="nav-ico">${x.ico}</span>${x.label}</button>`).join("")}</div>
        </section>
        <section class="ai-panel">
          <h3>经营概览</h3>
          <div class="ai-stats">
            <button type="button" class="ai-stat" data-act="go" data-route="orders">
              <span class="ai-stat-n">${m.activeOrders.length}</span>
              <span class="ai-stat-l">有效订单</span>
            </button>
            <button type="button" class="ai-stat" data-act="go" data-route="fin-ar">
              <span class="ai-stat-n">${money(m.arOpen)}</span>
              <span class="ai-stat-l">未清应收</span>
            </button>
            <button type="button" class="ai-stat" data-act="go" data-route="fulfillment" data-status="待审核">
              <span class="ai-stat-n">${pendingSo}</span>
              <span class="ai-stat-l">待审核</span>
            </button>
            <button type="button" class="ai-stat" data-act="go" data-route="fulfillment">
              <span class="ai-stat-n">${m.purchaseNeedOpen.length}</span>
              <span class="ai-stat-l">待补货 SKU</span>
            </button>
          </div>
          <p class="ai-stat-foot">缺货 ${shortage} 笔 · 待出库 ${pendingOb} 笔</p>
        </section>
      </aside>
    </div>`;
  }

  const VIEWS = {
    dashboard: viewDashboard, leads: viewLeads, opps: viewOpps, orders: viewOrders,
    fulfillment: viewFulfillment, pos: viewPOs,
    products: viewProducts, inventory: viewInventory,
    "fin-ar": viewFinance, "fin-ap": viewFinance,
    "fin-cost": viewFinance, "fin-ana": viewFinance,
    reports: viewReports, ai: viewAI,
    outsource: viewOutsource,
  };

  function renderNav() {
    $("#nav").innerHTML = NAV.map((g) => {
      const items = g.items.filter((i) => can(i.id));
      if (!items.length) return "";
      return `<div class="nav-group">
        <div class="nav-label">${g.group}</div>
        ${items.map((i) => `<a href="#${i.id}" class="${state.route === i.id ? "active" : ""}"><span class="nav-ico">${i.ico}</span>${i.label}</a>`).join("")}
      </div>`;
    }).join("");
  }

  function render() {
    if (!can(state.route) || !VIEWS[state.route]) {
      state.route = currentRole().modules[0];
      location.hash = state.route;
    }
    renderNav();
    $("#crumb").textContent = TITLES[state.route] || "经营驾驶舱";
    $(".crumb-bar")?.classList.toggle("is-ai", state.route === "ai");
    $("#view").classList.toggle("view-ai", state.route === "ai");
    $("#view").classList.toggle("view-rpt", state.route === "reports");
    $("#view").innerHTML = VIEWS[state.route]();
    refreshRoleUi();
    refreshInboxUi();
    if (isMobileNav()) applyNav(true);
    if (state.route === "ai") {
      const log = $("#aiLog");
      if (log) log.scrollTop = log.scrollHeight;
    }
  }

  function resolveRoute(id) {
    if (id === "outbound" || id === "purchase" || id === "purchases") return "fulfillment";
    if (id === "fin-buy") return "fin-ap";
    if (id === "fin-sales") return "fin-ar";
    if (id === "invoices" || id === "gl" || id === "audit" || id === "finance") {
      const t = state.filters.tab;
      if (t === "ap" || t === "buy" || t === "purchase") return "fin-ap";
      if (t === "sales" || t === "match" || t === "rec" || t === "quad") return "fin-ar";
      if (t === "cost" || t === "stock") return "fin-cost";
      if (t === "ana" || t === "analysis") return "fin-ana";
      return "fin-ar";
    }
    if (id === "stocktx") return "inventory";
    return id;
  }
  function setRoute(id, resetPage = true) {
    id = resolveRoute(id);
    state.route = id;
    if (resetPage) { state.page = 1; }
    if (location.hash.slice(1) !== id) location.hash = id;
    render();
  }

  function doExport(kind) {
    const maps = {
      leads: () => [["Lead ID", "联系人", "SKU", "状态", "商机", "订单"], ...scopedLeads().map((l) => {
        const opp = leadOpp(l);
        const so = leadOrders(l)[0];
        const p = leadProduct(l);
        const stLabel = (l.status === "已转商机" || l.status === "无效") ? l.status : "";
        return [leadNoOf(l), l.name, p?.sku || l.interest || "", stLabel, opp ? oppNoOf(opp) : "", so ? so.orderNo : ""];
      })],
      orders: () => [["SO ID", "来源", "SKU", "数量", "金额", "要货", "状态"], ...scopedOrders().map((o) => [o.orderNo, orderSourceOpp(o) ? oppNoOf(orderSourceOpp(o)) : (o.source || ""), lineSkuText(o), lineQtySum(o), orderAmtOf(o), orderNeedBy(o), salesOrderStatus(o)])],
      fulfillment: () => [["SO ID", "SKU", "销售需求", "要货时间", "仓库1", "仓库2", "仓库3", "待补货"], ...scopedOrders().flatMap((o) => orderLines(o).map((line) => {
        const st = fulfillLineStats(o, line);
        return [o.orderNo, product(line.productId)?.sku || "", line.qty, orderNeedBy(o), st.w1, st.w2, st.w3, st.pending || st.short || ""];
      }))],
      products: () => [["SKU", "商品名称", "规格"], ...D.products.map((p) => [p.sku, p.name, p.spec || ""])],
      pos: () => [["采购订单", "供应商", "SKU", "订购", "已收", "金额", "预计到货", "仓库", "状态"], ...(D.purchaseOrders || []).map((p) => [p.poNo, supplier(p.supplierId)?.name || "", poSkuText(p), poQty(p), poRecv(p), poAmount(p), p.expectedDate || "", warehouseLabel(p.warehouseId), p.status])],
      demand: () => [["SKU", "商品", "销售需求", "安全库存", "可用库存", "未到货", "采购需求"], ...purchaseNeedList().map((x) => [x.product.sku, x.product.name, x.sales, x.safety, x.available, x.inbound, x.qty])],
      opps: () => [["OPP ID", "关联线索", "关联订单", "金额", "阶段"], ...scopedOpps().map((o) => {
        const lead = D.leads.find((l) => l.id === o.leadId);
        const so = oppOrders(o)[0];
        return [oppNoOf(o), leadNoOf(lead), so ? so.orderNo : "", o.amount, o.stage];
      })],
      "finance-ar": () => [["SO ID", "SKU", "数量", "金额", "客户", "出库", "已开票", "已收款", "未收款", "账期", "到期", "订单状态", "对账", "差异"], ...salesCollectRows().map((r) => {
        const a = salesFin(r);
        const d = salesDiffs(r);
        return [r.o.orderNo, lineSkuText(r.o), lineQtySum(r.o), a.orderAmt, customer(r.o.customerId)?.name || "", a.shipAmt, a.invAmt, a.payAmt, a.openAmt, customer(r.o.customerId)?.creditDays || 0, arDueOf(r.o, r.ar, r.outs), salesOrderStatus(r.o), d.status, d.diffs.join(" / ")];
      })],
      "finance-ap": () => [["采购订单", "SKU", "订购", "供应商", "金额", "已入库", "已收发票", "已付款", "未付款", "计划付款日", "采购状态", "对账", "异常"], ...purchasePayRows().map((r) => {
        const a = purchaseFin(r);
        const unpaid = r.ap && r.ap.status !== "已付款" ? Number(r.ap.amount || 0) : 0;
        return [r.p.poNo, poSkuText(r.p), poQty(r.p), supplier(r.p.supplierId)?.name || "", a.poAmt, a.inAmt, a.invAmt, a.payAmt, unpaid, apPlanDate(r), r.p.status, purchaseMatchStatus(r), purchaseIssues(r).join(" / ")];
      })],
      "finance-cost": () => [["SKU", "商品", "仓库", "批次", "数量", "成本单价", "库存金额", "效期"], ...D.inventory.map((i) => [product(i.productId)?.sku || "", product(i.productId)?.name || "", warehouseLabel(i.warehouseId), i.batchNo, i.qty, lotCost(i), lotValue(i), i.expiryDate])],
      "finance-ana": () => [["SKU", "商品", "销售额", "销售成本", "毛利"], ...skuSalesRank(20).map((x) => {
        const p = D.products.find((pr) => pr.sku === x.sku);
        const cogs = x.qty * (p?.cost || 0);
        return [x.sku, x.name, x.amt, cogs, x.amt - cogs];
      })],
    };
    const rows = (maps[kind] || maps.orders)();
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Forvet-${kind}-${TODAY}.csv`;
    a.click();
    audit("数据导出", kind, rows.length - 1 + " 行");
    persist();
    toast("已导出 CSV");
  }

  function isMobileNav() {
    return window.matchMedia("(max-width: 1180px)").matches;
  }
  function applyNav(collapse) {
    if (collapse != null) state.navCollapsed = !!collapse;
    document.body.classList.toggle("nav-collapsed", state.navCollapsed);
    const btn = $("#menuBtn");
    if (btn) {
      btn.setAttribute("aria-expanded", state.navCollapsed ? "false" : "true");
      btn.setAttribute("aria-label", state.navCollapsed ? "展开侧栏" : "收起侧栏");
    }
  }
  function toggleNav() {
    applyNav(!state.navCollapsed);
    try { sessionStorage.setItem(NAV_KEY, state.navCollapsed ? "1" : "0"); } catch (_) { /* ignore */ }
  }
  function initNav() {
    const parts = TODAY.split("-");
    if ($("#calMonth")) $("#calMonth").textContent = Number(parts[1]) + "月";
    if ($("#calDay")) $("#calDay").textContent = String(Number(parts[2]));
    let collapsed = isMobileNav();
    if (!collapsed) {
      try {
        const saved = sessionStorage.getItem(NAV_KEY);
        if (saved === "1" || saved === "0") collapsed = saved === "1";
      } catch (_) { /* ignore */ }
    }
    applyNav(collapsed);
  }
  function refreshRoleUi() {
    const r = currentRole();
    if ($("#roleName")) $("#roleName").textContent = r ? r.name : "—";
  }

  function bind() {
    window.addEventListener("hashchange", () => {
      const raw = location.hash.slice(1) || "dashboard";
      const id = resolveRoute(raw);
      if (id !== raw) { location.hash = id; return; }
      if (!VIEWS[id] || !can(id)) {
        const fallback = currentRole().modules[0];
        if (location.hash.slice(1) !== fallback) location.hash = fallback;
        else if (state.route !== fallback) { state.route = fallback; render(); }
        return;
      }
      if (state.route === id) return;
      state.route = id;
      state.page = 1;
      state.filters = {};
      render();
    });
    $("#menuBtn").addEventListener("click", toggleNav);
    $("#drawerMask").addEventListener("click", closeDrawer);
    $("#confirmYes").addEventListener("click", () => { $("#confirmMask").hidden = true; confirmResolver?.(true); });
    $("#confirmNo").addEventListener("click", () => { $("#confirmMask").hidden = true; confirmResolver?.(false); });

    $("#bellBtn").addEventListener("click", () => {
      const panel = $("#bellPanel");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.innerHTML = inboxPanelHtml();
    });

    document.addEventListener("submit", (e) => {
      const form = e.target.closest("form[data-form]");
      if (!form) return;
      e.preventDefault();
      handleForm(form);
    });

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act], #closeDrawerBtn, .nav a");
      if (!t) {
        if (!e.target.closest("#bellPanel, #bellBtn")) $("#bellPanel").hidden = true;
        return;
      }
      if (t.id === "closeDrawerBtn") { closeDrawer(); return; }
      if (t.matches(".nav a")) {
        e.preventDefault();
        state.filters = {};
        setRoute(t.getAttribute("href").slice(1));
        return;
      }
      const act = t.dataset.act;
      if (act === "filter") {
        if (t.tagName === "SELECT" || t.tagName === "INPUT") return;
        state.filters[t.dataset.k] = t.dataset.v !== undefined ? t.dataset.v : t.value;
        if (t.dataset.k === "dept") delete state.filters.rpt;
        if (t.dataset.k === "tab") {
          delete state.filters.status;
          delete state.filters.need;
          delete state.filters.q;
        }
        state.page = 1;
        render();
      } else if (act === "page") {
        state.page += Number(t.dataset.dir);
        render();
      } else if (act === "ai-ask") {
        runAIAsk(t.dataset.q || "");
      } else if (act === "ai-clear") {
        aiChat.length = 0;
        render();
      } else if (act === "go") {
        $("#bellPanel").hidden = true;
        $("#bellPanel").innerHTML = "";
        state.filters = {};
        if (t.dataset.status) state.filters.status = t.dataset.status;
        if (t.dataset.tab) state.filters.tab = t.dataset.tab;
        if (t.dataset.q) state.filters.q = t.dataset.q;
        setRoute(t.dataset.route, false);
      } else if (act === "lead") openLead(Number(t.dataset.id));
      else if (act === "opp") showOpp(Number(t.dataset.id));
      else if (act === "order") showOrder(Number(t.dataset.id));
      else if (act === "order-view") {
        setRoute(t.dataset.mode === "fulfill" ? "fulfillment" : "orders", false);
        showOrder(Number(t.dataset.id));
      }
      else if (act === "po") showPO(Number(t.dataset.id));
      else if (act === "product") showProduct(Number(t.dataset.id));
      else if (act === "form") {
        if (t.dataset.form === "po") formPO(Number(t.dataset.pid || 0), Number(t.dataset.qty || 0));
        else if (t.dataset.form === "lead") formLead(t.dataset.id);
        else if (t.dataset.form === "payment") formPayment(Number(t.dataset.oid || 0));
        else FORMS[t.dataset.form]?.();
      } else if (act === "lead-edit") {
        formLead(t.dataset.id);
      } else if (act === "lead-del") {
        const l = byId(D.leads, Number(t.dataset.id));
        if (!canDeleteLead(l)) {
          toast(l && (leadOpp(l) || leadOrders(l).length) ? "已转商机或已有订单，不能删除" : "无权删除");
          return;
        }
        confirmAsk(`删除线索「${l.name}」？最新进展一并删除，不可恢复。`).then((ok) => {
          if (!ok) return;
          D.leads = D.leads.filter((x) => x.id !== l.id);
          D.followups = (D.followups || []).filter((f) => f.leadId !== l.id);
          audit("删除线索", l.name, l.company || "");
          persist();
          closeDrawer();
          toast("已删除");
          render();
        });
      } else if (act === "demand-po") {
        const needs = purchaseNeedList().filter((x) => x.qty > 0);
        if (!needs.length) { toast("按公式计算，当前无需采购"); return; }
        confirmAsk(`将按采购需求为 ${needs.length} 个 SKU 生成采购单（销售需求 + 安全库存 − 可用库存 − 未到货）。`).then((ok) => {
          if (!ok) return;
          const pos = generateDemandPOs(needs.map((x) => x.product.id));
          persist();
          toast(pos.length ? `已生成 ${pos.length} 张采购单` : "在途采购已覆盖，未新建单据");
          setRoute("pos");
        });
      }
      else if (act === "add-line") {
        e.preventDefault();
        const box = $("#orderLineBox");
        if (!box) return;
        box.insertAdjacentHTML("beforeend", lineRowHtml());
      } else if (act === "remove-line") {
        e.preventDefault();
        const box = $("#orderLineBox");
        if (!box || box.querySelectorAll(".order-line").length <= 1) { toast("至少保留一行 SKU"); return; }
        t.closest(".order-line")?.remove();
      }
      else if (act === "export") doExport(t.dataset.kind);
      else if (act === "approve") {
        confirmAsk("审核通过后将按近效期预占库存（过期禁售），并生成出库单。库存不足时自动转采购。").then((ok) => { if (ok) { closeDrawer(); approveOrder(Number(t.dataset.id)); } });
      } else if (act === "reject") {
        confirmAsk("确认审核不通过？不会预占库存，也不会生成出库单和采购单。").then((ok) => { if (ok) { closeDrawer(); rejectOrder(Number(t.dataset.id)); } });
      } else if (act === "ship") {
        confirmAsk("确认出库？将按 FIFO 扣减库存并生成应收单。").then((ok) => {
          if (!ok) return;
          const oid = byId(D.outbound, Number(t.dataset.id))?.orderId;
          shipOutbound(Number(t.dataset.id));
          if (oid) showOrder(oid);
        });
      } else if (act === "complete") completeOrder(Number(t.dataset.id));
      else if (act === "po-approve") {
        const id = Number(t.dataset.id);
        byId(D.purchaseOrders, id).status = "待发货";
        audit("采购审核", byId(D.purchaseOrders, id).poNo, "通过");
        persist(); toast("采购单已审核");
        showPO(id);
      } else if (act === "po-in") {
        confirmAsk("确认将剩余数量一次收货（默认合格）？").then((ok) => { if (ok) inboundPO(Number(t.dataset.id)); });
      } else if (act === "po-recv") formReceive(Number(t.dataset.id));
      else if (act === "freeze") {
        const lot = byId(D.inventory, Number(t.dataset.id));
        lot.frozen = lot.frozen ? 0 : 1;
        gspPush("在库养护", lot.batchNo, lot.productId, lot.batchNo, lot.qty, lot.frozen ? "人工冻结" : "解除冻结");
        audit(lot.frozen ? "批次冻结" : "批次解冻", lot.batchNo, product(lot.productId).name);
        persist(); toast(lot.frozen ? "已冻结，不可销售" : "已解冻"); render();
      } else if (act === "ww-wait") {
        const w = byId(D.outsource, Number(t.dataset.id));
        w.status = "待放行";
        audit("委外完工", w.no, "待检验放行");
        persist(); toast("已完工，待放行"); render();
      } else if (act === "ww-release") {
        const w = byId(D.outsource, Number(t.dataset.id));
        const lot = inboundLot(w.productId, 1, w.qty, w.no, true);
        w.status = "已入库";
        D.quality.unshift({
          id: nextId(D.quality), no: seqNo("QC-202608-", D.quality, "no"), poId: 0,
          productId: w.productId, batchNo: lot.batchNo, qtyOk: w.qty, qtyNg: 0,
          result: "合格", inspector: currentRole().name, date: TODAY, remark: "委外成品放行",
        });
        gspPush("购进验收", w.no, w.productId, lot.batchNo, w.qty, "委外放行入库");
        audit("委外放行", w.no, product(w.productId).name + " × " + w.qty);
        persist(); toast("已放行入库，批次 " + lot.batchNo); render();
      } else if (act === "match") matchPayment(Number(t.dataset.id));
      else if (act === "auto-match") autoReconcile();
      else if (act === "issue-inv") issueSalesInvoice(Number(t.dataset.id));
      else if (act === "resolve") {
        const r = byId(D.reconciliations, Number(t.dataset.id));
        r.status = "匹配成功";
        r.remark += "（人工确认）";
        byId(D.payments, r.paymentId).status = "已核销";
        const ar = byId(D.receivables, r.receivableId);
        const matched = D.reconciliations.filter((x) => x.receivableId === ar.id && x.status === "匹配成功").reduce((s, x) => s + x.amount, 0);
        ar.status = matched >= ar.amount - 0.01 ? "已回款" : "部分回款";
        audit("人工核销", r.id, r.remark);
        persist(); toast("差异已人工核销"); render();
      } else if (act === "assign") {
        const l = byId(D.leads, Number(t.dataset.id));
        applyOwnerName(l, defaultOwnerName());
        l.status = "已联系";
        writeLeadProgress(l);
        audit("领取线索", l.name, leadOwner(l));
        persist(); render(); toast("已领取，状态：已联系"); openLead(l.id);
      } else if (act === "lead-valid") {
        const l = byId(D.leads, Number(t.dataset.id));
        if (l.status !== "已联系") { toast("先联系后再标为有效"); return; }
        l.status = "有效";
        writeLeadProgress(l);
        audit("线索有效", l.name, leadOwner(l));
        persist(); render(); toast("已标为有效"); openLead(l.id);
      } else if (act === "assign-rr") {
        const pool = D.leads.filter((l) => l.status === "待跟进");
        pool.forEach((l, i) => { applyOwnerName(l, D.sales[i % D.sales.length].name); l.status = "已联系"; writeLeadProgress(l); });
        audit("轮询分配", "线索池", pool.length + " 条");
        persist(); toast("已按销售轮询分配 " + pool.length + " 条"); render();
      } else if (act === "to-opp") {
        const l = byId(D.leads, Number(t.dataset.id));
        if (l.status === "无效") { toast("无效线索不能转商机"); return; }
        if (!l.assignedTo) {
          applyOwnerName(l, leadOwner(l) || defaultOwnerName());
        }
        let opp = D.opportunities.find((o) => o.leadId === l.id);
        if (!opp) {
          opp = {
            id: nextId(D.opportunities), oppNo: seqNo("OPP-", D.opportunities, "oppNo"), leadId: l.id, customerId: null,
            name: (l.company || l.name || "Personal") + " · " + (leadProduct(l)?.sku || l.interest || "Opp"), stage: "需求确认",
            amount: l.potential || 0,
            expected: "2026-09-20", ownerId: l.assignedTo, winReason: "", lossReason: "",
          };
          D.opportunities.unshift(opp);
        }
        l.status = "已转商机"; l.convertedAt = l.convertedAt || nowStr(); l.opportunityId = opp.id;
        if (!l.potential) l.potential = opp.amount;
        writeLeadProgress(l);
        audit("线索转商机", opp.name, l.name);
        persist(); toast("已转商机，进展：" + l.progress); setRoute("opps"); showOpp(opp.id);
      } else if (act === "lead-invalid") {
        const l = byId(D.leads, Number(t.dataset.id));
        if (leadOrders(l).length) { toast("已有成交订单，不能标无效"); return; }
        if (leadOpp(l)) { toast("已转商机，请在商机里丢单"); return; }
        const reason = prompt("关闭原因（如：无预算 / 竞品成交 / 联系不上）");
        if (!reason) return;
        l.status = "无效";
        l.closeReason = reason;
        writeLeadProgress(l);
        audit("线索无效", l.name, reason);
        persist(); closeDrawer(); render();
      } else if (act === "opp-next") {
        const o = byId(D.opportunities, Number(t.dataset.id));
        const stages = ["需求确认", "方案报价", "商务谈判"];
        const i = stages.indexOf(o.stage);
        if (i < 0 || i >= stages.length - 1) { toast("成交请用「成交并生成销售订单」"); return; }
        o.stage = stages[i + 1];
        writeLeadProgress(D.leads.find((l) => l.id === o.leadId));
        audit("推进商机", o.name, o.stage);
        persist(); render(); toast("进展：" + o.stage); showOpp(o.id);
      } else if (act === "opp-lose") {
        const reason = prompt("请填写丢单原因");
        if (!reason) return;
        const o = byId(D.opportunities, Number(t.dataset.id));
        o.stage = "丢单"; o.lossReason = reason;
        writeLeadProgress(D.leads.find((l) => l.id === o.leadId));
        audit("商机丢单", o.name, reason);
        persist(); closeDrawer(); render();
      } else if (act === "import-bank") {
        const open = D.receivables
          .filter((r) => r.status !== "已回款")
          .map((r) => ({ r, remain: arRemainOf(r) }))
          .filter((x) => x.remain > 0.01);
        if (!open.length) { toast("没有未清应收，未导入"); return; }
        open.forEach(({ r, remain }) => {
          D.payments.unshift({
            id: nextId(D.payments), no: seqNo("PAY-202608-", D.payments, "no"),
            customerId: r.customerId, amount: remain, date: TODAY, method: "银行转账",
            account: "****BANK-IMP", status: "待核销",
          });
        });
        audit("导入银行流水", open.length + " 笔", "金额取自未清应收余额");
        persist(); toast("已导入 " + open.length + " 笔银行流水"); setRoute("fin-ar", false);
      } else if (act === "ap-pay") {
        const p = byId(D.payables, Number(t.dataset.id));
        p.status = "已付款"; p.paidDate = TODAY; if (!p.invoiceNo) p.invoiceNo = "FP-DEMO-" + p.id;
        ensureVoucher("支付采购货款 " + p.no, "应付账款", "银行存款", p.amount, p.no + "-pay");
        audit("采购付款", p.no, money2(p.amount));
        persist(); toast("已付款"); render();
      } else if (act === "ap-inv") {
        const p = byId(D.payables, Number(t.dataset.id));
        p.invoiceNo = "FP-" + TODAY.replace(/-/g, "") + p.id;
        p.status = "待付款";
        audit("登记发票", p.no, p.invoiceNo);
        persist(); toast("发票已登记"); render();
      } else if (act === "safety-po") {
        const needs = purchaseNeedList().filter((x) => x.qty > 0);
        if (!needs.length) { toast("按公式计算，当前无需采购"); return; }
        confirmAsk(`将按采购需求为 ${needs.length} 个 SKU 生成采购单。`).then((ok) => {
          if (!ok) return;
          const pos = generateDemandPOs(needs.map((x) => x.product.id));
          persist();
          toast(pos.length ? `已生成 ${pos.length} 张采购单` : "在途采购已覆盖，未新建单据");
          setRoute("pos");
        });
      }
    });

    document.addEventListener("change", (e) => {
      if (e.target.dataset.act === "filter") {
        state.filters[e.target.dataset.k] = e.target.value;
        state.page = 1;
        render();
      } else if (e.target.dataset.act === "acquire-type") {
        const sc = e.target.form?.querySelector("select[name='salesChannel']");
        if (sc) sc.value = e.target.value === "线上投放" ? "电商" : "线下经销商";
      } else if (e.target.dataset.act === "lead-cat") {
        const box = e.target.form?.querySelector("select[name='productId']");
        if (box) box.innerHTML = leadInterestOpts(e.target.value);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.dataset.act === "q") {
        state.filters.q = e.target.value.trim();
        state.page = 1;
        render();
      }
      if (e.key === "Enter" && !e.shiftKey && e.target.id === "aiInput") {
        e.preventDefault();
        e.target.form?.requestSubmit();
      }
    });
    document.addEventListener("input", (e) => {
      if (e.target.dataset.act === "q") state.filters.q = e.target.value.trim();
    });

    $("#globalSearch").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const q = e.target.value.trim();
      if (!q) return;
      const so = D.salesOrders.find((o) => o.orderNo.toLowerCase().includes(q.toLowerCase()));
      if (so) { setRoute(orderHome()); showOrder(so.id); return; }
      const p = D.products.find((x) => x.sku.toLowerCase().includes(q.toLowerCase()) || x.name.includes(q));
      if (p) { state.filters = { q: p.sku }; setRoute("products", false); render(); return; }
      const c = D.customers.find((x) => x.name.includes(q));
      if (c) { state.filters = { q: c.name }; setRoute(orderHome(), false); render(); return; }
      const lot = D.inventory.find((x) => x.batchNo.toLowerCase().includes(q.toLowerCase()));
      if (lot) { state.filters = { q: lot.batchNo }; setRoute("inventory", false); render(); return; }
      toast("未找到匹配的订单 / SKU / 客户 / 批次");
    });
  }

  function bindLogin() {
    const gate = $("#loginGate");
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && D.roles.some((r) => r.id === saved)) {
      state.role = saved;
      if (gate) gate.hidden = true;
    }
    $("#loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const user = String(fd.get("user") || "").trim().toLowerCase();
      const pass = String(fd.get("pass") || "");
      const role = ACCOUNTS[user];
      if (!role || pass !== "123456") { toast("账号或密码错误（演示密码 123456）"); return; }
      sessionStorage.setItem(SESSION_KEY, role);
      state.role = role;
      if (gate) gate.hidden = true;
      audit("登录", currentRole().title, user);
      persist();
      toast("欢迎，" + currentRole().name);
      setRoute(can(state.route) ? state.route : currentRole().modules[0]);
    });
    $("#logoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      if (gate) gate.hidden = false;
      toast("已退出登录");
    });
  }

  initNav();
  bind();
  bindLogin();
  refreshRoleUi();
  const initial = resolveRoute(location.hash.slice(1));
  state.route = VIEWS[initial] ? initial : "dashboard";
  if (!location.hash) location.hash = "dashboard";
  else if (location.hash.slice(1) !== state.route && VIEWS[state.route]) location.hash = state.route;
  render();
})();
