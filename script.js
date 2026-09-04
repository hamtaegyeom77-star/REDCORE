/* =========================================================
   REDCORE — site engine
   Static front-end only (GitHub Pages friendly).
   No calls are made to any /api/* backend from this file —
   orders are created and stored on-device (localStorage) so
   the shopping flow works fully on a static host.
   ========================================================= */

const PRODUCTS = [
 {id:"tee",name:"REDCORE T-SHIRT",price:49000,image:"images/tee.svg",desc:"REDCORE의 시그니처 그래픽을 담은 베이직 티셔츠.",category:"의류"},
 {id:"hoodie",name:"REDCORE HOODIE",price:89000,image:"images/hoodie.svg",desc:"도시적인 실루엣과 편안한 착용감의 헤비 후디.",category:"의류"},
 {id:"pants",name:"REDCORE PANTS",price:69000,image:"images/pants.svg",desc:"데일리 스타일링에 맞춘 스트레이트 팬츠.",category:"의류"},
 {id:"cap",name:"REDCORE CAP",price:39000,image:"images/cap.svg",desc:"REDCORE 로고 포인트 캡.",category:"액세서리"}
];

let cart = safeParse("redcore_cart", []);
let wishlist = safeParse("redcore_wishlist", []);
let orders = safeParse("redcore_orders", []);
let user = safeParse("redcore_user", null);
window.__redcoreSelectedSize = "M";

/* =========================================================
   MARKETPLACE DATA LAYER (Phase 1)
   ---------------------------------------------------------
   ⚠️ DEMO ONLY. Everything below is stored in the browser's
   localStorage, in plain text, with no authentication and no
   server. This is fine for prototyping UI/flows, but must
   NEVER be treated as a real seller/admin security model.
   Real settlement bank details, passwords, and business
   registration numbers must be collected and stored on a
   real backend with proper encryption/auth before this goes
   live. See README.md "마켓플레이스 확장 시 필요한 것" section.
   ========================================================= */

const CATEGORIES = ["의류","신발","가방","액세서리","라이프스타일","기타"];

let sellerApplications = safeParse("redcore_seller_applications", []);
let sellers = safeParse("redcore_sellers", []); // approved sellers derived from applications
let sellerProducts = safeParse("redcore_seller_products", []);
let commissionSettings = safeParse("redcore_commission_settings", {
  default: 10,
  categories: {"의류":10,"신발":10,"가방":10,"액세서리":10,"라이프스타일":10,"기타":10},
  sellerOverrides: {} // { [sellerId]: rate }
});
let commissionLog = safeParse("redcore_commission_log", []);
let sellerSession = safeParse("redcore_seller_session", null); // {sellerId, businessName}

function saveMarketplace(){
  localStorage.setItem("redcore_seller_applications", JSON.stringify(sellerApplications));
  localStorage.setItem("redcore_sellers", JSON.stringify(sellers));
  localStorage.setItem("redcore_seller_products", JSON.stringify(sellerProducts));
  localStorage.setItem("redcore_commission_settings", JSON.stringify(commissionSettings));
  localStorage.setItem("redcore_commission_log", JSON.stringify(commissionLog));
}
function saveSellerSession(){ localStorage.setItem("redcore_seller_session", JSON.stringify(sellerSession)); }

/* =========================================================
   INTERNAL PRODUCT MANAGEMENT (admin only)
   ---------------------------------------------------------
   REDCORE's actual business model: the admin (site owner)
   receives inventory from a supplier ("삼촌") and lists it for
   sale directly — this is NOT a self-service seller marketplace.
   Supply cost (공급가) and margin are admin-only figures and are
   NEVER included in any customer-facing render function below.
   ========================================================= */
let adminProducts = safeParse("redcore_admin_products", []); // products added by the admin beyond the original 4
let productCosts = safeParse("redcore_product_costs", {});   // { [productId]: 공급가(supply cost) } — admin-only
let productStock = safeParse("redcore_product_stock", {});   // { [productId]: 재고수량 } — null/unset = unlimited

function saveInventory(){
  localStorage.setItem("redcore_admin_products", JSON.stringify(adminProducts));
  localStorage.setItem("redcore_product_costs", JSON.stringify(productCosts));
  localStorage.setItem("redcore_product_stock", JSON.stringify(productStock));
}

