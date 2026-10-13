/**
 * 总经办 AI 工作台：只从当前系统数据作答，不编造数字。
 */
window.ForvetAsk = (query, api) => {
  const { D, TODAY, money, money2, pct, esc } = api;
  const byId = (arr, id) => (arr || []).find((x) => x.id === Number(id));
  const product = (id) => byId(D.products, id);
  const customer = (id) => byId(D.customers, id);
  const warehouse = (id) => byId(D.warehouses, id);
  const supplier = (id) => byId(D.suppliers, id);
  const seller = (id) => byId(D.sales, id);
  const avail = (row) => (row.frozen ? 0 : Number(row.qty) - Number(row.lockQty));
  const daysTo = (dateStr) => Math.ceil((new Date(dateStr + "T00:00:00") - new Date(TODAY + "T00:00:00")) / 86400000);
  const orderLines = (o) => (o.lines && o.lines.length ? o.lines : [{ productId: o.productId, qty: o.qty, unitPrice: o.unitPrice, discount: o.discount || 0, amount: o.amount }]);
  const lineSummary = (o) => {
    const lines = orderLines(o);
    if (!lines.length) return "—";
    return lines.map((l) => {
      const p = product(l.productId);
      return p ? `${p.sku} ×${l.qty}` : "—";
    }).join("；");
  };
  const arPaid = (ar) => (D.reconciliations || []).filter((x) => x.receivableId === ar.id && x.status === "匹配成功").reduce((s, x) => s + x.amount, 0);
  const arRemain = (ar) => +(ar.amount - arPaid(ar)).toFixed(2);
  const sellable = (pid) => (D.inventory || []).filter((i) => i.productId === pid && !i.frozen && daysTo(i.expiryDate) >= 0).reduce((s, i) => s + Number(i.qty || 0), 0);
  const inboundOpen = (pid) => (D.purchaseOrders || []).filter((p) => ["待审核", "待发货", "已发货", "部分入库"].includes(p.status)).reduce((s, p) => {
    const lines = p.lines && p.lines.length ? p.lines : [{ productId: p.productId, qty: p.qty, receivedQty: p.receivedQty || 0 }];
    return s + lines.filter((l) => l.productId === pid).reduce((a, l) => a + Math.max(0, l.qty - (l.receivedQty || 0)), 0);
  }, 0);
  const salesDemand = (pid) => (D.salesOrders || []).filter((o) => ["待审核", "审核通过", "已分仓", "出库中"].includes(o.status)).reduce((s, o) => {
    return s + orderLines(o).filter((l) => l.productId === pid).reduce((a, l) => a + l.qty, 0);
  }, 0);
  const needOf = (pid) => {
    const p = product(pid);
    const sales = salesDemand(pid);
    const safety = Number(p?.safety || 0);
    const available = sellable(pid);
    const inbound = inboundOpen(pid);
    return { sales, safety, available, inbound, qty: Math.max(0, sales + safety - available - inbound) };
  };

  const q = String(query || "").trim();
  const ql = q.toLowerCase();
  const qu = q.toUpperCase();

  const soBtn = (o) => `<button type="button" class="linkish" data-act="order" data-id="${o.id}">${esc(o.orderNo)}</button>`;
  const poBtn = (po) => `<button type="button" class="linkish" data-act="po" data-id="${po.id}">${esc(po.poNo)}</button>`;
  const go = (route, label, extra) => `<button type="button" class="linkish" data-act="go" data-route="${route}"${extra || ""}>${esc(label)}</button>`;
  const pBtn = (p) => `<button type="button" class="linkish" data-act="product" data-id="${p.id}">${esc(p.sku)}</button>`;
  const leadBtn = (l) => `<button type="button" class="linkish" data-act="lead" data-id="${l.id}">${esc(l.leadNo || l.name)}</button>`;
  const oppBtn = (o) => `<button type="button" class="linkish" data-act="opp" data-id="${o.id}">${esc(o.oppNo || o.name)}</button>`;
  const h3 = (t) => `<h4 class="ai-h">${esc(t)}</h4>`;
  const p = (t) => `<p class="ai-p">${t}</p>`;
  const rows = (head, body) => `<div class="table-wrap"><table class="data"><thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  const lim = (arr, n) => arr.length <= n ? arr : arr.slice(0, n);

  const STOP = /订单|库存|客户|销售|采购|应收|回款|线索|商机|出库|发票|凭证|审计|多少|什么|哪些|怎么|为什么|本月|全部|查询|看看|一下|情况|汇总|总览|数据|系统|信息|的|和|与|及|了|吗|呢|请|帮我|给我/;

  const matchNo = (no, raw) => {
    const n = String(no || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const r = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!r || r.length < 4) return false;
    if (n === r) return true;
    const nd = n.replace(/^[A-Z]+/, "");
    const rd = r.replace(/^[A-Z]+/, "");
    if (!rd) return false;
    if (rd.length <= 3) return nd.slice(-3) === rd.padStart(3, "0");
    return nd === rd || nd.endsWith(rd);
  };
  const pickOrders = () => {
    const tokens = q.match(/SO[- ]?[\d-]+/gi) || [];
    return D.salesOrders.filter((o) => tokens.some((t) => matchNo(o.orderNo, t)));
  };
  const pickByNo = (list, field, re) => {
    const tokens = q.match(re) || [];
    if (!tokens.length) return [];
    return list.filter((x) => tokens.some((t) => matchNo(x[field], t)));
  };

  const ordersHit = pickOrders();
  const posHit = pickByNo(D.purchaseOrders, "poNo", /PO[- ]?[\d-]+/gi);
  const rpHit = pickByNo(D.replenishments || [], "no", /RP[- ]?[\d-]+/gi);
  const outHit = pickByNo(D.outbound, "outboundNo", /OUT[- ]?[\d-]+/gi);
  const arHit = pickByNo(D.receivables, "no", /AR[- ]?[\d-]+/gi);
  const payHit = pickByNo(D.payments, "no", /PAY[- ]?[\d-]+/gi);
  const apHit = pickByNo(D.payables, "no", /AP[- ]?[\d-]+/gi);
  const invHit = pickByNo(D.invoices || [], "no", /FP[- ]?[\d-]+/gi);
  const qcHit = pickByNo(D.quality || [], "no", /QC[- ]?[\d-]+/gi);
  const wwHit = pickByNo(D.outsource || [], "no", /WW[- ]?[\d-]+/gi);
  const skuHit = (q.match(/FW-[A-Z0-9]+-\d+/gi) || []).map((s) => D.products.find((p) => p.sku.toUpperCase() === s.toUpperCase())).filter(Boolean);
  const lotHit = (q.match(/B\d{6}[A-Z]/gi) || []).flatMap((b) => D.inventory.filter((i) => i.batchNo.toUpperCase() === b.toUpperCase()));

  const custHit = D.customers.filter((c) => c.name && q.includes(c.name));
  const suppHit = D.suppliers.filter((s) => s.name && q.includes(s.name));
  const leadHit = D.leads.filter((l) => (l.name && q.includes(l.name)) || (l.leadNo && qu.includes(l.leadNo)) || (l.company && l.company !== "Personal" && q.includes(l.company)));
  const oppHit = D.opportunities.filter((o) => o.name && q.includes(o.name));
  const prodNameHit = skuHit.length ? skuHit : D.products.filter((p) => {
    if (!p.name || p.name.length < 2) return false;
    if (STOP.test(p.name) && p.name.length < 5) return false;
    return q.includes(p.name) || ql.includes(p.sku.toLowerCase());
  });

  const has = (re) => re.test(q);
  const intents = [];
  if (has(/总览|概况|经营|驾驶舱|汇总|全貌|整体/)) intents.push("overview");
  if (has(/销售额|销售收入|有效订单金额|本月销售|卖了多少|营收/)) intents.push("sales");
  if (has(/应收|回款|核销|未清应收|对账|收款/)) intents.push("ar");
  if (has(/应付|采购款|未清应付/)) intents.push("ap");
  if (has(/发票|开票/)) intents.push("invoice");
  if (has(/缺货|反查|补货单|订单行/)) intents.push("shortage");
  if (has(/临期|近效期|过期/)) intents.push("near");
  if (has(/库存|可用|在库|安全库存|库存流水/)) intents.push("stock");
  if (has(/采购需求|要补货|补货/)) intents.push("demand");
  if (has(/采购单|在途采购|待收货/)) intents.push("po");
  if (has(/出库|待发货|发货/)) intents.push("outbound");
  if (has(/待审核|待审/)) intents.push("pending");
  if (has(/线索|获客|转化/)) intents.push("leads");
  if (has(/商机|成交率|丢单/)) intents.push("opps");
  if (has(/客户档案|客户列表|有哪些客户/)) intents.push("customers");
  if (has(/帮助|怎么用|能问什么|你可以/)) intents.push("help");

  const formatOrder = (o) => {
    const c = customer(o.customerId);
    const obs = D.outbound.filter((x) => x.orderId === o.id);
    const ar = D.receivables.find((r) => r.orderId === o.id);
    const inv = (D.invoices || []).find((i) => i.orderId === o.id);
    const lines = orderLines(o);
    const pays = ar ? D.reconciliations.filter((r) => r.receivableId === ar.id).map((r) => byId(D.payments, r.paymentId)).filter(Boolean) : [];
    const lineHtml = lines.map((l) => {
      const pr = product(l.productId);
      const rp = (D.replenishments || []).find((r) => r.orderId === o.id && (r.lineId === l.id || r.lineNo === l.lineNo));
      return `<tr><td class="num">${esc(l.lineNo || "")}</td><td>${pr ? pBtn(pr) : "—"}</td><td>${esc(pr?.name || "")}</td><td class="num">${l.qty}</td><td class="num">${money(l.unitPrice)}</td><td class="num">${money(l.amount)}</td><td>${rp ? esc(rp.no) + " 缺 " + rp.shortageQty : "—"}</td></tr>`;
    }).join("");
    const obHtml = obs.length
      ? obs.map((x) => `${esc(x.outboundNo)} ${esc(x.status)} ${x.qty}件 ${esc(x.batchNo || "")} ${esc(x.date || "")}`).join("<br>")
      : "尚未生成";
    let arHtml = "出库后生成";
    if (ar) arHtml = `${go("fin-ar", ar.no)} ${esc(ar.status)} ${money2(ar.amount)}，已核 ${money2(arPaid(ar))}，剩余 ${money2(arRemain(ar))}`;
    return `<div class="ai-block">${h3(o.orderNo)}
      ${p(`${soBtn(o)} · ${esc(o.channel)} · ${esc(o.status)}${o.shortage ? " · 缺货" : ""} · ${esc(o.source)} · ${esc(o.createdAt || "")}`)}
      ${p(`客户 ${esc(c?.name || "—")} · 金额 ${money(o.amount)} · 件数 ${o.qty} · ${esc(lineSummary(o))}`)}
      ${rows(["订单行", "SKU", "商品", "数量", "单价", "金额", "补货"], lineHtml)}
      ${p(`出库：${obHtml}`)}
      ${p(`应收：${arHtml}`)}
      ${p(`回款：${pays.length ? pays.map((x) => `${esc(x.no)} ${money2(x.amount)} ${esc(x.status)}`).join("；") : "无"}`)}
      ${p(`发票：${inv ? `${esc(inv.no)} ${esc(inv.status)} ${money2(inv.amount)}` : "未开具"}`)}
    </div>`;
  };

  const formatProduct = (pr) => {
    const lots = D.inventory.filter((i) => i.productId === pr.id);
    const need = needOf(pr.id);
    const sos = D.salesOrders.filter((o) => !["已取消", "已驳回"].includes(o.status) && orderLines(o).some((l) => l.productId === pr.id));
    const lotRows = lots.map((i) => `<tr><td>${esc(warehouse(i.warehouseId)?.name || "")}</td><td class="num">${esc(i.batchNo)}</td><td class="num">${esc(i.expiryDate)}</td><td class="num">${i.qty}</td><td class="num">${i.lockQty}</td><td class="num">${avail(i)}</td><td>${i.frozen ? "冻结" : daysTo(i.expiryDate) < 0 ? "过期" : daysTo(i.expiryDate) <= 30 ? "临期" : "正常"}</td></tr>`).join("");
    return `<div class="ai-block">${h3(pr.sku + " " + pr.name)}
      ${p(`${pBtn(pr)} · ${esc(pr.spec)} · ${esc(pr.category)} · 目录价 ${money(pr.price)} · 成本 ${money(pr.cost)} · 安全库存 ${pr.safety}`)}
      ${p(`采购需求 ${need.qty}（销售需求 ${need.sales} + 安全 ${need.safety} − 可用 ${need.available} − 未到货 ${need.inbound}）`)}
      ${lots.length ? rows(["仓库", "批次", "效期", "在库", "锁定", "可用", "状态"], lotRows) : p("无库存批次")}
      ${sos.length ? p("相关订单：" + lim(sos, 8).map(soBtn).join("、") + (sos.length > 8 ? " …" : "")) : ""}
    </div>`;
  };

  const formatCustomer = (c) => {
    const sos = D.salesOrders.filter((o) => o.customerId === c.id);
    const ars = D.receivables.filter((r) => r.customerId === c.id);
    const pays = D.payments.filter((x) => x.customerId === c.id);
    const open = ars.reduce((s, r) => s + arRemain(r), 0);
    const soAmt = sos.filter((o) => !["已取消", "已驳回"].includes(o.status)).reduce((s, o) => s + o.amount, 0);
    return `<div class="ai-block">${h3(c.name)}
      ${p(`${esc(c.type)} · ${esc(c.region)} · 价目 ${esc(c.priceLevel || "")} · 账期 ${c.creditDays} 天 · 信用额度 ${money(c.creditLimit)} · 归属 ${esc(c.owner)}`)}
      ${p(`有效订单 ${sos.filter((o) => !["已取消", "已驳回"].includes(o.status)).length} 笔 / ${money(soAmt)} · 未清应收 ${money2(open)}`)}
      ${sos.length ? rows(["订单", "状态", "金额", "日期"], lim(sos, 12).map((o) => `<tr><td>${soBtn(o)}</td><td>${esc(o.status)}</td><td class="num">${money(o.amount)}</td><td class="num">${esc((o.createdAt || "").slice(0, 10))}</td></tr>`).join("")) : p("无订单")}
      ${ars.length ? p("应收：" + ars.map((r) => `${esc(r.no)} ${esc(r.status)} ${money2(r.amount)} 剩余 ${money2(arRemain(r))}`).join("；")) : p("无应收（未出库则不形成应收）")}
      ${pays.length ? p("回款：" + pays.map((x) => `${esc(x.no)} ${money2(x.amount)} ${esc(x.status)} ${esc(x.date)}`).join("；")) : ""}
    </div>`;
  };

  const formatPO = (po) => {
    const lines = po.lines && po.lines.length ? po.lines : [{ productId: po.productId, qty: po.qty, unitPrice: po.unitPrice, receivedQty: po.receivedQty || 0 }];
    const ap = D.payables.find((x) => x.poId === po.id);
    const lineHtml = lines.map((l) => {
      const pr = product(l.productId);
      const rp = (D.replenishments || []).find((r) => r.id === l.replenishmentId || (r.poId === po.id && r.productId === l.productId));
      const so = rp ? byId(D.salesOrders, rp.orderId) : null;
      const opp = so && so.source === "CRM成交" ? byId(D.opportunities, so.sourceId) : null;
      const lead = opp ? D.leads.find((x) => x.id === opp.leadId) : null;
      return `<tr><td>${pr ? pBtn(pr) : "—"}</td><td>${esc(pr?.name || "")}</td><td class="num">${l.qty}</td><td class="num">${l.receivedQty || 0}</td><td class="num">${money(l.unitPrice)}</td><td>${rp ? esc(rp.no) : "—"}</td><td>${rp ? esc(rp.lineNo) + " 缺 " + rp.shortageQty : "—"}</td></tr>`
        + (rp ? `<tr><td colspan="7" class="tiny">反查 ${so ? soBtn(so) : ""} ${esc(customer(so?.customerId)?.name || "")} ${opp ? oppBtn(opp) : ""} ${lead ? leadBtn(lead) : ""}</td></tr>` : "");
    }).join("");
    return `<div class="ai-block">${h3(po.poNo)}
      ${p(`${poBtn(po)} · ${esc(supplier(po.supplierId)?.name || "")} · ${esc(po.status)} · ${esc(po.orderDate || "")} · 来源 ${esc(po.source || "手工")}`)}
      ${rows(["SKU", "商品", "订购", "已收", "单价", "补货单", "订单行"], lineHtml)}
      ${p(`应付：${ap ? `${esc(ap.no)} ${esc(ap.status)} ${money2(ap.amount)}` : "入库后形成"}`)}
    </div>`;
  };

  const formatOutbound = (ob) => {
    const o = byId(D.salesOrders, ob.orderId);
    const pr = product(ob.productId);
    return `<div class="ai-block">${h3(ob.outboundNo)}
      ${p(`${esc(ob.outboundNo)} · ${esc(ob.status)} · ${esc(warehouse(ob.warehouseId)?.name || "")} · ${pr ? pBtn(pr) : ""} ${esc(pr?.name || "")} × ${ob.qty} · 批次 ${esc(ob.batchNo)} · ${esc(ob.date || "")}`)}
      ${p(`订单：${o ? soBtn(o) + " " + esc(o.status) + " " + money(o.amount) : "—"}`)}
      ${ob.logistics ? p(`物流 ${esc(ob.logistics)} ${esc(ob.tracking || "")}`) : ""}
    </div>`;
  };

  const formatAR = (ar) => {
    const o = byId(D.salesOrders, ar.orderId);
    const recs = D.reconciliations.filter((r) => r.receivableId === ar.id);
    return `<div class="ai-block">${h3(ar.no)}
      ${p(`${go("fin-ar", ar.no)} · ${esc(customer(ar.customerId)?.name || "")} · ${esc(ar.status)} · ${money2(ar.amount)} · 到期 ${esc(ar.dueDate || "")}`)}
      ${p(`订单 ${o ? soBtn(o) : "—"} · 已核 ${money2(arPaid(ar))} · 剩余 ${money2(arRemain(ar))}`)}
      ${recs.length ? p("核销：" + recs.map((r) => `${esc(r.status)} ${money2(r.amount)} ${esc(r.remark || "")}`).join("；")) : p("无核销")}
    </div>`;
  };

  const overviewHtml = () => {
    const active = D.salesOrders.filter((o) => !["已取消", "已驳回"].includes(o.status));
    const salesAmt = active.reduce((s, o) => s + o.amount, 0);
    const arAmt = D.receivables.reduce((s, r) => s + r.amount, 0);
    const paid = D.reconciliations.filter((r) => r.status === "匹配成功").reduce((s, r) => s + r.amount, 0);
    const arOpen = D.receivables.reduce((s, r) => s + arRemain(r), 0);
    const apOpen = (D.payables || []).filter((x) => x.status !== "已付款").reduce((s, x) => s + x.amount, 0);
    const pendingSo = D.salesOrders.filter((o) => o.status === "待审核").length;
    const shortage = D.salesOrders.filter((o) => o.shortage).length;
    const pendingOb = D.outbound.filter((o) => o.status === "待出库").length;
    const leads = D.leads.length;
    const converted = D.leads.filter((l) => l.status === "已转商机").length;
    const won = D.opportunities.filter((o) => o.stage === "成交").length;
    return `<div class="ai-block">${h3("系统现况（均来自当前单据）")}
      ${p(`基准日 ${esc(TODAY)} · 有效订单 ${active.length} 笔 / ${money(salesAmt)}`)}
      ${p(`应收 ${money(arAmt)} · 已核销 ${money(paid)} · 未清应收 ${money(arOpen)} · 未清应付 ${money(apOpen)}`)}
      ${p(`待审核订单 ${pendingSo} · 缺货订单 ${shortage} · 待出库 ${pendingOb}`)}
      ${p(`线索 ${leads}（已转商机 ${converted}） · 商机 ${D.opportunities.length}（成交 ${won}） · 在售 SKU ${D.products.filter((x) => x.status === 1).length}`)}
      ${p(`${go("dashboard", "打开驾驶舱")} · ${go("reports", "打开业务报表")} · ${go("orders", "打开订单")}`)}
    </div>`;
  };

  const salesHtml = (custs) => {
    let list = D.salesOrders.filter((o) => !["已取消", "已驳回"].includes(o.status));
    if (custs.length) list = list.filter((o) => custs.some((c) => c.id === o.customerId));
    const amt = list.reduce((s, o) => s + o.amount, 0);
    const byCh = {};
    list.forEach((o) => { byCh[o.channel] = (byCh[o.channel] || 0) + o.amount; });
    return `<div class="ai-block">${h3("销售额")}
      ${p(`有效订单 ${list.length} 笔，合计 ${money(amt)}（已取消 / 已驳回不计）`)}
      ${p(Object.entries(byCh).map(([k, v]) => `${esc(k)} ${money(v)}`).join(" · ") || "—")}
      ${rows(["订单", "客户", "状态", "金额"], lim(list, 12).map((o) => `<tr><td>${soBtn(o)}</td><td>${esc(customer(o.customerId)?.name || "")}</td><td>${esc(o.status)}</td><td class="num">${money(o.amount)}</td></tr>`).join(""))}
    </div>`;
  };

  const arHtml = (custs) => {
    let list = D.receivables.slice();
    if (custs.length) list = list.filter((r) => custs.some((c) => c.id === r.customerId));
    const total = list.reduce((s, r) => s + r.amount, 0);
    const open = list.reduce((s, r) => s + arRemain(r), 0);
    const paid = total - open;
    return `<div class="ai-block">${h3("应收管理")}
      ${p(`出库形成收款 ${list.length} 笔 / ${money2(total)} · 已收 ${money2(paid)} · 待收 ${money2(open)}`)}
      ${rows(["销售订单", "客户", "状态", "金额", "剩余"], lim(list, 15).map((r) => {
        const so = byId(D.salesOrders, r.orderId);
        return `<tr><td>${so ? soBtn(so) : go("fin-ar", r.no)}</td><td>${esc(customer(r.customerId)?.name || "")}</td><td>${esc(r.status)}</td><td class="num">${money2(r.amount)}</td><td class="num">${money2(arRemain(r))}</td></tr>`;
      }).join(""))}
      ${p(go("fin-ar", "打开应收管理"))}
    </div>`;
  };

  const stockHtml = (prods) => {
    const targets = prods.length ? prods : [];
    if (targets.length) return targets.map(formatProduct).join("");
    const oos = D.products.filter((p) => p.status === 1 && sellable(p.id) <= 0);
    const low = D.products.filter((p) => p.status === 1 && sellable(p.id) > 0 && sellable(p.id) < p.safety);
    const near = D.inventory.filter((i) => daysTo(i.expiryDate) <= 30 && daysTo(i.expiryDate) >= 0 && avail(i) > 0);
    return `<div class="ai-block">${h3("库存")}
      ${p(`缺货 SKU ${oos.length} · 低于安全库存 ${low.length} · 临期批次 ${near.length}`)}
      ${oos.length ? p("缺货：" + lim(oos, 10).map(pBtn).join("、")) : ""}
      ${low.length ? p("低库存：" + lim(low, 10).map((x) => `${pBtn(x)} 可用${sellable(x.id)}/${x.safety}`).join("、")) : ""}
      ${near.length ? p("临期：" + lim(near, 8).map((i) => `${esc(i.batchNo)} ${esc(product(i.productId)?.sku || "")} ${daysTo(i.expiryDate)}天`).join("；")) : ""}
      ${p(go("inventory", "打开库存"))}
    </div>`;
  };

  const parts = [];
  const docAny = ordersHit.length + posHit.length + rpHit.length + outHit.length + arHit.length + payHit.length + apHit.length + invHit.length + qcHit.length + wwHit.length + lotHit.length;

  if (ordersHit.length) parts.push(ordersHit.map(formatOrder).join(""));
  if (posHit.length) parts.push(posHit.map(formatPO).join(""));
  if (rpHit.length) {
    const rpPos = rpHit.map((r) => byId(D.purchaseOrders, r.poId)).filter(Boolean);
    const extra = rpPos.filter((p) => !posHit.includes(p));
    if (extra.length) parts.push(extra.map(formatPO).join(""));
  }
  if (outHit.length) parts.push(outHit.map(formatOutbound).join(""));
  if (arHit.length) parts.push(arHit.map(formatAR).join(""));
  if (payHit.length) {
    parts.push(payHit.map((x) => {
      const recs = D.reconciliations.filter((r) => r.paymentId === x.id);
      return `<div class="ai-block">${h3(x.no)}${p(`${go("fin-ar", x.no)} · ${esc(customer(x.customerId)?.name || "")} · ${money2(x.amount)} · ${esc(x.method)} · ${esc(x.date)} · ${esc(x.status)}`)}${p("核销：" + (recs.map((r) => `${esc(byId(D.receivables, r.receivableId)?.no || "")} ${money2(r.amount)} ${esc(r.status)}`).join("；") || "无"))}</div>`;
    }).join(""));
  }
  if (apHit.length) {
    parts.push(apHit.map((x) => {
      const po = byId(D.purchaseOrders, x.poId);
      return `<div class="ai-block">${h3(x.no)}${p(`${go("fin-ap", x.no)} · ${esc(supplier(x.supplierId)?.name || "")} · ${money2(x.amount)} · ${esc(x.status)} · 到期 ${esc(x.dueDate || "")}`)}${p(`采购 ${po ? poBtn(po) : "—"}`)}</div>`;
    }).join(""));
  }
  if (invHit.length) {
    parts.push(invHit.map((x) => {
      const o = byId(D.salesOrders, x.orderId);
      return `<div class="ai-block">${h3(x.no)}${p(`${go("fin-ar", x.no)} · ${esc(customer(x.customerId)?.name || "")} · ${money2(x.amount)} · ${esc(x.status)} · ${esc(x.date)}`)}${p(`订单 ${o ? soBtn(o) : "—"}`)}</div>`;
    }).join(""));
  }
  if (qcHit.length) {
    parts.push(qcHit.map((x) => `<div class="ai-block">${h3(x.no)}${p(`商品 ${esc(product(x.productId)?.sku || "")} 批次 ${esc(x.batchNo)} 合格 ${x.qtyOk} 不合格 ${x.qtyNg} · ${esc(x.result)} · ${esc(x.inspector)} ${esc(x.date)}`)}${p(esc(x.remark || ""))}</div>`).join(""));
  }
  if (wwHit.length) {
    parts.push(wwHit.map((x) => `<div class="ai-block">${h3(x.no)}${p(`${esc(x.factory)} · ${esc(product(x.productId)?.name || "")} × ${x.qty} · ${esc(x.planDate)} · ${esc(x.status)}`)}${p(esc(x.remark || ""))}</div>`).join(""));
  }
  if (lotHit.length) {
    parts.push(lotHit.map((i) => {
      const pr = product(i.productId);
      return `<div class="ai-block">${h3(i.batchNo)}${p(`${pr ? pBtn(pr) : ""} ${esc(pr?.name || "")} · ${esc(warehouse(i.warehouseId)?.name || "")} · 在库 ${i.qty} 锁定 ${i.lockQty} 可用 ${avail(i)} · 效期 ${esc(i.expiryDate)}（${daysTo(i.expiryDate)}天）`)}</div>`;
    }).join(""));
  }
  if (skuHit.length || (prodNameHit.length && prodNameHit.length <= 6 && docAny === 0 && !intents.length)) {
    parts.push(prodNameHit.map(formatProduct).join(""));
  }
  if (custHit.length && docAny === 0) parts.push(custHit.map(formatCustomer).join(""));
  if (suppHit.length && docAny === 0) {
    parts.push(suppHit.map((s) => {
      const pos = D.purchaseOrders.filter((p) => p.supplierId === s.id);
      return `<div class="ai-block">${h3(s.name)}${p(`联系人 ${esc(s.contact)} · ${esc(s.status)}`)}${pos.length ? p("采购：" + pos.map((p) => `${poBtn(p)} ${esc(p.status)}`).join("、")) : p("无采购单")}</div>`;
    }).join(""));
  }
  if (leadHit.length && docAny === 0) {
    parts.push(leadHit.map((l) => {
      const opp = D.opportunities.find((o) => o.id === l.opportunityId || o.leadId === l.id);
      return `<div class="ai-block">${h3(l.name)}${p(`${leadBtn(l)} · ${esc(l.company)} · ${esc(l.source || "—")} · ${esc(l.interest || "")} · ${esc(l.status)}`)}${opp ? p("商机 " + oppBtn(opp) + " " + esc(opp.stage) + " " + money(opp.amount)) : ""}</div>`;
    }).join(""));
  }
  if (oppHit.length && docAny === 0) {
    parts.push(oppHit.map((o) => {
      const sos = D.salesOrders.filter((x) => x.source === "CRM成交" && x.sourceId === o.id);
      return `<div class="ai-block">${h3(o.name)}${p(`${oppBtn(o)} · ${esc(o.stage)} · ${money(o.amount)} · 预计 ${esc(o.expected || "")} · 负责人 ${esc(seller(o.ownerId)?.name || "")}`)}${sos.length ? p("成交订单：" + sos.map(soBtn).join("、")) : p(o.stage === "成交" ? "无匹配销售订单" : "尚未下单")}</div>`;
    }).join(""));
  }

  if (intents.includes("help") || (!q && !parts.length)) {
    parts.push(`<div class="ai-block">${h3("可以这样问")}
      ${p("数字和状态都来自本系统单据。可问汇总，也可直接输入单号、SKU、批次、客户名。")}
      ${p("例：本月销售额和回款 · 哪些订单缺货 · PO-202608-002 是为哪张订单补货 · FW-VIT-002 库存 · SO-202608-003 · 临期批次")}
    </div>`);
  }
  if (intents.includes("overview")) parts.push(overviewHtml());
  if (intents.includes("sales")) parts.push(salesHtml(custHit));
  if (intents.includes("ar")) parts.push(arHtml(custHit));
  if (intents.includes("ap")) {
    const list = D.payables || [];
    parts.push(`<div class="ai-block">${h3("应付管理")}${p(`共 ${list.length} 笔，未清 ${money(list.filter((x) => x.status !== "已付款").reduce((s, x) => s + x.amount, 0))}`)}${rows(["应付单", "供应商", "金额", "状态"], list.map((x) => `<tr><td>${go("fin-ap", x.no)}</td><td>${esc(supplier(x.supplierId)?.name || "")}</td><td class="num">${money2(x.amount)}</td><td>${esc(x.status)}</td></tr>`).join(""))}${p(go("fin-ap", "打开应付管理"))}</div>`);
  }
  if (intents.includes("invoice")) {
    const list = D.invoices || [];
    parts.push(`<div class="ai-block">${h3("发票（对账链）")}${p(`${list.length} 张，合计 ${money(list.reduce((s, x) => s + x.amount, 0))}。开票在应收管理里完成。`)}${rows(["发票", "客户", "金额", "状态"], list.map((x) => `<tr><td>${go("fin-ar", x.no)}</td><td>${esc(customer(x.customerId)?.name || "")}</td><td class="num">${money2(x.amount)}</td><td>${esc(x.status)}</td></tr>`).join(""))}${p(go("fin-ar", "打开应收管理"))}</div>`);
  }
  if (intents.includes("shortage")) {
    const list = D.salesOrders.filter((o) => o.shortage && !["已取消", "已驳回"].includes(o.status));
    const rps = D.replenishments || [];
    parts.push(`<div class="ai-block">${h3("缺货订单")}${p(`${list.length} 笔。有货先出；缺口按订单行 + SKU 生成补货单，再转采购。`)}${rows(["订单", "客户", "状态", "金额"], list.map((o) => `<tr><td>${soBtn(o)}</td><td>${esc(customer(o.customerId)?.name || "")}</td><td>${esc(o.status)}</td><td class="num">${money(o.amount)}</td></tr>`).join(""))}${rps.length ? rows(["补货单", "订单行", "SKU", "缺口", "采购单"], rps.map((r) => {
      const so = byId(D.salesOrders, r.orderId);
      const po = byId(D.purchaseOrders, r.poId);
      return `<tr><td>${esc(r.no)}</td><td>${so ? soBtn(so) : ""} ${esc(r.lineNo)}</td><td>${esc(product(r.productId)?.sku || "")}</td><td class="num">${r.shortageQty}</td><td>${po ? poBtn(po) : "—"}</td></tr>`;
    }).join("")) : ""}</div>`);
  }
  if (intents.includes("near")) {
    const near = D.inventory.filter((i) => daysTo(i.expiryDate) <= 30 && avail(i) > 0);
    parts.push(`<div class="ai-block">${h3("临期 / 近效期")}${p(`${near.length} 个有货批次，效期 ≤ 30 天`)}${rows(["批次", "SKU", "仓库", "可用", "剩余天数"], near.map((i) => `<tr><td>${go("inventory", i.batchNo, ` data-q="${i.batchNo}"`)}</td><td>${esc(product(i.productId)?.sku || "")}</td><td>${esc(warehouse(i.warehouseId)?.name || "")}</td><td class="num">${avail(i)}</td><td class="num">${daysTo(i.expiryDate)}</td></tr>`).join(""))}</div>`);
  }
  if (intents.includes("stock") && !skuHit.length && !(prodNameHit.length && prodNameHit.length <= 6)) parts.push(stockHtml(prodNameHit));
  if (intents.includes("stock") && (skuHit.length || (prodNameHit.length && prodNameHit.length <= 6)) && !parts.some((x) => x.includes(prodNameHit[0]?.sku || "___"))) parts.push(stockHtml(prodNameHit));
  if (intents.includes("demand")) {
    const needs = D.products.filter((x) => x.status === 1).map((x) => ({ p: x, ...needOf(x.id) })).filter((x) => x.qty > 0).sort((a, b) => b.qty - a.qty);
    parts.push(`<div class="ai-block">${h3("采购需求")}${p(`公式：销售需求 + 安全库存 − 可用 − 未到货。当前 ${needs.length} 个 SKU 需要补货。`)}${rows(["SKU", "商品", "销售", "安全", "可用", "未到货", "需求"], lim(needs, 20).map((x) => `<tr><td>${pBtn(x.p)}</td><td>${esc(x.p.name)}</td><td class="num">${x.sales}</td><td class="num">${x.safety}</td><td class="num">${x.available}</td><td class="num">${x.inbound}</td><td class="num">${x.qty}</td></tr>`).join(""))}${p(go("fulfillment", "打开采购需求", ' data-tab="demand"'))}</div>`);
  }
  if (intents.includes("po")) {
    const list = D.purchaseOrders.slice();
    parts.push(`<div class="ai-block">${h3("采购订单")}${p(`${list.length} 张`)}${rows(["采购单", "供应商", "状态", "日期"], list.map((x) => `<tr><td>${poBtn(x)}</td><td>${esc(supplier(x.supplierId)?.name || "")}</td><td>${esc(x.status)}</td><td class="num">${esc(x.orderDate || "")}</td></tr>`).join(""))}${p(go("pos", "打开采购订单"))}</div>`);
  }
  if (intents.includes("outbound")) {
    const list = D.outbound.slice();
    parts.push(`<div class="ai-block">${h3("出库履约")}${p(`共 ${list.length} 笔，待出库 ${list.filter((x) => x.status === "待出库").length}。在供应链订单中心确认出库。`)}${rows(["履约", "订单", "状态", "数量"], lim(list, 16).map((x) => `<tr><td>${esc(x.outboundNo)}</td><td>${byId(D.salesOrders, x.orderId) ? soBtn(byId(D.salesOrders, x.orderId)) : "—"}</td><td>${esc(x.status)}</td><td class="num">${x.qty}</td></tr>`).join(""))}${p(go("fulfillment", "打开履约订单"))}</div>`);
  }
  if (intents.includes("pending")) {
    const list = D.salesOrders.filter((o) => o.status === "待审核");
    parts.push(`<div class="ai-block">${h3("待审核销售订单")}${p(`${list.length} 笔。通过后才预占、出库、形成应收。`)}${rows(["订单", "客户", "金额"], list.map((o) => `<tr><td>${soBtn(o)}</td><td>${esc(customer(o.customerId)?.name || "")}</td><td class="num">${money(o.amount)}</td></tr>`).join(""))}</div>`);
  }
  if (intents.includes("leads")) {
    const list = D.leads;
    const conv = list.filter((l) => l.status === "已转商机").length;
    parts.push(`<div class="ai-block">${h3("线索")}${p(`${list.length} 条，已转商机 ${conv}，无效 ${list.filter((l) => l.status === "无效").length}`)}${rows(["Lead ID", "联系人", "SKU", "状态"], lim(list, 15).map((l) => {
      const p = product(l.productId);
      return `<tr><td>${leadBtn(l)}</td><td>${esc(l.name)}</td><td class="num">${esc(p?.sku || "—")}</td><td>${esc(l.status === "已转商机" || l.status === "无效" ? l.status : "—")}</td></tr>`;
    }).join(""))}${p(go("leads", "打开线索"))}</div>`);
  }
  if (intents.includes("opps")) {
    const list = D.opportunities;
    const won = list.filter((o) => o.stage === "成交");
    parts.push(`<div class="ai-block">${h3("商机")}${p(`${list.length} 个，成交 ${won.length}，成交金额 ${money(won.reduce((s, o) => s + o.amount, 0))}`)}${rows(["OPP ID", "关联线索", "关联订单", "金额", "阶段"], lim(list, 15).map((o) => {
      const lead = D.leads.find((l) => l.id === o.leadId);
      const so = (D.salesOrders || []).find((x) => x.source === "CRM成交" && x.sourceId === o.id);
      return `<tr><td>${oppBtn(o)}</td><td>${lead ? leadBtn(lead) : "—"}</td><td>${so ? soBtn(so) : "—"}</td><td class="num">${money(o.amount)}</td><td>${esc(o.stage)}</td></tr>`;
    }).join(""))}${p(go("opps", "打开商机"))}</div>`);
  }
  if (intents.includes("customers")) {
    parts.push(`<div class="ai-block">${h3("客户")}${rows(["客户", "渠道", "账期", "额度"], D.customers.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${c.creditDays}天</td><td class="num">${money(c.creditLimit)}</td></tr>`).join(""))}${p(go("orders", "打开订单"))}</div>`);
  }

  if (parts.length) {
    return parts.join("");
  }

  const tokens = q.replace(/订单|库存|客户|销售|采购|应收|回款|线索|商机|出库|发票|凭证|审计|多少|什么|哪些|怎么|为什么|本月|全部|查询|看看|一下|情况|汇总|总览|数据|系统|信息|的|和|与|及|了|吗|呢|请|帮我|给我/g, " ").split(/[\s,，、]+/).map((x) => x.trim()).filter((x) => x.length >= 2);
  const blob = (arr) => arr.filter(Boolean).join(" ").toLowerCase();
  const hits = [];
  const pushHit = (kind, title, sub, btn) => hits.push({ kind, title, sub, btn });
  if (tokens.length) {
    D.salesOrders.forEach((o) => {
      const h = blob([o.orderNo, o.status, o.source, customer(o.customerId)?.name, lineSummary(o), o.receiver]);
      if (tokens.every((t) => h.includes(t.toLowerCase()) || h.includes(t))) pushHit("订单", o.orderNo, `${customer(o.customerId)?.name || ""} · ${o.status} · ${money(o.amount)}`, soBtn(o));
    });
    D.products.forEach((pr) => {
      const h = blob([pr.sku, pr.name, pr.category, pr.spec]);
      if (tokens.every((t) => h.includes(t.toLowerCase()) || h.includes(t))) pushHit("商品", pr.sku, pr.name, pBtn(pr));
    });
    D.leads.forEach((l) => {
      const h = blob([l.leadNo, l.name, l.company, l.source, l.interest, l.status]);
      if (tokens.every((t) => h.includes(t.toLowerCase()) || h.includes(t))) pushHit("线索", l.name, `${l.company} · ${l.status}`, leadBtn(l));
    });
    D.opportunities.forEach((o) => {
      const h = blob([o.name, o.stage, o.winReason, o.lossReason]);
      if (tokens.every((t) => h.includes(t.toLowerCase()) || h.includes(t))) pushHit("商机", o.name, `${o.stage} · ${money(o.amount)}`, oppBtn(o));
    });
    D.customers.forEach((c) => {
      const h = blob([c.name, c.type, c.region, c.owner]);
      if (tokens.every((t) => h.includes(t.toLowerCase()) || h.includes(t))) pushHit("客户", c.name, `${c.type} · ${c.region}`, esc(c.name));
    });
  }
  if (hits.length) {
    return `<div class="ai-block">${h3("检索结果")}
      ${p(`按「${esc(q)}」在系统单据中匹配到 ${hits.length} 条，未编造。`)}
      ${rows(["类型", "对象", "摘要"], lim(hits, 20).map((h) => `<tr><td>${esc(h.kind)}</td><td>${h.btn}</td><td>${esc(h.sub)}</td></tr>`).join(""))}
    </div>`;
  }

  return `<div class="ai-block">${h3("没有直接命中")}
    ${p(`系统里没有与「${esc(q)}」对应的单号、客户、SKU 或可汇总指标。请换单号（如 SO-202608-001）、客户名、SKU，或问「本月销售额」「缺货订单」。`)}
    ${p("数字只来自已有单据，不会补造。")}
  </div>`;
};
