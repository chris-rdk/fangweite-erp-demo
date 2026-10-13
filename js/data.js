/**
 * Forvet · 一体化信息系统 模拟数据
 * 演示主线只留 4 笔销售订单，单据按线索→商机→订单→审核→出库→应收→回款→开票串联。
 */
window.AppData = (() => {
  const warehouses = [
    { id: 1, code: "WH-EAST", name: "华东仓", address: "上海市松江区九亭工业园18号", region: "华东", status: 1 },
    { id: 2, code: "WH-SOUTH", name: "华南仓", address: "广州市黄埔区开源大道228号", region: "华南", status: 1 },
    { id: 3, code: "WH-NORTH", name: "华北仓", address: "北京市大兴区亦庄经海路88号", region: "华北", status: 1 },
  ];

  const products = [
    { id: 1, sku: "FW-PRO-001", name: "乳清蛋白粉 香草", spec: "900g/罐", category: "蛋白营养", brand: "Forvet", shelfLife: 540, price: 268, cost: 112, safety: 80, status: 1 },
    { id: 2, sku: "FW-PRO-002", name: "乳清蛋白粉 可可", spec: "900g/罐", category: "蛋白营养", brand: "Forvet", shelfLife: 540, price: 268, cost: 112, safety: 60, status: 1 },
    { id: 3, sku: "FW-PRO-003", name: "植物蛋白粉 原味", spec: "750g/罐", category: "蛋白营养", brand: "Forvet", shelfLife: 365, price: 198, cost: 86, safety: 40, status: 1 },
    { id: 4, sku: "FW-VIT-001", name: "复合维生素矿物质片", spec: "60粒/瓶", category: "维生素", brand: "Forvet", shelfLife: 730, price: 129, cost: 42, safety: 120, status: 1 },
    { id: 5, sku: "FW-VIT-002", name: "维生素C缓释片", spec: "90粒/瓶", category: "维生素", brand: "Forvet", shelfLife: 730, price: 89, cost: 28, safety: 100, status: 1 },
    { id: 6, sku: "FW-VIT-003", name: "维生素D3软胶囊", spec: "60粒/瓶", category: "维生素", brand: "Forvet", shelfLife: 730, price: 99, cost: 31, safety: 80, status: 1 },
    { id: 7, sku: "FW-OMG-001", name: "深海鱼油软胶囊", spec: "120粒/瓶", category: "油脂营养", brand: "Forvet", shelfLife: 730, price: 198, cost: 74, safety: 90, status: 1 },
    { id: 8, sku: "FW-COL-001", name: "胶原蛋白肽粉", spec: "30袋/盒", category: "美容抗衰", brand: "Forvet", shelfLife: 540, price: 298, cost: 118, safety: 50, status: 1 },
    { id: 9, sku: "FW-BIO-001", name: "益生菌固体饮料", spec: "30条/盒", category: "肠道健康", brand: "Forvet", shelfLife: 540, price: 168, cost: 62, safety: 70, status: 1 },
    { id: 10, sku: "FW-CAL-001", name: "钙镁锌片", spec: "60片/瓶", category: "矿物质", brand: "Forvet", shelfLife: 730, price: 79, cost: 24, safety: 80, status: 1 },
    { id: 11, sku: "FW-LUT-001", name: "叶黄素酯软糖", spec: "60粒/瓶", category: "视力养护", brand: "Forvet", shelfLife: 540, price: 119, cost: 38, safety: 60, status: 1 },
    { id: 12, sku: "FW-COQ-001", name: "辅酶Q10软胶囊", spec: "60粒/瓶", category: "心脏养护", brand: "Forvet", shelfLife: 730, price: 258, cost: 96, safety: 40, status: 1 },
    { id: 13, sku: "FW-NMN-001", name: "NMN烟酰胺单核苷酸", spec: "30粒/瓶", category: "抗衰高端", brand: "Forvet", shelfLife: 365, price: 598, cost: 240, safety: 20, status: 1 },
    { id: 14, sku: "FW-ASH-001", name: "南非醉茄胶囊", spec: "60粒/瓶", category: "压力管理", brand: "Forvet", shelfLife: 730, price: 188, cost: 71, safety: 30, status: 1 },
    { id: 15, sku: "FW-MEL-001", name: "褪黑素片", spec: "30片/瓶", category: "睡眠", brand: "Forvet", shelfLife: 730, price: 69, cost: 18, safety: 80, status: 1 },
    { id: 16, sku: "FW-LYC-001", name: "番茄红素软胶囊", spec: "60粒/瓶", category: "抗氧化", brand: "Forvet", shelfLife: 730, price: 158, cost: 54, safety: 40, status: 1 },
    { id: 17, sku: "FW-GLU-001", name: "氨糖软骨素钙片", spec: "90片/瓶", category: "关节护理", brand: "Forvet", shelfLife: 730, price: 168, cost: 58, safety: 50, status: 1 },
    { id: 18, sku: "FW-SPI-001", name: "螺旋藻片", spec: "120片/瓶", category: "绿色营养", brand: "Forvet", shelfLife: 730, price: 88, cost: 26, safety: 40, status: 0 },
    { id: 19, sku: "FW-CUR-001", name: "姜黄素软胶囊", spec: "60粒/瓶", category: "抗炎养护", brand: "Forvet", shelfLife: 730, price: 178, cost: 64, safety: 30, status: 1 },
    { id: 20, sku: "FW-WHE-001", name: "水解胶原蛋白饮", spec: "50ml×10瓶", category: "美容抗衰", brand: "Forvet", shelfLife: 365, price: 328, cost: 142, safety: 40, status: 1 },
    { id: 21, sku: "FW-IMM-001", name: "增强免疫配方片", spec: "60片/瓶", category: "免疫", brand: "Forvet", shelfLife: 730, price: 149, cost: 48, safety: 50, status: 1 },
    { id: 22, sku: "FW-SLP-001", name: "助眠草本茶", spec: "3g×20袋", category: "睡眠", brand: "Forvet", shelfLife: 540, price: 96, cost: 32, safety: 40, status: 1 },
    { id: 23, sku: "FW-GAR-001", name: "大蒜精油软胶囊", spec: "60粒/瓶", category: "心血管", brand: "Forvet", shelfLife: 730, price: 138, cost: 46, safety: 25, status: 1 },
    { id: 24, sku: "FW-BER-001", name: "小檗碱胶囊", spec: "60粒/瓶", category: "代谢管理", brand: "Forvet", shelfLife: 730, price: 168, cost: 55, safety: 30, status: 1 },
  ];
  [
    ["FW-PRO-004", "乳清蛋白粉 草莓", "900g/罐", "蛋白营养", 540, 268, 112, 50],
    ["FW-PRO-005", "乳清蛋白粉 抹茶", "900g/罐", "蛋白营养", 540, 268, 112, 50],
    ["FW-PRO-006", "分离乳清蛋白 原味", "907g/罐", "蛋白营养", 540, 328, 138, 40],
    ["FW-PRO-007", "酪蛋白夜间蛋白", "750g/罐", "蛋白营养", 540, 248, 104, 36],
    ["FW-PRO-008", "大豆蛋白粉 原味", "750g/罐", "蛋白营养", 365, 168, 72, 40],
    ["FW-PRO-009", "豌豆蛋白粉 巧克力", "750g/罐", "蛋白营养", 365, 178, 76, 36],
    ["FW-PRO-010", "增肌蛋白棒 巧克力", "60g×12", "蛋白营养", 365, 158, 64, 50],
    ["FW-PRO-011", "蛋白代餐奶昔 香草", "30袋/盒", "蛋白营养", 365, 198, 82, 40],
    ["FW-PRO-012", "水解乳清蛋白 原味", "450g/罐", "蛋白营养", 540, 298, 126, 28],
    ["FW-PRO-013", "乳清蛋白粉 5磅香草", "2270g/桶", "蛋白营养", 540, 458, 196, 24],
    ["FW-PRO-014", "运动电解质蛋白水", "500ml×12", "蛋白营养", 365, 168, 70, 30],
    ["FW-PRO-015", "胶原乳清双蛋白", "700g/罐", "蛋白营养", 540, 318, 134, 32],
    ["FW-VIT-004", "维生素B族片", "60片/瓶", "维生素", 730, 79, 24, 80],
    ["FW-VIT-005", "维生素E软胶囊", "60粒/瓶", "维生素", 730, 89, 28, 70],
    ["FW-VIT-006", "维生素K2软胶囊", "60粒/瓶", "维生素", 730, 129, 44, 40],
    ["FW-VIT-007", "叶酸片", "90片/瓶", "维生素", 730, 59, 16, 90],
    ["FW-VIT-008", "烟酰胺片", "60片/瓶", "维生素", 730, 99, 32, 50],
    ["FW-VIT-009", "维生素A软胶囊", "60粒/瓶", "维生素", 730, 69, 20, 60],
    ["FW-VIT-010", "复合维生素软糖", "60粒/瓶", "维生素", 540, 89, 30, 70],
    ["FW-VIT-011", "维生素C泡腾片", "20片/管", "维生素", 540, 49, 14, 100],
    ["FW-VIT-012", "维生素D3滴剂", "10ml/瓶", "维生素", 540, 119, 38, 40],
    ["FW-VIT-013", "多种维生素矿物质粉", "30袋/盒", "维生素", 540, 168, 58, 40],
    ["FW-VIT-014", "维生素B12含片", "60片/瓶", "维生素", 730, 69, 18, 60],
    ["FW-VIT-015", "维生素C+锌片", "60片/瓶", "维生素", 730, 79, 24, 80],
    ["FW-MIN-001", "铁叶酸片", "60片/瓶", "矿物质", 730, 69, 20, 70],
    ["FW-MIN-002", "锌片", "60片/瓶", "矿物质", 730, 49, 14, 80],
    ["FW-MIN-003", "硒酵母片", "60片/瓶", "矿物质", 730, 89, 28, 40],
    ["FW-MIN-004", "镁片", "90片/瓶", "矿物质", 730, 79, 24, 70],
    ["FW-MIN-005", "钾镁片", "60片/瓶", "矿物质", 730, 89, 30, 40],
    ["FW-MIN-006", "铬酵母片", "60片/瓶", "矿物质", 730, 99, 34, 30],
    ["FW-MIN-007", "海藻钙片", "60片/瓶", "矿物质", 730, 89, 26, 60],
    ["FW-MIN-008", "多种矿物质片", "60片/瓶", "矿物质", 730, 109, 36, 50],
    ["FW-OMG-002", "磷虾油软胶囊", "60粒/瓶", "油脂营养", 730, 228, 86, 40],
    ["FW-OMG-003", "藻油DHA软胶囊", "60粒/瓶", "油脂营养", 730, 188, 72, 50],
    ["FW-OMG-004", "亚麻籽油软胶囊", "90粒/瓶", "油脂营养", 540, 128, 46, 40],
    ["FW-OMG-005", "月见草油软胶囊", "60粒/瓶", "油脂营养", 730, 138, 48, 36],
    ["FW-OMG-006", "海豹油软胶囊", "60粒/瓶", "油脂营养", 730, 198, 76, 28],
    ["FW-OMG-007", "Omega-3高浓度鱼油", "60粒/瓶", "油脂营养", 730, 268, 102, 40],
    ["FW-OMG-008", "磷脂酰丝氨酸软胶囊", "60粒/瓶", "油脂营养", 730, 218, 84, 24],
    ["FW-OMG-009", "中链甘油三酯油", "250ml/瓶", "油脂营养", 540, 158, 62, 20],
    ["FW-COL-002", "鱼胶原蛋白肽", "30袋/盒", "美容抗衰", 540, 268, 108, 40],
    ["FW-COL-003", "弹性蛋白肽饮", "50ml×10", "美容抗衰", 365, 298, 128, 28],
    ["FW-COL-004", "玻尿酸胶原软糖", "60粒/瓶", "美容抗衰", 540, 139, 48, 50],
    ["FW-COL-005", "葡萄籽提取物胶囊", "60粒/瓶", "美容抗衰", 730, 168, 58, 40],
    ["FW-COL-006", "谷胱甘肽片", "60片/瓶", "美容抗衰", 730, 228, 88, 24],
    ["FW-COL-007", "烟酰胺饮", "50ml×10", "美容抗衰", 365, 198, 82, 30],
    ["FW-COL-008", "虾青素软胶囊", "30粒/瓶", "美容抗衰", 730, 258, 98, 24],
    ["FW-COL-009", "美容蛋白奶昔", "15袋/盒", "美容抗衰", 365, 188, 76, 32],
    ["FW-BIO-002", "益生菌成人胶囊", "30粒/瓶", "肠道健康", 540, 188, 72, 50],
    ["FW-BIO-003", "益生菌儿童滴剂", "8ml/瓶", "肠道健康", 365, 168, 64, 36],
    ["FW-BIO-004", "益生元菊粉", "250g/罐", "肠道健康", 540, 98, 34, 40],
    ["FW-BIO-005", "酵素果蔬粉", "20袋/盒", "肠道健康", 365, 128, 46, 40],
    ["FW-BIO-006", "膳食纤维粉", "30袋/盒", "肠道健康", 540, 108, 38, 50],
    ["FW-BIO-007", "益生菌固体饮料 草莓", "30条/盒", "肠道健康", 540, 168, 62, 40],
    ["FW-BIO-008", "幽门养护益生菌", "30粒/瓶", "肠道健康", 540, 218, 84, 24],
    ["FW-BIO-009", "肠道黏膜修护粉", "20袋/盒", "肠道健康", 540, 158, 58, 28],
    ["FW-SLP-002", "酸枣仁助眠胶囊", "60粒/瓶", "睡眠", 730, 128, 44, 40],
    ["FW-SLP-003", "GABA γ-氨基丁酸片", "60片/瓶", "睡眠", 730, 118, 40, 40],
    ["FW-SLP-004", "镁+褪黑素软糖", "60粒/瓶", "睡眠", 540, 99, 34, 50],
    ["FW-STR-002", "南非醉茄软糖", "60粒/瓶", "压力管理", 540, 148, 52, 36],
    ["FW-STR-003", "西番莲提取物胶囊", "60粒/瓶", "压力管理", 730, 138, 48, 30],
    ["FW-STR-004", "L-茶氨酸片", "60片/瓶", "压力管理", 730, 128, 42, 36],
    ["FW-LIV-001", "水飞蓟宾胶囊", "60粒/瓶", "肝脏养护", 730, 168, 62, 28],
    ["FW-LIV-002", "奶蓟草护肝片", "60片/瓶", "肝脏养护", 730, 148, 54, 30],
    ["FW-SPT-001", "支链氨基酸粉", "300g/罐", "运动营养", 730, 158, 58, 36],
    ["FW-SPT-002", "肌酸一水合物", "300g/罐", "运动营养", 730, 98, 32, 40],
    ["FW-SPT-003", "运动电解质粉", "20袋/盒", "运动营养", 540, 88, 28, 50],
    ["FW-IMM-002", "接骨木莓软糖", "60粒/瓶", "免疫", 540, 119, 40, 50],
    ["FW-IMM-003", "锌+维生素C泡腾片", "20片/管", "免疫", 540, 59, 16, 80],
    ["FW-MET-002", "白芸豆提取物胶囊", "60粒/瓶", "代谢管理", 730, 148, 52, 30],
    ["FW-WGT-001", "左旋肉碱口服液", "10支/盒", "代谢管理", 540, 138, 48, 28],
    ["FW-FEM-001", "大豆异黄酮胶囊", "60粒/瓶", "女性健康", 730, 168, 60, 30],
    ["FW-SPI-002", "螺旋藻粉", "200g/罐", "绿色营养", 730, 78, 22, 20, 0],
    ["FW-VIT-016", "旧版多种维生素", "60片/瓶", "维生素", 730, 69, 18, 20, 0],
    ["FW-GIF-001", "中秋营养礼盒", "蛋白+维生素套装", "礼盒套装", 365, 398, 168, 20],
    ["FW-GIF-002", "新客体验装", "6瓶试饮套装", "礼盒套装", 365, 99, 36, 40],
  ].forEach((row, i) => {
    products.push({
      id: 25 + i,
      sku: row[0],
      name: row[1],
      spec: row[2],
      category: row[3],
      brand: "Forvet",
      shelfLife: row[4],
      price: row[5],
      cost: row[6],
      safety: row[7],
      status: row[8] == null ? 1 : row[8],
    });
  });
  const registeredIds = new Set([13, 45, 67, 88]);
  const licenseSoonIds = new Set([18, 98]);
  products.forEach((p) => {
    p.qcStd = p.qcStd || "符合 GB 16740 保健食品通用标准 · 出厂检验合格";
    p.licenseType = registeredIds.has(p.id) ? "保健食品注册" : "保健食品备案";
    p.licenseNo = p.licenseType === "保健食品注册"
      ? "国食健注G2026" + String(1000 + p.id)
      : "食健备G2026" + String(2000 + p.id);
    p.licenseExpire = licenseSoonIds.has(p.id) ? "2026-09-15" : "2028-12-31";
  });

  const inventory = [
    { id: 1, productId: 1, warehouseId: 1, batchNo: "B260318A", productionDate: "2026-03-18", expiryDate: "2027-09-09", qty: 316, lockQty: 10 },
    { id: 2, productId: 1, warehouseId: 2, batchNo: "B260318B", productionDate: "2026-03-18", expiryDate: "2027-09-09", qty: 180, lockQty: 0 },
    { id: 3, productId: 1, warehouseId: 3, batchNo: "B260401A", productionDate: "2026-04-01", expiryDate: "2027-09-23", qty: 90, lockQty: 0 },
    { id: 4, productId: 2, warehouseId: 1, batchNo: "B260322A", productionDate: "2026-03-22", expiryDate: "2027-09-13", qty: 210, lockQty: 12 },
    { id: 5, productId: 2, warehouseId: 2, batchNo: "B260322B", productionDate: "2026-03-22", expiryDate: "2027-09-13", qty: 8, lockQty: 0 },
    { id: 6, productId: 3, warehouseId: 1, batchNo: "B260510A", productionDate: "2026-05-10", expiryDate: "2027-05-10", qty: 64, lockQty: 8 },
    { id: 7, productId: 4, warehouseId: 1, batchNo: "B251120A", productionDate: "2025-11-20", expiryDate: "2027-11-20", qty: 480, lockQty: 60 },
    { id: 8, productId: 4, warehouseId: 2, batchNo: "B251120B", productionDate: "2025-11-20", expiryDate: "2027-11-20", qty: 260, lockQty: 20 },
    { id: 9, productId: 4, warehouseId: 3, batchNo: "B260108A", productionDate: "2026-01-08", expiryDate: "2028-01-08", qty: 150, lockQty: 0 },
    { id: 10, productId: 5, warehouseId: 1, batchNo: "B260201A", productionDate: "2026-02-01", expiryDate: "2028-02-01", qty: 40, lockQty: 40 },
    { id: 11, productId: 6, warehouseId: 2, batchNo: "B260215A", productionDate: "2026-02-15", expiryDate: "2028-02-15", qty: 140, lockQty: 10 },
    { id: 12, productId: 7, warehouseId: 1, batchNo: "B251201A", productionDate: "2025-12-01", expiryDate: "2027-12-01", qty: 220, lockQty: 40 },
    { id: 13, productId: 7, warehouseId: 3, batchNo: "B260310A", productionDate: "2026-03-10", expiryDate: "2028-03-10", qty: 96, lockQty: 0 },
    { id: 14, productId: 8, warehouseId: 1, batchNo: "B260601A", productionDate: "2026-06-01", expiryDate: "2027-11-23", qty: 88, lockQty: 16 },
    { id: 15, productId: 9, warehouseId: 2, batchNo: "B260520A", productionDate: "2026-05-20", expiryDate: "2027-11-11", qty: 42, lockQty: 6 },
    { id: 16, productId: 10, warehouseId: 1, batchNo: "B260110A", productionDate: "2026-01-10", expiryDate: "2028-01-10", qty: 200, lockQty: 0 },
    { id: 17, productId: 11, warehouseId: 2, batchNo: "B260801A", productionDate: "2026-08-01", expiryDate: "2028-01-23", qty: 110, lockQty: 8 },
    { id: 18, productId: 12, warehouseId: 1, batchNo: "B260405A", productionDate: "2026-04-05", expiryDate: "2028-04-05", qty: 36, lockQty: 4 },
    { id: 19, productId: 13, warehouseId: 1, batchNo: "B260710A", productionDate: "2026-07-10", expiryDate: "2027-07-10", qty: 18, lockQty: 2 },
    { id: 20, productId: 14, warehouseId: 3, batchNo: "B260612A", productionDate: "2026-06-12", expiryDate: "2028-06-12", qty: 40, lockQty: 0 },
    { id: 21, productId: 15, warehouseId: 1, batchNo: "B250910A", productionDate: "2025-09-10", expiryDate: "2026-09-10", qty: 55, lockQty: 0 },
    { id: 22, productId: 15, warehouseId: 2, batchNo: "B260118A", productionDate: "2026-01-18", expiryDate: "2028-01-18", qty: 160, lockQty: 20 },
    { id: 23, productId: 16, warehouseId: 3, batchNo: "B260330A", productionDate: "2026-03-30", expiryDate: "2028-03-30", qty: 44, lockQty: 0 },
    { id: 24, productId: 17, warehouseId: 1, batchNo: "B260222A", productionDate: "2026-02-22", expiryDate: "2028-02-22", qty: 72, lockQty: 8 },
    { id: 25, productId: 18, warehouseId: 2, batchNo: "B250801A", productionDate: "2025-08-01", expiryDate: "2027-08-01", qty: 12, lockQty: 0 },
    { id: 26, productId: 19, warehouseId: 1, batchNo: "B260505A", productionDate: "2026-05-05", expiryDate: "2028-05-05", qty: 36, lockQty: 0 },
    { id: 27, productId: 20, warehouseId: 1, batchNo: "B260720A", productionDate: "2026-07-20", expiryDate: "2027-07-20", qty: 60, lockQty: 0 },
    { id: 28, productId: 21, warehouseId: 2, batchNo: "B260408A", productionDate: "2026-04-08", expiryDate: "2028-04-08", qty: 66, lockQty: 6 },
    { id: 29, productId: 22, warehouseId: 3, batchNo: "B260815A", productionDate: "2026-08-15", expiryDate: "2028-02-05", qty: 80, lockQty: 6 },
    { id: 30, productId: 23, warehouseId: 1, batchNo: "B260628A", productionDate: "2026-06-28", expiryDate: "2028-06-28", qty: 32, lockQty: 0 },
    { id: 31, productId: 24, warehouseId: 2, batchNo: "B260701A", productionDate: "2026-07-01", expiryDate: "2028-07-01", qty: 36, lockQty: 0 },
    { id: 32, productId: 8, warehouseId: 2, batchNo: "B250901A", productionDate: "2025-09-01", expiryDate: "2026-09-24", qty: 14, lockQty: 0 },
    { id: 33, productId: 9, warehouseId: 1, batchNo: "B260818A", productionDate: "2026-08-18", expiryDate: "2028-02-08", qty: 24, lockQty: 0 },
    { id: 34, productId: 13, warehouseId: 3, batchNo: "B260710B", productionDate: "2026-07-10", expiryDate: "2027-07-10", qty: 6, lockQty: 0 },
    { id: 35, productId: 12, warehouseId: 3, batchNo: "B260405B", productionDate: "2026-04-05", expiryDate: "2028-04-05", qty: 4, lockQty: 0 },
    { id: 36, productId: 9, warehouseId: 2, batchNo: "B260824A", productionDate: "2026-08-24", expiryDate: "2028-02-14", qty: 60, lockQty: 0 },
  ];
  inventory.forEach((i) => { if (i.frozen == null) i.frozen = 0; });
  const freezeLot = inventory.find((i) => i.batchNo === "B250910A");
  if (freezeLot) freezeLot.frozen = 1;

  const seedDay = (base, days) => {
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  let invNext = inventory.reduce((m, i) => Math.max(m, i.id), 0) + 1;
  products.slice(24).forEach((p, i) => {
    if (p.status !== 1) return;
    const wh = (i % 3) + 1;
    const oos = false;
    const low = false;
    const near = i % 13 === 0;
    const qty = Math.max(p.safety + 24, 64);
    const lockQty = 0;
    const prodDate = near ? "2025-09-20" : seedDay("2026-08-30", -((i * 17) % 280) - 20);
    const expiry = near ? "2026-09-18" : seedDay(prodDate, p.shelfLife);
    inventory.push({
      id: invNext++,
      productId: p.id,
      warehouseId: wh,
      batchNo: "B26" + String(800 + i).padStart(3, "0") + ["A", "B", "C"][i % 3],
      productionDate: prodDate,
      expiryDate: expiry,
      qty,
      lockQty,
      frozen: 0,
    });
    if (i % 4 === 0 && !oos) {
      inventory.push({
        id: invNext++,
        productId: p.id,
        warehouseId: (wh % 3) + 1,
        batchNo: "B26" + String(800 + i).padStart(3, "0") + "X",
        productionDate: seedDay("2026-08-30", -90),
        expiryDate: seedDay("2026-08-30", p.shelfLife - 90),
        qty: 24 + (i % 40),
        lockQty: 0,
        frozen: 0,
      });
    }
  });
  inventory.forEach((i) => { i.lockQty = 0; });
  const lockLots = { B260201A: 40, B260318A: 10, B251201A: 10 };
  inventory.forEach((i) => { if (lockLots[i.batchNo]) i.lockQty = lockLots[i.batchNo]; });

  const inventoryTx = [
    { id: 1, productId: 1, warehouseId: 1, batchNo: "B260318A", type: "入库", qty: 192, before: 128, after: 320, refType: "采购入库单", refNo: "PO-202608-001", by: "Walter Wang", at: "2026-08-19 14:20", remark: "验收合格 192" },
    { id: 2, productId: 8, warehouseId: 1, batchNo: "B260601A", type: "出库", qty: -60, before: 148, after: 88, refType: "出库单", refNo: "OUT-202608-001", by: "Walter Wang", at: "2026-08-13 11:20", remark: "SO-202608-001" },
    { id: 3, productId: 1, warehouseId: 1, batchNo: "B260318A", type: "出库", qty: -4, before: 320, after: 316, refType: "出库单", refNo: "OUT-202608-002", by: "Walter Wang", at: "2026-08-27 09:40", remark: "SO-202608-002" },
    { id: 4, productId: 5, warehouseId: 1, batchNo: "B260201A", type: "锁定", qty: 40, before: 40, after: 40, refType: "销售订单", refNo: "SO-202608-003-02", by: "系统", at: "2026-08-27 15:10", remark: "订单行预占" },
    { id: 6, productId: 1, warehouseId: 1, batchNo: "B260318A", type: "锁定", qty: 10, before: 316, after: 316, refType: "销售订单", refNo: "SO-202608-003-01", by: "系统", at: "2026-08-27 15:10", remark: "订单行预占" },
    { id: 7, productId: 7, warehouseId: 1, batchNo: "B251201A", type: "锁定", qty: 10, before: 220, after: 220, refType: "销售订单", refNo: "SO-202608-003-03", by: "系统", at: "2026-08-27 15:10", remark: "订单行预占" },
    { id: 5, productId: 15, warehouseId: 1, batchNo: "B250910A", type: "盘亏", qty: -5, before: 60, after: 55, refType: "盘点单", refNo: "PD-202608-002", by: "Leo Li", at: "2026-08-25 16:40", remark: "临期抽检损耗" },
  ];

  const suppliers = [
    { id: 1, name: "Aowei", contact: "Owen Zhao", phone: "021-5866-1200", status: "合作中", taxNo: "91310000MA1H8821X" },
    { id: 2, name: "Nanhai Bio", contact: "Lynn Lin", phone: "020-3881-7766", status: "合作中", taxNo: "91440100MA5D229K2" },
    { id: 3, name: "Beichen Pack", contact: "Jordan Zhou", phone: "010-6788-3344", status: "合作中", taxNo: "91110115MA01K33D5" },
  ];

  const purchaseOrders = [
    {
      id: 1, poNo: "PO-202608-001", supplierId: 1, productId: 1, qty: 200, unitPrice: 112,
      orderDate: "2026-08-06", expectedDate: "2026-08-20", actualDate: "2026-08-19", status: "已入库",
      warehouseId: 1, receivedQty: 192, source: "手工采购",
      lines: [{ id: 1, productId: 1, qty: 200, unitPrice: 112, receivedQty: 192 }],
    },
    {
      id: 2, poNo: "PO-202608-002", supplierId: 1, productId: 5, qty: 180, unitPrice: 28,
      orderDate: "2026-08-27", expectedDate: "2026-09-08", actualDate: null, status: "待审核",
      warehouseId: 1, receivedQty: 0, source: "缺货自动补货", sourceOrder: "SO-202608-003",
      lines: [{ id: 1, productId: 5, qty: 180, unitPrice: 28, receivedQty: 0, replenishmentId: 1 }],
    },
  ];

  const purchaseReturns = [
    { id: 1, no: "PR-202608-001", poId: 1, supplierId: 1, productId: 1, warehouseId: 1, batchNo: "B260318A", qty: 8, reason: "外包装破损，质检不合格", date: "2026-08-21", status: "已退货" },
  ];

  const salesReturns = [];

  const customers = [
    { id: 1, name: "Kanglin", type: "线下经销商", region: "华东", owner: "Fiona Liu", ownerId: 1, phone: "13810001001", creditDays: 15, address: "杭州市余杭区仓前街道18号" },
    { id: 2, name: "FitHub", type: "电商", region: "华南", owner: "Kai Zhou", ownerId: 2, phone: "13920002002", creditDays: 20, address: "广州市天河区科韵路88号" },
    { id: 3, name: "Beichen", type: "线下经销商", region: "华北", owner: "Fiona Liu", ownerId: 1, phone: "13730003003", creditDays: 15, address: "北京市朝阳区将台路12号" },
    { id: 4, name: "U-Life", type: "线下经销商", region: "华东", owner: "Kai Zhou", ownerId: 2, phone: "13360006006", creditDays: 10, address: "苏州市工业园区星湖街328号" },
    { id: 5, name: "Tmall Flagship", type: "电商", region: "全国", owner: "系统", ownerId: 0, phone: "00000000000", creditDays: 0, address: "平台发货" },
    { id: 6, name: "Douyin Shop", type: "电商", region: "全国", owner: "系统", ownerId: 0, phone: "00000000000", creditDays: 0, address: "平台发货" },
    { id: 7, name: "Nanshan", type: "线下经销商", region: "华南", owner: "Kai Zhou", ownerId: 2, phone: "13550005005", creditDays: 15, address: "深圳市南山区科技园一路" },
    { id: 8, name: "Ruici", type: "线下经销商", region: "华东", owner: "Fiona Liu", ownerId: 1, phone: "13640004004", creditDays: 7, address: "上海市浦东新区张江路200号" },
  ];
  const creditLimits = { 1: 220000, 2: 180000, 3: 160000, 4: 100000, 5: 80000, 6: 80000, 7: 120000, 8: 90000 };
  customers.forEach((c) => {
    c.creditLimit = creditLimits[c.id] || 100000;
    c.type = c.type === "电商" ? "电商" : "线下经销商";
    c.priceLevel = c.type === "电商" ? "零售" : (c.id === 8 ? "VIP" : "经销商");
  });

  const sales = [
    { id: 1, name: "Fiona Liu", region: "华东" },
    { id: 2, name: "Kai Zhou", region: "华南" },
    { id: 3, name: "Miles Chen", region: "华北" },
  ];

  const leadSourceOf = (source) => source || "展会";
  const leadDefaults = (l) => {
    const source = leadSourceOf(l.source);
    const row = Object.assign({
      leadNo: "LD-" + String(l.id).padStart(3, "0"),
      title: "", region: "", channel: source, campaign: "",
      source,
      acquireType: ["广告", "官网", "电商"].includes(source) ? "线上投放" : "线下活动",
      salesChannel: source === "电商" ? "电商" : "线下经销商",
      intent: "中", capturedBy: "Marketing", capturedDept: "市场部",
      assignedTo: null, ownerName: "", closeReason: "", opportunityId: null, progress: "待跟进",
    }, l);
    row.source = leadSourceOf(row.source);
    row.channel = row.channel || row.source;
    return row;
  };
  const leads = [
    leadDefaults({ id: 9, name: "Nina Li", phone: "137****8008", phoneFull: "13780008008", company: "Ruici", source: "推荐", segment: "美容抗衰", interest: "胶原蛋白肽粉", productId: 8, potential: 13920, status: "已转商机", assignedTo: 1, ownerName: "Fiona Liu", createdAt: "2026-08-04 14:08", convertedAt: "2026-08-12 16:20", opportunityId: 1 }),
    leadDefaults({ id: 8, name: "Tom Zhang", phone: "138****1001", phoneFull: "13810001001", company: "Kanglin", source: "展会", segment: "维生素", interest: "蛋白粉 / 维C / 鱼油", productId: 5, potential: 13080, status: "已转商机", assignedTo: 1, ownerName: "Fiona Liu", createdAt: "2026-08-18 11:20", convertedAt: "2026-08-24 15:40", opportunityId: 5 }),
    leadDefaults({ id: 5, name: "Amy Chen", phone: "139****1001", phoneFull: "13910001001", company: "North Club", source: "广告", segment: "蛋白营养", interest: "乳清蛋白粉 香草", productId: 1, potential: 36000, status: "已联系", assignedTo: 1, ownerName: "Fiona Liu", createdAt: "2026-08-30 09:12" }),
    leadDefaults({ id: 3, name: "Lisa Zhou", phone: "136****3003", phoneFull: "13630003003", company: "Harbor Fit", source: "广告", segment: "美容抗衰", interest: "胶原蛋白肽粉", productId: 8, potential: 54000, status: "有效", assignedTo: 1, ownerName: "Fiona Liu", createdAt: "2026-08-22 10:05" }),
    leadDefaults({ id: 2, name: "Tom Gao", phone: "135****4004", phoneFull: "13540004004", company: "Jiahe Trade", source: "展会", segment: "蛋白营养", interest: "乳清蛋白粉 香草", productId: 1, potential: 88000, status: "已转商机", assignedTo: 1, ownerName: "Fiona Liu", createdAt: "2026-08-20 11:30", convertedAt: "2026-08-27 14:20", opportunityId: 4 }),
    leadDefaults({ id: 1, name: "Eva Qian", phone: "158****5005", phoneFull: "15850005005", company: "Personal", source: "电商", segment: "睡眠", interest: "褪黑素片", productId: 15, potential: 600, status: "无效", assignedTo: 3, ownerName: "Miles Chen", createdAt: "2026-08-18 16:50", closeReason: "询价后无预算" }),
  ];

  const followups = [
    { id: 1, leadId: 3, at: "2026-08-22 16:10", type: "电话", content: "确认门店两家，先看胶原蛋白小样。", next: "2026-08-28" },
    { id: 2, leadId: 3, at: "2026-08-28 11:05", type: "微信", content: "样品已寄出，约下周对报价。", next: "2026-08-30" },
    { id: 3, leadId: 2, at: "2026-08-21 09:40", type: "拜访", content: "经销商想先试销蛋白粉 200 罐。", next: "2026-08-27" },
    { id: 4, leadId: 1, at: "2026-08-19 10:20", type: "微信", content: "只问直播价，没有采购计划。", next: "" },
    { id: 5, leadId: 5, at: "2026-08-30 10:40", type: "电话", content: "俱乐部先问蛋白粉团购价。", next: "2026-09-03" },
    { id: 8, leadId: 9, at: "2026-08-08 10:30", type: "拜访", content: "老客介绍，确认胶原蛋白肽粉 60 盒、VIP 价。", next: "2026-08-12" },
    { id: 6, leadId: 8, at: "2026-08-20 14:10", type: "拜访", content: "展会后回访，要蛋白、维C、鱼油组合试销。", next: "2026-08-24" },
    { id: 7, leadId: 8, at: "2026-08-24 15:40", type: "电话", content: "确认三品项数量，转商机。", next: "2026-08-27" },
  ];

  const opportunities = [
    { id: 1, oppNo: "OPP-001", leadId: 9, customerId: 8, name: "Ruici · Collagen Q3", stage: "成交", amount: 13920, expected: "2026-08-15", ownerId: 1, winReason: "效果案例齐全，账期可接受", lossReason: "", closeDate: "2026-08-12" },
    { id: 4, oppNo: "OPP-004", leadId: 2, customerId: null, name: "Jiahe Trade · Protein", stage: "需求确认", amount: 88000, expected: "2026-09-20", ownerId: 1, winReason: "", lossReason: "" },
    { id: 5, oppNo: "OPP-005", leadId: 8, customerId: 1, name: "Kanglin · Q3 Mix", stage: "成交", amount: 13080, expected: "2026-08-27", ownerId: 1, winReason: "三品项组合下单，账期可接受", lossReason: "", closeDate: "2026-08-27" },
  ];

  /* 4 笔主线订单：
   * 001 已完成：商机成交 → Ruici VIP 胶原 60 → 出库 → 应收已回款 → 已开票
   * 002 已发货：天猫零售蛋白 4，应收待收款（电商账期 0，已逾期）
   * 003 审核通过·缺货：Kanglin 三行（蛋白 10 + 维 C 120 + 鱼油 10），维 C 行缺 80 → RP-001 → PO-002
   * 004 待审核：Kanglin 香草蛋白 10 + 可可蛋白 10，合计 4560，未分仓、未预占、无出库与应收
   */
  const salesOrders = [
    {
      id: 1, orderNo: "SO-202608-001", channel: "线下经销商", customerId: 8, productId: 8, qty: 60, unitPrice: 232, discount: 0,
      receiver: "Ruici Admin", phone: "136****4004", address: "上海市浦东新区张江路200号",
      warehouseId: 1, status: "已完成", source: "CRM成交", sourceId: 1, createdAt: "2026-08-12 16:40", needBy: "2026-08-18", amount: 13920,
    },
    {
      id: 2, orderNo: "SO-202608-002", channel: "电商", customerId: 5, productId: 1, qty: 4, unitPrice: 268, discount: 0,
      receiver: "Daisy Ding", phone: "151****7017", address: "青岛市市南区香港中路",
      warehouseId: 1, status: "已发货", source: "电商导入", sourceId: 0, createdAt: "2026-08-26 20:11", needBy: "2026-08-28", amount: 1072,
    },
    {
      id: 3, orderNo: "SO-202608-003", channel: "线下经销商", customerId: 1, productId: 1, qty: 140, unitPrice: 228, discount: 0,
      receiver: "Kanglin-Tom Zhang", phone: "138****1001", address: "杭州市余杭区仓前街道18号",
      warehouseId: 1, status: "审核通过", source: "CRM成交", sourceId: 5, createdAt: "2026-08-27 11:07", needBy: "2026-09-05", amount: 13080, shortage: true,
      lines: [
        { id: 1, lineNo: "SO-202608-003-01", productId: 1, qty: 10, unitPrice: 228, discount: 0, amount: 2280 },
        { id: 2, lineNo: "SO-202608-003-02", productId: 5, qty: 120, unitPrice: 76, discount: 0, amount: 9120 },
        { id: 3, lineNo: "SO-202608-003-03", productId: 7, qty: 10, unitPrice: 168, discount: 0, amount: 1680 },
      ],
    },
    {
      id: 4, orderNo: "SO-202608-004", channel: "线下经销商", customerId: 1, productId: 1, qty: 20, unitPrice: 228, discount: 0,
      receiver: "Kanglin-Tom Zhang", phone: "138****1001", address: "杭州市余杭区仓前街道18号",
      warehouseId: null, status: "待审核", source: "手工录入", sourceId: 0, createdAt: "2026-08-30 10:18", needBy: "2026-09-10", amount: 4560,
      lines: [
        { id: 1, productId: 1, qty: 10, unitPrice: 228, discount: 0, amount: 2280 },
        { id: 2, productId: 2, qty: 10, unitPrice: 228, discount: 0, amount: 2280 },
      ],
    },
  ];

  salesOrders.forEach((o) => {
    o.receivable = o.status === "已取消" || o.status === "已驳回" ? 0 : o.amount;
    if (!o.lines || !o.lines.length) {
      o.lines = [{
        id: 1,
        productId: o.productId,
        qty: o.qty,
        unitPrice: o.unitPrice,
        discount: o.discount || 0,
        amount: o.amount,
      }];
    }
  });
  const customerById = Object.fromEntries(customers.map((c) => [c.id, c]));
  salesOrders.forEach((o) => {
    o.channel = customerById[o.customerId]?.type || (o.channel === "电商" ? "电商" : "线下经销商");
  });

  const outbound = [
    { id: 1, outboundNo: "OUT-202608-001", orderId: 1, warehouseId: 1, productId: 8, batchNo: "B260601A", qty: 60, date: "2026-08-13", status: "已发货", logistics: "顺丰", tracking: "SF20260813021" },
    { id: 2, outboundNo: "OUT-202608-002", orderId: 2, warehouseId: 1, productId: 1, batchNo: "B260318A", qty: 4, date: "2026-08-27", status: "已发货", logistics: "顺丰", tracking: "SF20260827002" },
    { id: 3, outboundNo: "OUT-202608-003", orderId: 3, lineId: 2, warehouseId: 1, productId: 5, batchNo: "B260201A", qty: 40, date: "2026-08-27", status: "待出库", logistics: "", tracking: "" },
    { id: 4, outboundNo: "OUT-202608-004", orderId: 3, lineId: 1, warehouseId: 1, productId: 1, batchNo: "B260318A", qty: 10, date: "2026-08-27", status: "待出库", logistics: "", tracking: "" },
    { id: 5, outboundNo: "OUT-202608-005", orderId: 3, lineId: 3, warehouseId: 1, productId: 7, batchNo: "B251201A", qty: 10, date: "2026-08-27", status: "待出库", logistics: "", tracking: "" },
  ];

  const replenishments = [
    {
      id: 1, no: "RP-202608-001", orderId: 3, lineId: 2, lineNo: "SO-202608-003-02",
      productId: 5, demandQty: 120, availableQty: 40, shortageQty: 80,
      poId: 2, poLineId: 1, status: "已转采购", createdAt: "2026-08-27 15:10",
    },
  ];

  const receivables = [
    { id: 1, no: "AR-202608-001", orderId: 1, outboundId: 1, customerId: 8, amount: 13920, status: "已回款", dueDate: "2026-08-20" },
    { id: 2, no: "AR-202608-002", orderId: 2, outboundId: 2, customerId: 5, amount: 1072, status: "待收款", dueDate: "2026-08-27" },
  ];

  const payments = [
    { id: 1, no: "PAY-202608-001", customerId: 8, amount: 13920, date: "2026-08-20", method: "银行转账", account: "****6728", status: "已核销" },
  ];

  const reconciliations = [
    { id: 1, receivableId: 1, paymentId: 1, amount: 13920, date: "2026-08-20", status: "匹配成功", remark: "客户+金额一致" },
  ];

  const campaignCost = [
    { channel: "展会", acquireType: "线下活动", cost: 15000 },
    { channel: "广告", acquireType: "线上投放", cost: 26000 },
    { channel: "电商", acquireType: "线上投放", cost: 0 },
    { channel: "推荐", acquireType: "线下活动", cost: 0 },
  ];
  campaignCost.forEach((c) => { c.leads = leads.filter((l) => (l.source || l.channel) === c.channel).length; });

  const dailyMap = {};
  salesOrders.forEach((o) => {
    if (o.status === "已取消" || o.status === "已驳回") return;
    const key = (o.createdAt || "").slice(5, 10);
    if (!key) return;
    dailyMap[key] = (dailyMap[key] || 0) + o.amount;
  });
  const dailySales = ["08-24", "08-25", "08-26", "08-27", "08-28", "08-29", "08-30"].map((date) => ({
    date, amount: dailyMap[date] || 0,
  }));

  const payables = [
    { id: 1, no: "AP-202608-001", poId: 1, supplierId: 1, amount: 21504, status: "已付款", dueDate: "2026-09-03", invoiceNo: "FP-26081901", paidDate: "2026-08-25" },
  ];

  const auditLogs = [
    { id: 1, at: "2026-08-12 16:40", user: "Fiona Liu", role: "销售部", action: "商机成交下单", target: "SO-202608-001", detail: "LD-009 / OPP-001 转 Ruici 订单，胶原蛋白肽粉 60" },
    { id: 2, at: "2026-08-13 11:20", user: "Walter Wang", role: "供应链", action: "出库确认", target: "OUT-202608-001", detail: "扣减华东仓 B260601A × 60，关联 SO-202608-001" },
    { id: 3, at: "2026-08-19 14:20", user: "Walter Wang", role: "供应链", action: "采购收货", target: "PO-202608-001", detail: "验收合格 192，不合格 8 罐退货" },
    { id: 4, at: "2026-08-20 10:00", user: "Zoe Zhao", role: "财务部", action: "回款核销", target: "PAY-202608-001", detail: "匹配 AR-202608-001，金额 13920" },
    { id: 5, at: "2026-08-25 16:40", user: "Leo Li", role: "供应链", action: "盘点盘亏", target: "PD-202608-002", detail: "褪黑素临期抽检损耗 5" },
    { id: 6, at: "2026-08-27 09:40", user: "Walter Wang", role: "供应链", action: "出库确认", target: "OUT-202608-002", detail: "扣减华东仓 B260318A × 4，关联 SO-202608-002" },
    { id: 7, at: "2026-08-27 15:10", user: "系统", role: "系统", action: "库存预占", target: "SO-202608-003", detail: "按行预占：蛋白 10、维C 40、鱼油 10；SO-202608-003-02 缺 80 生成 RP-202608-001 → PO-202608-002" },
    { id: 8, at: "2026-08-18 16:50", user: "Marketing", role: "市场部", action: "录入线索", target: "Eva Qian", detail: "线上投放 · 市场录入" },
    { id: 9, at: "2026-08-19 10:20", user: "Fiona Liu", role: "销售部", action: "线索无效", target: "Eva Qian", detail: "询价后无预算" },
    { id: 10, at: "2026-08-20 11:30", user: "Marketing", role: "市场部", action: "录入线索", target: "Tom Gao", detail: "线下活动 · 市场录入" },
    { id: 11, at: "2026-08-22 10:05", user: "Marketing", role: "市场部", action: "录入线索", target: "Lisa Zhou", detail: "线上投放 · 市场录入" },
    { id: 12, at: "2026-08-22 16:10", user: "Fiona Liu", role: "销售部", action: "写跟进", target: "Lisa Zhou", detail: "确认门店两家，先看胶原蛋白小样。" },
    { id: 13, at: "2026-08-27 14:20", user: "Fiona Liu", role: "销售部", action: "线索转商机", target: "Jiahe Trade · Protein", detail: "Tom Gao" },
    { id: 15, at: "2026-08-30 09:12", user: "Marketing", role: "市场部", action: "录入线索", target: "Amy Chen", detail: "线上投放 · 市场录入" },
    { id: 17, at: "2026-08-04 14:08", user: "Marketing", role: "市场部", action: "录入线索", target: "Nina Li", detail: "线下活动 · 市场录入" },
    { id: 21, at: "2026-08-12 16:20", user: "Fiona Liu", role: "销售部", action: "线索转商机", target: "Ruici · Collagen Q3", detail: "Nina Li" },
    { id: 18, at: "2026-08-18 11:20", user: "Marketing", role: "市场部", action: "录入线索", target: "Tom Zhang", detail: "线下活动 · 市场录入" },
    { id: 19, at: "2026-08-24 15:40", user: "Fiona Liu", role: "销售部", action: "线索转商机", target: "Kanglin · Q3 Mix", detail: "Tom Zhang" },
    { id: 20, at: "2026-08-27 11:07", user: "Fiona Liu", role: "销售部", action: "商机成交下单", target: "SO-202608-003", detail: "OPP-005 三行 SKU，维C 行稍后缺货转补货" },
  ];

  const roles = [
    { id: "gm", account: "executive", name: "Executive", title: "总经办", modules: ["ai", "dashboard", "reports", "leads", "orders", "opps", "fulfillment", "pos", "products", "inventory", "fin-ar", "fin-ap", "fin-cost", "fin-ana"] },
    { id: "marketing", account: "marketing", name: "Marketing", title: "市场部", modules: ["leads", "reports"] },
    { id: "sales-lead", account: "sales", name: "Sales", title: "销售部", modules: ["leads", "opps", "orders", "reports"] },
    { id: "warehouse", account: "supply", name: "Supply", title: "供应链", modules: ["fulfillment", "pos", "products", "inventory", "reports"] },
    { id: "finance", account: "finance", name: "Finance", title: "财务部", modules: ["orders", "pos", "inventory", "fin-ar", "fin-ap", "fin-cost", "fin-ana", "reports"] },
  ];

  const settings = { nearDays: 30, banDays: 0 };

  const priceLists = [];
  products.filter((p) => p.status === 1).forEach((p) => {
    priceLists.push(
      { id: priceLists.length + 1, level: "经销商", productId: p.id, price: Math.round(p.price * 0.85) },
      { id: priceLists.length + 2, level: "VIP", productId: p.id, price: Math.round(p.price * 0.78) },
      { id: priceLists.length + 3, level: "零售", productId: p.id, price: p.price },
    );
  });

  const invoices = [
    { id: 1, no: "FP-202608-001", orderId: 1, customerId: 8, amount: 13920, tax: 1810, type: "普票", status: "已开具", date: "2026-08-20" },
  ];

  const quality = [
    { id: 1, no: "QC-202608-001", poId: 1, productId: 1, batchNo: "B260318A", qtyOk: 192, qtyNg: 8, result: "合格", inspector: "Wendy Wu", date: "2026-08-19", remark: "外包装破损 8 罐已隔离退货" },
    { id: 2, no: "QC-202608-002", poId: 0, productId: 15, batchNo: "B250910A", qtyOk: 0, qtyNg: 55, result: "不合格", inspector: "Wendy Wu", date: "2026-08-25", remark: "临期抽检外观异常，批次冻结" },
  ];

  const gsp = [
    { id: 1, type: "购进验收", ref: "PO-202608-001", sku: "FW-PRO-001", batchNo: "B260318A", qty: 192, user: "Walter Wang", at: "2026-08-19 14:20", note: "合格入库，不合格 8 罐退货" },
    { id: 2, type: "出库复核", ref: "OUT-202608-001", sku: "FW-COL-001", batchNo: "B260601A", qty: 60, user: "Walter Wang", at: "2026-08-13 11:20", note: "双人复核通过" },
    { id: 3, type: "出库复核", ref: "OUT-202608-002", sku: "FW-PRO-001", batchNo: "B260318A", qty: 4, user: "Walter Wang", at: "2026-08-27 09:40", note: "双人复核通过" },
    { id: 4, type: "在库养护", ref: "B250910A", sku: "FW-MEL-001", batchNo: "B250910A", qty: 55, user: "Leo Li", at: "2026-08-25 16:40", note: "临期抽检不合格，冻结" },
  ];

  const vouchers = [];
  const padJz = (n) => "JZ-202608-" + String(n).padStart(3, "0");
  receivables.forEach((ar) => {
    const so = salesOrders.find((o) => o.id === ar.orderId);
    const ob = outbound.find((x) => x.id === ar.outboundId);
    vouchers.push({
      id: vouchers.length + 1, no: padJz(vouchers.length + 1),
      date: ob?.date || (so?.createdAt || "").slice(0, 10),
      summary: "确认销售收入 " + (so?.orderNo || ""),
      debit: "应收账款", credit: "主营业务收入",
      amount: ar.amount, ref: ar.no, status: "已过账",
    });
  });
  reconciliations.filter((r) => r.status === "匹配成功").forEach((r) => {
    const pay = payments.find((p) => p.id === r.paymentId);
    const cust = customers.find((c) => c.id === pay?.customerId);
    vouchers.push({
      id: vouchers.length + 1, no: padJz(vouchers.length + 1),
      date: r.date,
      summary: "收到 " + (cust?.name || "") + " 货款",
      debit: "银行存款", credit: "应收账款",
      amount: r.amount, ref: pay?.no, status: "已过账",
    });
  });
  payables.forEach((ap) => {
    const po = purchaseOrders.find((p) => p.id === ap.poId);
    vouchers.push({
      id: vouchers.length + 1, no: padJz(vouchers.length + 1),
      date: po?.actualDate || po?.orderDate,
      summary: "采购入库 " + (po?.poNo || ""),
      debit: "库存商品", credit: "应付账款",
      amount: ap.amount, ref: ap.no, status: "已过账",
    });
    if (ap.status === "已付款") {
      vouchers.push({
        id: vouchers.length + 1, no: padJz(vouchers.length + 1),
        date: ap.paidDate,
        summary: "支付采购货款 " + ap.no,
        debit: "应付账款", credit: "银行存款",
        amount: ap.amount, ref: ap.no + "-pay", status: "已过账",
      });
    }
  });

  const outsource = [
    { id: 1, no: "WW-202608-001", factory: "Aowei", productId: 1, qty: 2000, planDate: "2026-09-20", status: "待放行", remark: "乳清蛋白粉委托生产，待成品检验放行" },
  ];

  return {
    company: { name: "Forvet", fullName: "Forvet Health (Shanghai)", skuCount: 100, warehouseCount: 3, salesChannels: ["电商", "线下经销商"] },
    warehouses,
    products,
    inventory,
    inventoryTx,
    suppliers,
    purchaseOrders,
    purchaseReturns,
    salesReturns,
    customers,
    sales,
    leads,
    opportunities,
    followups,
    salesOrders,
    replenishments,
    outbound,
    receivables,
    payments,
    reconciliations,
    payables,
    auditLogs,
    campaignCost,
    dailySales,
    roles,
    settings,
    priceLists,
    invoices,
    quality,
    gsp,
    vouchers,
    outsource,
  };
})();