function addAdminProduct(data){
  const product = {
    id: genId("PRD"),
    name: data.name,
    category: data.category || "기타",
    price: Number(data.price)||0,
    image: data.image || "images/hero.svg",
    description: data.description || "",
    visible: true,
    createdAt: new Date().toISOString()
  };
  adminProducts.push(product);
  productCosts[product.id] = Number(data.costPrice)||0;
  productStock[product.id] = data.stock!==undefined && data.stock!=="" ? Number(data.stock) : null;
  saveInventory();
  return product;
}
function deleteAdminProduct(id){
  adminProducts = adminProducts.filter(p=>p.id!==id);
  delete productCosts[id]; delete productStock[id];
  saveInventory();
}
function toggleAdminProductVisible(id){
  const p = adminProducts.find(x=>x.id===id); if(!p) return;
  p.visible = !p.visible;
  saveInventory();
}
function updateProductCost(productId, cost){ productCosts[productId] = Number(cost)||0; saveInventory(); }
function updateProductStock(productId, qty){ productStock[productId] = (qty===""||qty==null) ? null : Number(qty); saveInventory(); }

/* All products a customer can currently see (original 4 + visible admin-added items). */
function catalogProducts(){
  return PRODUCTS.concat(adminProducts.filter(p=>p.visible!==false));
}
/* Every product that exists in the system, for admin management (includes hidden). */
function allProductsForAdmin(){
  return PRODUCTS.concat(adminProducts);
}
function stockFor(productId){
  return productStock[productId]!=null ? Number(productStock[productId]) : null; // null = unlimited/not tracked
}
function decrementStock(productId, qty){
  const s = stockFor(productId);
  if(s!=null){ productStock[productId] = Math.max(0, s-Number(qty||0)); saveInventory(); }
}
function costFor(productId){ return productCosts[productId]!=null ? Number(productCosts[productId]) : null; }

/* 상품별/전체 판매 데이터: 매출, 원가, 예상이익, 판매량 — 실제 orders 데이터로 계산 (하드코딩 없음) */
function salesAnalytics(){
  const byProduct = {}; // id -> {name, qty, revenue, cost, costKnown}
  orders.forEach(o=>{
    (o.items||[]).forEach(i=>{
      const pid = i.productId; if(!pid) return;
      if(!byProduct[pid]) byProduct[pid] = { id:pid, name:i.name, qty:0, revenue:0, cost:0, costKnown:true };
      const row = byProduct[pid];
      row.qty += Number(i.quantity)||0;
      row.revenue += (Number(i.price)||0) * (Number(i.quantity)||0);
      const c = costFor(pid);
      if(c==null){ row.costKnown = false; }
      else { row.cost += c * (Number(i.quantity)||0); }
    });
  });
  const rows = Object.values(byProduct).map(r=>({...r, profit: r.costKnown ? r.revenue - r.cost : null}));
  const totals = rows.reduce((acc,r)=>{
    acc.qty += r.qty; acc.revenue += r.revenue;
    if(r.costKnown){ acc.cost += r.cost; acc.knownProfit += r.profit; } else { acc.hasUnknownCost = true; }
    return acc;
  }, {qty:0, revenue:0, cost:0, knownProfit:0, hasUnknownCost:false});
  return { rows, totals };
}


