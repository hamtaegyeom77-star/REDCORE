const PRODUCTS = [
 {id:"tee",name:"REDCORE T-SHIRT",price:49000,image:"images/tee-main.jpg",gallery:["images/tee-main.jpg","images/tee-model.jpg"],desc:"REDCORE의 시그니처 그래픽을 담은 베이직 티셔츠."},
 {id:"hoodie",name:"REDCORE HOODIE",price:89000,image:"images/hoodie.svg",desc:"도시적인 실루엣과 편안한 착용감의 헤비 후디."},
 {id:"pants",name:"REDCORE PANTS",price:69000,image:"images/pants.svg",desc:"데일리 스타일링에 맞춘 스트레이트 팬츠."},
 {id:"cap",name:"REDCORE CAP",price:39000,image:"images/cap.svg",desc:"REDCORE 로고 포인트 캡."}
];

const API_BASE = location.protocol === "file:" ? "http://localhost:3000" : "";
let cart = JSON.parse(localStorage.getItem("redcore_cart") || "[]");
let wishlist = JSON.parse(localStorage.getItem("redcore_wishlist") || "[]");
let orders = JSON.parse(localStorage.getItem("redcore_orders") || "[]");
let user = JSON.parse(localStorage.getItem("redcore_user") || "null");
window.__redcoreSelectedSize = "M";