function genId(prefix){ return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`; }

/* REDCORE's own 4 products are treated as an "official" seller so
   the same data model covers both first-party and marketplace items. */
const OFFICIAL_SELLER_ID = "redcore-official";

/* --- 판매자 입점 신청 (Seller onboarding) --- */
function submitSellerApplication(data){
  const app = {
    id: genId("APP"),
    businessName: data.businessName,
    ownerName: data.ownerName,
    bizRegNo: data.bizRegNo,
    mailOrderNo: data.mailOrderNo,
    address: data.address,
    phone: data.phone,
    email: data.email,
    bankName: data.bankName,
    accountHolder: data.accountHolder,
    accountNoMasked: maskAccountNo(data.accountNo),
    username: data.username,
    status: "PENDING", // PENDING / APPROVED / REJECTED
    appliedAt: new Date().toISOString(),
    reviewedAt: null,
    rejectReason: null
  };
  sellerApplications.unshift(app);
  saveMarketplace();
  return app;
}
function maskAccountNo(v){
  const digits = String(v||"").replace(/\D/g,"");
  if(digits.length <= 4) return digits.replace(/./g,"*");
  return digits.slice(0,-4).replace(/./g,"*") + digits.slice(-4);
}

/* --- 관리자: 입점 심사 --- */
function approveSellerApplication(appId){
  const app = sellerApplications.find(a=>a.id===appId);
  if(!app) return;
  app.status="APPROVED"; app.reviewedAt=new Date().toISOString(); app.rejectReason=null;
  if(!sellers.find(s=>s.id===app.id)){
    sellers.push({
      id: app.id, businessName: app.businessName, ownerName: app.ownerName,
      username: app.username, email: app.email, phone: app.phone,
      status: "APPROVED", // APPROVED / SUSPENDED
      appliedAt: app.appliedAt
    });
  }
  saveMarketplace();
}
function rejectSellerApplication(appId, reason){
  const app = sellerApplications.find(a=>a.id===appId);
  if(!app) return;
  app.status="REJECTED"; app.reviewedAt=new Date().toISOString(); app.rejectReason=reason||"사유 미입력";
  saveMarketplace();
}
function suspendSeller(sellerId){
  const s = sellers.find(x=>x.id===sellerId); if(!s) return;
  s.status = s.status==="SUSPENDED" ? "APPROVED" : "SUSPENDED";
  saveMarketplace();
}

/* --- 판매자 로그인 (데모: 서버 인증 없음) --- */
function sellerLoginAttempt(username){
  const seller = sellers.find(s=>s.username===username && s.status==="APPROVED");
  if(seller){ sellerSession={sellerId:seller.id, businessName:seller.businessName}; saveSellerSession(); return {ok:true, seller}; }
  const pending = sellerApplications.find(a=>a.username===username);
  if(pending) return {ok:false, reason: pending.status==="PENDING" ? "심사 대기중입니다." : pending.status==="REJECTED" ? `입점이 반려되었습니다. 사유: ${pending.rejectReason||"-"}` : "승인된 판매자를 찾을 수 없습니다."};
  return {ok:false, reason:"등록된 판매자 아이디가 아닙니다."};
}
function sellerLogout(){ sellerSession=null; saveSellerSession(); location.href="seller-login.html"; }
function currentSeller(){ return sellerSession ? sellers.find(s=>s.id===sellerSession.sellerId) : null; }

/* --- 상품 등록 (판매자) --- */
function addSellerProduct(data){
  const seller = currentSeller(); if(!seller) return null;
  const product = {
    id: genId("PRD"),
    sellerId: seller.id,
    name: data.name,
    category: data.category,
    brand: data.brand,
    price: Number(data.price)||0,
    salePrice: data.salePrice ? Number(data.salePrice) : null,
    stock: Number(data.stock)||0,
    image: data.image || "images/hero.svg",
    description: data.description,
    sizeOptions: data.sizeOptions,
    colorOptions: data.colorOptions,
    shippingFee: Number(data.shippingFee)||0,
    freeShipping: !!data.freeShipping,
    shippingMethod: data.shippingMethod,
    originAddress: data.originAddress,
    returnAddress: data.returnAddress,
    exchangePolicy: data.exchangePolicy,
    returnPolicy: data.returnPolicy,
    infoDisclosure: data.infoDisclosure,
    status: "PENDING_REVIEW", // DRAFT / PENDING_REVIEW / APPROVED / REJECTED / SOLD_OUT / HIDDEN
    rejectReason: null,
    createdAt: new Date().toISOString()
  };
  sellerProducts.unshift(product);
  saveMarketplace();
  return product;
}
function approveSellerProduct(id){ const p=sellerProducts.find(x=>x.id===id); if(!p)return; p.status="APPROVED"; p.rejectReason=null; saveMarketplace(); }
function rejectSellerProduct(id, reason){ const p=sellerProducts.find(x=>x.id===id); if(!p)return; p.status="REJECTED"; p.rejectReason=reason||"사유 미입력"; saveMarketplace(); }
function hideSellerProduct(id){ const p=sellerProducts.find(x=>x.id===id); if(!p)return; p.status = p.status==="HIDDEN" ? "APPROVED" : "HIDDEN"; saveMarketplace(); }

/* --- 수수료 계산 --- */
function commissionRateFor(sellerId, category){
  if(commissionSettings.sellerOverrides && commissionSettings.sellerOverrides[sellerId]!=null) return Number(commissionSettings.sellerOverrides[sellerId]);
  if(commissionSettings.categories && commissionSettings.categories[category]!=null) return Number(commissionSettings.categories[category]);
  return Number(commissionSettings.default);
}
function calcSettlement(price, qty, sellerId, category){
  const rate = commissionRateFor(sellerId, category);
  const gross = price*qty;
  const fee = Math.round(gross*(rate/100));
  return { gross, rate, fee, net: gross-fee };
}
function updateCommissionSettings(next){
  commissionSettings = next;
  commissionLog.unshift({ at:new Date().toISOString(), settings: JSON.parse(JSON.stringify(next)) });
  saveMarketplace();
}

/* --- 판매자 통계 (SELLER CENTER 대시보드용) --- */
function sellerStats(sellerId){
  const myOrders = orders.filter(o=>Array.isArray(o.items) && o.items.some(i=>i.sellerId===sellerId));
  const todayStr = new Date().toDateString();
  const monthKey = d=>{const dt=new Date(d); return `${dt.getFullYear()}-${dt.getMonth()}`;};
  const thisMonth = monthKey(new Date());
  let todaySales=0, monthSales=0, settlementPending=0, settlementDone=0;
  const counts = {PAYMENT_PENDING:0,PAID:0,PREPARING:0,SHIPPED:0,DELIVERED:0,PURCHASE_CONFIRMED:0,CANCELLED:0,RETURNED:0,REFUNDED:0};
  myOrders.forEach(o=>{
    (o.items||[]).filter(i=>i.sellerId===sellerId).forEach(i=>{
      const settle = calcSettlement(i.price, i.quantity, sellerId, i.category);
      const created = new Date(o.createdAt||Date.now());
      if(created.toDateString()===todayStr) todaySales += settle.gross;
      if(monthKey(o.createdAt)===thisMonth) monthSales += settle.gross;
      if(o.status==="PURCHASE_CONFIRMED") settlementDone += settle.net; else settlementPending += settle.net;
    });
    if(counts[o.status]!=null) counts[o.status]++;
  });
  return { orderCount: myOrders.length, todaySales, monthSales, settlementPending, settlementDone, counts };
}

/* --- 마켓플레이스 상품 통합 조회 (공식 4개 + 승인된 입점 상품) --- */
function marketplaceProducts(){
  const official = PRODUCTS.map(p=>({...p, sellerId:OFFICIAL_SELLER_ID, sellerName:"REDCORE", status:"APPROVED"}));
  const thirdParty = sellerProducts.filter(p=>p.status==="APPROVED").map(p=>({...p, sellerName:(sellers.find(s=>s.id===p.sellerId)||{}).businessName||"판매자"}));
  return official.concat(thirdParty);
}


function safeParse(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw===null) return fallback;
    const val = JSON.parse(raw);
    return val===null || val===undefined ? fallback : val;
  }catch(_){ return fallback; }
}

const won = n => Number(n||0).toLocaleString("ko-KR")+"원";
const findProduct = id => PRODUCTS.find(p=>p.id===id) || adminProducts.find(p=>p.id===id && p.visible!==false);

function save(){
  localStorage.setItem("redcore_cart",JSON.stringify(cart));
  localStorage.setItem("redcore_wishlist",JSON.stringify(wishlist));
  localStorage.setItem("redcore_orders",JSON.stringify(orders));
  updateCount();
}
function updateCount(){ const n=cart.reduce((s,i)=>s+Number(i.qty||0),0); document.querySelectorAll(".count").forEach(x=>x.textContent=n); }
function toast(msg){ let t=document.querySelector(".toast"); if(!t)return; t.textContent=msg;t.classList.add("show"); clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2200); }

function addToCart(id,size=window.__redcoreSelectedSize||"M"){
 const p=findProduct(id); if(!p)return;
 const stock=stockFor(id);
 if(stock===0){ toast("품절된 상품입니다."); return; }
 const item=cart.find(i=>i.id===id&&i.size===size);
 if(item)item.qty++; else cart.push({id,qty:1,size});
 save(); toast(`${p.name} / ${size} 사이즈가 장바구니에 추가되었습니다.`);
}
function buyNow(id){ addToCart(id,window.__redcoreSelectedSize||"M"); location.href="cart.html"; }
function toggleWish(id){ if(wishlist.includes(id)) wishlist=wishlist.filter(x=>x!==id); else wishlist.push(id); save(); renderShop(); renderProduct(); renderWishlist(); toast(wishlist.includes(id)?"찜 목록에 추가되었습니다.":"찜 목록에서 삭제했습니다."); }
function cartSubtotal(){return cart.reduce((s,i)=>{const p=findProduct(i.id);return s+(p?p.price*Number(i.qty):0)},0)}
function shippingFee(){return cartSubtotal()>=50000||cartSubtotal()===0?0:3000}
function cartTotal(){return cartSubtotal()+shippingFee()}
function changeQty(id,size,delta){ const x=cart.find(i=>i.id===id&&i.size===size); if(!x)return; x.qty+=delta;if(x.qty<=0)cart=cart.filter(i=>!(i.id===id&&i.size===size));save();renderCart(); }
function removeItem(id,size){cart=cart.filter(i=>!(i.id===id&&i.size===size));save();renderCart();toast("상품을 삭제했습니다.");}

function productCard(p){
  const liked=wishlist.includes(p.id);
  const stock=stockFor(p.id);
  const soldOut = stock===0;
  return `<article class="product-card${soldOut?" sold-out":""}"><button class="heart" type="button" aria-label="${p.name} 찜하기" onclick="toggleWish('${p.id}')">${liked?"♥":"♡"}</button><a href="product.html?id=${p.id}"><div class="pic"><img src="${p.image}" alt="${p.name}" loading="lazy">${soldOut?'<span class="sold-out-badge">SOLD OUT</span>':""}</div></a><div class="product-meta"><a href="product.html?id=${p.id}"><h3>${p.name}</h3></a><p>${won(p.price)}</p></div>${soldOut?"":`<button class="quick-add" type="button" onclick="addToCart('${p.id}');event.stopPropagation();">+ ADD TO CART</button>`}</article>`;
}
function renderHome(){const el=document.querySelector("#home-products");if(el)el.innerHTML=catalogProducts().slice(0,4).map(productCard).join("");}

let shopFilters = { query:"", category:"ALL", sort:"default" };
function shopCategoryList(){
  const cats = Array.from(new Set(catalogProducts().map(p=>p.category).filter(Boolean)));
  return cats;
}
function applyShopFilters(list){
  let out = list;
  if(shopFilters.category && shopFilters.category!=="ALL") out = out.filter(p=>p.category===shopFilters.category);
  if(shopFilters.query){
    const q = shopFilters.query.trim().toLowerCase();
    if(q) out = out.filter(p=>(p.name||"").toLowerCase().includes(q) || (p.description||p.desc||"").toLowerCase().includes(q));
  }
  const soldOutRank = p => stockFor(p.id)===0 ? 1 : 0;
  const sorters = {
    default: (a,b)=> soldOutRank(a)-soldOutRank(b),
    priceLow: (a,b)=> soldOutRank(a)-soldOutRank(b) || a.price-b.price,
    priceHigh: (a,b)=> soldOutRank(a)-soldOutRank(b) || b.price-a.price,
    newest: (a,b)=> soldOutRank(a)-soldOutRank(b) || new Date(b.createdAt||0)-new Date(a.createdAt||0)
  };
  return [...out].sort(sorters[shopFilters.sort] || sorters.default);
}
function renderShop(){
  const el=document.querySelector("#shop-products");
  if(!el) return;
  const filtered = applyShopFilters(catalogProducts());
  el.innerHTML = filtered.length ? filtered.map(productCard).join("") : `<div class="shop-empty-hint">"${escapeAttr(shopFilters.query)}"에 대한 검색 결과가 없습니다. 다른 검색어나 카테고리를 선택해보세요.</div>`;
  const chipsEl = document.querySelector("#shop-category-chips");
  if(chipsEl){
    const cats = ["ALL", ...shopCategoryList()];
    chipsEl.innerHTML = cats.map(c=>`<button type="button" class="filter${shopFilters.category===c?" active":""}" data-cat="${escapeAttr(c)}">${c==="ALL"?"전체":c}</button>`).join("");
    chipsEl.querySelectorAll("[data-cat]").forEach(btn=>btn.addEventListener("click",()=>{ shopFilters.category=btn.dataset.cat; renderShop(); }));
  }
  const countEl = document.querySelector("#shop-result-count");
  if(countEl) countEl.textContent = `${filtered.length}개 상품`;
}
function escapeAttr(v){ return String(v??"").replace(/"/g,"&quot;"); }
function initShopToolbar(){
  const searchInput = document.querySelector("#shop-search-input");
  const sortSelect = document.querySelector("#shop-sort-select");
  if(searchInput) searchInput.addEventListener("input", ()=>{ shopFilters.query = searchInput.value; renderShop(); });
  if(sortSelect) sortSelect.addEventListener("change", ()=>{ shopFilters.sort = sortSelect.value; renderShop(); });
}

function renderProduct(){
 const el=document.querySelector("#product-root");if(!el)return;
 const id=new URLSearchParams(location.search).get("id")||"tee",p=findProduct(id)||PRODUCTS[0],liked=wishlist.includes(p.id);
 const stock=stockFor(p.id);
 const soldOut = stock===0;
 const stockLabel = soldOut ? "SOLD OUT" : (stock!=null ? `${stock}개 남음` : "AVAILABLE");
 el.innerHTML=`<div class="detail"><div class="detail-media"><div class="detail-image"><img id="product-main-image" src="${p.image}" alt="${p.name} 제품 이미지"></div></div><div class="detail-info"><div class="eyebrow">REDCORE / 2026 SPRING</div><h1>${p.name}</h1><div class="price">${won(p.price)}</div><p class="description">${p.desc||p.description||""}<br>일상 속에서 자연스럽게 개성을 드러내도록 설계했습니다.</p><div class="options"><div class="option-row"><span id="size-label">SIZE</span><div class="option-buttons" role="group" aria-labelledby="size-label">${["S","M","L","XL"].map(size=>`<button type="button" class="size ${size===window.__redcoreSelectedSize?"selected":""}" aria-pressed="${size===window.__redcoreSelectedSize?"true":"false"}" onclick="selectProductSize(this,'${size}')">${size}</button>`).join("")}</div></div><div class="option-row"><span>STOCK</span><span>${stockLabel}</span></div></div><div class="detail-actions"><button type="button" class="btn outline wide" onclick="toggleWish('${p.id}')">${liked?"♥ WISHLIST":"♡ WISHLIST"}</button><button type="button" class="btn wide" ${soldOut?"disabled":""} onclick="addToCart('${p.id}')">${soldOut?"SOLD OUT":"ADD TO CART"}</button></div><button type="button" class="btn wide" style="margin-top:8px" ${soldOut?"disabled":""} onclick="buyNow('${p.id}')">BUY NOW</button></div></div>`;
 renderBreadcrumb("breadcrumb", [{label:"HOME",href:"index.html"},{label:"SHOP",href:"shop.html"},{label:p.name}]);
}
function selectProductSize(button,size){document.querySelectorAll(".size").forEach(x=>{x.classList.remove("selected");x.setAttribute("aria-pressed","false");});button.classList.add("selected");button.setAttribute("aria-pressed","true");window.__redcoreSelectedSize=size;}

function renderCart(){
 const el=document.querySelector("#cart-root");if(!el)return;
 if(!cart.length){el.innerHTML=`<div class="empty"><span class="empty-icon">🛒</span><p>장바구니가 비어 있습니다.</p><a class="btn" href="shop.html" style="margin-top:20px">SHOP NOW</a></div>`;return;}
 el.innerHTML=`${cart.map(i=>{const p=findProduct(i.id);if(!p)return "";return `<div class="cart-row"><img src="${p.image}" alt="${p.name}"><div><b>${p.name}</b><div class="muted" style="font-size:10px;margin-top:4px">SIZE ${i.size||"M"} · ${won(p.price)}</div></div><div class="qty"><button type="button" aria-label="수량 감소" onclick="changeQty('${p.id}','${i.size||"M"}',-1)">−</button><span aria-live="polite">${i.qty}</span><button type="button" aria-label="수량 증가" onclick="changeQty('${p.id}','${i.size||"M"}',1)">+</button></div><strong class="line-total">${won(p.price*i.qty)}</strong><button type="button" class="remove" onclick="removeItem('${p.id}','${i.size||"M"}')">삭제</button></div>`}).join("")}<div class="cart-summary"><div class="summary-line"><span>상품 금액</span><b>${won(cartSubtotal())}</b></div><div class="summary-line"><span>배송비</span><span>${shippingFee()===0?"무료":won(shippingFee())}</span></div><div class="summary-line summary-total"><span>TOTAL</span><b>${won(cartTotal())}</b></div><a href="order.html" class="btn wide" style="margin-top:18px">CHECKOUT</a></div>`;
}
function renderWishlist(){const el=document.querySelector("#wishlist-root");if(!el)return;const ps=wishlist.map(findProduct).filter(Boolean);el.innerHTML=ps.length?`<div class="product-grid">${ps.map(productCard).join("")}</div>`:`<div class="empty"><span class="empty-icon">♡</span>찜한 상품이 없습니다.<br><a class="btn" href="shop.html" style="margin-top:16px">SHOP NOW</a></div>`;}
function renderOrderSummary(){
  const el=document.querySelector("#order-summary");
  if(!el) return;
  if(!cart.length){ el.innerHTML = `<div class="empty" style="padding:40px 16px"><span class="empty-icon">🛒</span>장바구니가 비어 있습니다.<br><a class="btn" href="shop.html" style="margin-top:16px">SHOP NOW</a></div>`; return; }
  el.innerHTML = `<h3 style="font-size:13px;margin-bottom:16px">주문 상품 (${cart.reduce((s,i)=>s+Number(i.qty||0),0)})</h3>
    ${cart.map(i=>{const p=findProduct(i.id); if(!p) return ""; return `<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><img src="${p.image}" alt="${p.name}" style="width:52px;height:52px;object-fit:cover;border-radius:var(--radius-sm);background:#eee"><div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:700">${p.name}</div><div class="muted" style="font-size:10.5px">SIZE ${i.size||"M"} · 수량 ${i.qty}</div></div><div style="font-size:11.5px;font-weight:700">${won(p.price*i.qty)}</div></div>`}).join("")}
    <div class="summary-line"><span>상품 금액</span><b>${won(cartSubtotal())}</b></div>
    <div class="summary-line"><span>배송비</span><span>${shippingFee()===0?"무료":won(shippingFee())}</span></div>
    <div class="summary-line summary-total"><span>TOTAL</span><b>${won(cartTotal())}</b></div>`;
}
function renderOrders(){const el=document.querySelector("#orders-root");if(!el)return;el.innerHTML=orders.length?orders.map(o=>`<div class="notice-row"><span>${o.date}</span><b>${o.id}</b><span>${won(o.total)}</span></div>`).join(""):`<div class="empty"><span class="empty-icon">📦</span>주문 내역이 없습니다.<br><a class="btn" href="shop.html" style="margin-top:16px">SHOP NOW</a></div>`;}
function renderMypage(){const name=document.querySelector("#member-name");if(name)name.textContent=user?.name||"GUEST";const ordersEl=document.querySelector("#order-count");if(ordersEl)ordersEl.textContent=orders.length;const guestPrompt=document.querySelector("#guest-login-prompt");if(guestPrompt)guestPrompt.style.display=user?"none":"";}

/* Local order-number generator: RC-YYYYMMDD-XXXX (no backend needed) */
function generateOrderId(){
  const d=new Date();
  const ymd=d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  const rand=Math.random().toString(36).slice(2,6).toUpperCase();
  return `RC-${ymd}-${rand}`;
}

function bindForms(){
 const login=document.querySelector("#login-form");
 if(login)login.addEventListener("submit",e=>{e.preventDefault();const id=login.id.value.trim();if(!id)return toast("아이디를 입력해주세요.");user={name:id};localStorage.setItem("redcore_user",JSON.stringify(user));toast("로그인되었습니다.");setTimeout(()=>location.href="mypage.html",400)});

 const signup=document.querySelector("#signup-form");
 if(signup)signup.addEventListener("submit",e=>{e.preventDefault();const name=signup.name.value.trim(),pw=signup.password.value;if(!name||!pw)return toast("필수 정보를 입력해주세요.");user={name,id:signup.id.value};localStorage.setItem("redcore_user",JSON.stringify(user));toast("회원가입이 완료되었습니다.");setTimeout(()=>location.href="mypage.html",500)});

 const order=document.querySelector("#order-form");
 if(order)order.addEventListener("submit",e=>{
  e.preventDefault();
  if(!cart.length)return toast("장바구니가 비어 있습니다.");
  const customer={name:order.name.value.trim(),phone:order.phone.value.trim(),address:order.address.value.trim(),memo:order.memo.value.trim()};
  if(!customer.name||!customer.address)return toast("주문자 정보를 확인해주세요.");
  if(!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(customer.phone.replace(/\s/g,"")))return toast("휴대폰 번호를 확인해주세요.");

  const items=cart.map(i=>{const p=findProduct(i.id);return {productId:i.id,name:p?p.name:i.id,size:i.size||"M",quantity:Number(i.qty),price:Number(p?p.price:0),sellerId:(p&&p.sellerId)||OFFICIAL_SELLER_ID,category:(p&&p.category)||"기타"}});
  const btn=order.querySelector("button[type=submit], button:not([type])");
  if(btn){btn.disabled=true;btn.textContent="PROCESSING...";}

  /* This site runs as a static page (GitHub Pages), so there is no
     live payment/order server to call. The order is created and
     stored locally so the checkout flow works end-to-end. To connect
     a real PG/backend later, replace this block with an API call —
     see /optional-backend-reference for a starter Node/Express API
     that accepts the same {items, customer} shape. */
  setTimeout(()=>{
    const newOrder={
      id:generateOrderId(),
      items,
      customer,
      subtotal:cartSubtotal(),
      shipping:shippingFee(),
      total:cartTotal(),
      status:"PAYMENT_PENDING",
      date:new Date().toLocaleDateString("ko-KR"),
      createdAt:new Date().toISOString()
    };
    orders.unshift(newOrder);
    items.forEach(i=>decrementStock(i.productId, i.quantity));
    cart=[];
    save();
    location.href="complete.html?no="+encodeURIComponent(newOrder.id);
  },350);
 });

 document.querySelectorAll(".faq-item").forEach(x=>{
   x.setAttribute("tabindex","0");
   x.setAttribute("role","button");
   const q = x.querySelector(".faq-q");
   if(q) x.setAttribute("aria-expanded","false");
   const toggle=()=>{x.classList.toggle("open");if(q)x.setAttribute("aria-expanded",x.classList.contains("open")?"true":"false");};
   x.addEventListener("click",toggle);
   x.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}});
 });
}

/* =========================================================
   Cookie / local-storage notice
   ========================================================= */
function initCookieNotice(){
  if(localStorage.getItem("redcore_cookie_consent")) return;
  const bar=document.createElement("div");
  bar.className="cookie-bar";
  bar.setAttribute("role","dialog");
  bar.setAttribute("aria-label","쿠키 및 저장 기능 안내");
  bar.innerHTML=`<p>REDCORE는 사이트 이용 편의를 위해 쿠키 및 로컬 저장 기능을 사용합니다. 자세한 내용은 <a href="privacy.html">개인정보처리방침</a>에서 확인할 수 있습니다.</p><div class="cookie-actions"><button type="button" class="btn outline" data-consent="declined">비동의</button><button type="button" class="btn" data-consent="accepted">동의</button></div>`;
  document.body.appendChild(bar);
  requestAnimationFrame(()=>bar.classList.add("show"));
  bar.addEventListener("click",e=>{
    const btn=e.target.closest("button[data-consent]");
    if(!btn)return;
    localStorage.setItem("redcore_cookie_consent",btn.dataset.consent);
    bar.classList.remove("show");
    setTimeout(()=>bar.remove(),300);
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  updateCount();renderHome();renderShop();renderProduct();renderCart();renderWishlist();renderOrders();renderMypage();renderOrderSummary();bindForms();initShopToolbar();

  /* Mobile nav drawer: open/close via button, backdrop click, or Escape */
  const menu=document.querySelector(".menu-btn"),header=document.querySelector(".header");
  function closeMenu(){ if(!header) return; header.classList.remove("menu-open"); if(menu) menu.setAttribute("aria-expanded","false"); document.querySelector(".nav-backdrop")?.classList.remove("show"); }
  function openMenu(){ if(!header) return; header.classList.add("menu-open"); if(menu) menu.setAttribute("aria-expanded","true"); document.querySelector(".nav-backdrop")?.classList.add("show"); }
  if(menu&&header){
    if(!document.querySelector(".nav-backdrop")){
      const backdrop=document.createElement("div"); backdrop.className="nav-backdrop";
      backdrop.addEventListener("click",closeMenu);
      document.body.appendChild(backdrop);
    }
    menu.addEventListener("click",()=>{ header.classList.contains("menu-open") ? closeMenu() : openMenu(); });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeMenu(); });
    document.querySelectorAll(".nav a").forEach(a=>a.addEventListener("click",closeMenu));
  }

  /* Active nav link + header scroll shadow */
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(a=>{
    const href=(a.getAttribute("href")||"").split("?")[0];
    if(href===current || (current==="" && href==="index.html")) a.classList.add("active");
  });
  if(header){
    const onScroll=()=>header.classList.toggle("scrolled", window.scrollY>8);
    onScroll();
    window.addEventListener("scroll", onScroll, {passive:true});
  }

  initCookieNotice();
});

/* Simple breadcrumb renderer: items = [{label, href?}], last item has no href (current page) */
function renderBreadcrumb(containerId, items){
  const el = document.querySelector("#"+containerId);
  if(!el) return;
  el.innerHTML = items.map((it,i)=>{
    const isLast = i===items.length-1;
    const seg = isLast ? `<span class="current">${it.label}</span>` : `<a href="${it.href}">${it.label}</a>`;
    return i===0 ? seg : `<span class="sep">/</span>${seg}`;
  }).join("");
}

/* =========================================================
   Page transitions (single implementation, used on every page)
   - Never animates the very first paint (prevents white flash)
   - Handles back/forward (bfcache) cleanly via pageshow
   ========================================================= */
(function(){
  const overlay=document.createElement("div");
  overlay.id="rc-page-transition";
  document.documentElement.appendChild(overlay);

  window.addEventListener("pageshow",function(){
    overlay.classList.remove("on");
    document.body.style.opacity="1";
  });

  document.addEventListener("click",function(e){
    const a=e.target.closest("a");
    if(!a) return;
    const href=a.getAttribute("href");
    if(!href || href[0]==="#" || href.startsWith("mailto:") ||
       href.startsWith("tel:") || a.target==="_blank" ||
       e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    try{
      const u=new URL(href,location.href);
      if(u.origin!==location.origin) return;
      e.preventDefault();
      overlay.classList.add("on");
      setTimeout(function(){location.href=u.href;},210);
    }catch(_){}
  });

  window.addEventListener("pagehide",function(){
    overlay.classList.remove("on");
  });
})();