const won = n => Number(n).toLocaleString("ko-KR")+"원";
const findProduct = id => PRODUCTS.find(p=>p.id===id);
function save(){ localStorage.setItem("redcore_cart",JSON.stringify(cart)); localStorage.setItem("redcore_wishlist",JSON.stringify(wishlist)); localStorage.setItem("redcore_orders",JSON.stringify(orders)); updateCount(); }
function updateCount(){ const n=cart.reduce((s,i)=>s+Number(i.qty||0),0); document.querySelectorAll(".count").forEach(x=>x.textContent=n); }
function toast(msg){ let t=document.querySelector(".toast"); if(!t)return; t.textContent=msg;t.classList.add("show"); clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2200); }
function addToCart(id,size=window.__redcoreSelectedSize||"M"){
 const p=findProduct(id); if(!p)return;
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
function productCard(p){ const liked=wishlist.includes(p.id); return `<article class="product-card"><button class="heart" aria-label="찜" onclick="toggleWish('${p.id}')">${liked?"♥":"♡"}</button><a href="product.html?id=${p.id}"><div class="pic"><img src="${p.image}" alt="${p.name}"></div></a><div class="product-meta"><a href="product.html?id=${p.id}"><h3>${p.name}</h3></a><p>${won(p.price)}</p></div></article>`; }
function renderHome(){const el=document.querySelector("#home-products");if(el)el.innerHTML=PRODUCTS.slice(0,4).map(productCard).join("");}
function renderShop(){const el=document.querySelector("#shop-products");if(el)el.innerHTML=PRODUCTS.map(productCard).join("");}
function renderProduct(){
 const el=document.querySelector("#product-root");if(!el)return;
 const id=new URLSearchParams(location.search).get("id")||"tee",p=findProduct(id)||PRODUCTS[0],liked=wishlist.includes(p.id);
 const gallery=p.gallery||[p.image];
 el.innerHTML=`<div class="detail"><div class="detail-media"><div class="detail-image"><img id="product-main-image" src="${gallery[0]}" alt="${p.name} 제품 이미지"></div>${gallery.length>1?`<div class="product-thumbs">${gallery.map((src,i)=>`<button class="product-thumb ${i===0?"active":""}" type="button" onclick="selectProductImage(${i})"><img src="${src}" alt="${p.name} ${i===0?"제품 단독":"모델 착용"} 이미지"></button>`).join("")}</div>`:""}</div><div class="detail-info"><div class="eyebrow">REDCORE / 2026 SPRING</div><h1>${p.name}</h1><div class="price">${won(p.price)}</div><p class="description">${p.desc}<br>일상 속에서 자연스럽게 개성을 드러내도록 설계했습니다.</p><div class="options"><div class="option-row"><span>SIZE</span><div class="option-buttons">${["S","M","L","XL"].map(size=>`<button type="button" class="size ${size===window.__redcoreSelectedSize?"selected":""}" onclick="selectProductSize(this,'${size}')">${size}</button>`).join("")}</div></div><div class="option-row"><span>STOCK</span><span>AVAILABLE</span></div></div><div class="detail-actions"><button class="btn outline wide" onclick="toggleWish('${p.id}')">${liked?"♥ WISHLIST":"♡ WISHLIST"}</button><button class="btn wide" onclick="addToCart('${p.id}')">ADD TO CART</button></div><button class="btn wide" style="margin-top:8px" onclick="buyNow('${p.id}')">BUY NOW</button>${p.id==="tee"?`<div class="product-note"><b>REDCORE T-SHIRT</b><span>첫 번째는 제품 단독컷, 두 번째는 모델 착용컷입니다.</span></div>`:""}</div></div>`;
}
function selectProductImage(index){const main=document.querySelector("#product-main-image"),thumbs=document.querySelectorAll(".product-thumb");if(!main||!thumbs[index])return;const img=thumbs[index].querySelector("img");main.src=img.src;main.alt=img.alt;thumbs.forEach((x,i)=>x.classList.toggle("active",i===index));}
function selectProductSize(button,size){document.querySelectorAll(".size").forEach(x=>x.classList.remove("selected"));button.classList.add("selected");window.__redcoreSelectedSize=size;}
function renderCart(){
 const el=document.querySelector("#cart-root");if(!el)return;
 if(!cart.length){el.innerHTML=`<div class="empty"><p>장바구니가 비어 있습니다.</p><a class="btn" href="shop.html" style="margin-top:20px">SHOP NOW</a></div>`;return;}
 el.innerHTML=`${cart.map(i=>{const p=findProduct(i.id);return `<div class="cart-row"><img src="${p.image}" alt="${p.name}"><div><b>${p.name}</b><div class="muted" style="font-size:10px;margin-top:4px">SIZE ${i.size||"M"} · ${won(p.price)}</div></div><div class="qty"><button onclick="changeQty('${p.id}','${i.size||"M"}',-1)">−</button><span>${i.qty}</span><button onclick="changeQty('${p.id}','${i.size||"M"}',1)">+</button></div><strong class="line-total">${won(p.price*i.qty)}</strong><button class="remove" onclick="removeItem('${p.id}','${i.size||"M"}')">삭제</button></div>`}).join("")}<div class="cart-summary"><div class="summary-line"><span>상품 금액</span><b>${won(cartSubtotal())}</b></div><div class="summary-line"><span>배송비</span><span>${shippingFee()===0?"무료":won(shippingFee())}</span></div><div class="summary-line summary-total"><span>TOTAL</span><b>${won(cartTotal())}</b></div><a href="order.html" class="btn wide" style="margin-top:18px">CHECKOUT</a></div>`;
}
function renderWishlist(){const el=document.querySelector("#wishlist-root");if(!el)return;const ps=wishlist.map(findProduct).filter(Boolean);el.innerHTML=ps.length?`<div class="product-grid">${ps.map(productCard).join("")}</div>`:`<div class="empty">찜한 상품이 없습니다.</div>`;}
function renderOrders(){const el=document.querySelector("#orders-root");if(!el)return;el.innerHTML=orders.length?orders.map(o=>`<div class="notice-row"><span>${o.date}</span><b>${o.number}</b><span>${won(o.total)}</span></div>`).join(""):`<div class="empty">주문 내역이 없습니다.</div>`;}
function renderMypage(){const name=document.querySelector("#member-name");if(name)name.textContent=user?.name||"GUEST";const ordersEl=document.querySelector("#order-count");if(ordersEl)ordersEl.textContent=orders.length;}
function bindForms(){
 const login=document.querySelector("#login-form"); if(login)login.addEventListener("submit",e=>{e.preventDefault();const id=login.id.value.trim();if(!id)return toast("아이디를 입력해주세요.");user={name:id};localStorage.setItem("redcore_user",JSON.stringify(user));toast("로그인되었습니다.");setTimeout(()=>location.href="mypage.html",400)});
 const signup=document.querySelector("#signup-form"); if(signup)signup.addEventListener("submit",e=>{e.preventDefault();const name=signup.name.value.trim(),pw=signup.password.value;if(!name||!pw)return toast("필수 정보를 입력해주세요.");user={name,id:signup.id.value};localStorage.setItem("redcore_user",JSON.stringify(user));toast("회원가입이 완료되었습니다.");setTimeout(()=>location.href="mypage.html",500)});
 const order=document.querySelector("#order-form");
 if(order)order.addEventListener("submit",async e=>{
  e.preventDefault(); if(!cart.length)return toast("장바구니가 비어 있습니다.");
  const customer={name:order.name.value.trim(),phone:order.phone.value.trim(),address:order.address.value.trim(),memo:order.memo.value.trim()};
  if(!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(customer.phone.replace(/\s/g,"")))return toast("휴대폰 번호를 확인해주세요.");
  const items=cart.map(i=>{const p=findProduct(i.id);return {productId:i.id,name:p?.name||i.id,size:i.size||"M",quantity:Number(i.qty),price:Number(p?.price||0)}});
  const btn=order.querySelector("button[type=submit]");if(btn){btn.disabled=true;btn.textContent="PROCESSING...";}
  try{const r=await fetch(API_BASE+"/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items,customer})});const data=await r.json();if(!r.ok)throw new Error(data.error||"주문 생성에 실패했습니다.");const total=Number(data.order.total);orders.unshift({number:data.order.id,date:new Date(data.order.createdAt).toLocaleDateString("ko-KR"),total,status:data.order.status});cart=[];save();location.href="complete.html?no="+encodeURIComponent(data.order.id);}catch(err){if(btn){btn.disabled=false;btn.textContent="PLACE ORDER";}const msg=err instanceof TypeError?"주문 서버에 연결할 수 없습니다. REDCORE_START.bat로 서버를 먼저 실행해주세요.":(err.message||"주문에 실패했습니다.");toast(msg);}
 });
 document.querySelectorAll(".faq-item").forEach(x=>x.addEventListener("click",()=>x.classList.toggle("open")));
}
document.addEventListener("DOMContentLoaded",()=>{updateCount();renderHome();renderShop();renderProduct();renderCart();renderWishlist();renderOrders();renderMypage();bindForms();const menu=document.querySelector(".menu-btn"),header=document.querySelector(".header");if(menu)menu.addEventListener("click",()=>header.classList.toggle("menu-open"));});
