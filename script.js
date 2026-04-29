const CONFIG = {
  // ضع رابط Google Apps Script Web App هنا لاحقاً، واتركه فارغاً للتجربة من data.json
  API_URL: "",
  LOCAL_DATA: "data.json"
};

const state = { employees: [], filtered: [], openDepartments: new Set(), collapsedNodes: new Set(), lastSearch: "" };
const $ = (id) => document.getElementById(id);
const normalize = (v) => String(v ?? "").trim().replace(/\s+/g," ");
const k = (v) => normalize(v).toLowerCase();
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadData(){
  const url = CONFIG.API_URL || CONFIG.LOCAL_DATA;
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : (payload.employees || []);
  state.employees = rows.map(r => ({
    name: normalize(r.name || r["Employee Name"] || r.employeeName),
    branch: normalize(r.branch || r["Branch"]),
    department: normalize(r.department || r.dept || r["Department"]),
    position: normalize(r.position || r["position"] || r["Position"]),
    manager: normalize(r.manager || r["Manager"]),
    photoUrl: normalize(r.photoUrl || r.photo || r["Photo"] || r["Image"])
  })).filter(e => e.name);
  state.filtered = [...state.employees];
  fillFilters();
  bindEvents();
  render();
}

function bindEvents(){
  $("searchInput").addEventListener("input", applyFilters);
  $("departmentFilter").addEventListener("change", applyFilters);
  $("branchFilter").addEventListener("change", applyFilters);
  $("resetBtn").addEventListener("click", () => { $("searchInput").value=""; $("departmentFilter").value=""; $("branchFilter").value=""; state.openDepartments.clear(); state.collapsedNodes.clear(); applyFilters(); });
  $("expandAllBtn").addEventListener("click", () => { unique("department").forEach(d => state.openDepartments.add(k(d))); state.collapsedNodes.clear(); renderDepartments(); });
  $("collapseAllBtn").addEventListener("click", () => { state.openDepartments.clear(); renderDepartments(); });
}
function unique(field){ return [...new Set(state.employees.map(e => e[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")); }
function fillFilters(){
  $("departmentFilter").innerHTML = '<option value="">كل الأقسام</option>' + unique("department").map(v=>`<option>${esc(v)}</option>`).join("");
  $("branchFilter").innerHTML = '<option value="">كل أماكن العمل</option>' + unique("branch").map(v=>`<option>${esc(v)}</option>`).join("");
}
function applyFilters(){
  const q = k($("searchInput").value), dept = $("departmentFilter").value, branch = $("branchFilter").value;
  state.lastSearch = q;
  state.filtered = state.employees.filter(e => (!q || k([e.name,e.branch,e.department,e.position,e.manager].join(" ")).includes(q)) && (!dept || e.department===dept) && (!branch || e.branch===branch));
  if(q){ state.filtered.forEach(e => state.openDepartments.add(k(e.department))); }
  render();
}
function render(){ renderSummary(); renderTop(); renderDepartments(); $("emptyState").classList.toggle("hidden", state.filtered.length>0); }
function renderSummary(){
  const depts = new Set(state.filtered.map(e=>e.department).filter(Boolean)).size;
  const branches = new Set(state.filtered.map(e=>e.branch).filter(Boolean)).size;
  const managers = new Set(state.filtered.map(e=>e.manager).filter(Boolean)).size;
  $("summary").innerHTML = `<div class="stat"><strong>${state.filtered.length}</strong><span>موظف</span></div><div class="stat"><strong>${depts}</strong><span>قسم</span></div><div class="stat"><strong>${branches}</strong><span>مكان عمل</span></div><div class="stat"><strong>${managers}</strong><span>مدير مباشر</span></div>`;
}
function level(e){ const p=e.position||""; if(p.includes("المدير المفوض")||p.includes("مساعد المدير")) return "top"; if(p.includes("مدير")) return "manager"; if(p.includes("مشرف")||p.includes("رئيس")||p.includes("مسؤول")) return "supervisor"; return "employee"; }
function renderTop(){
  const tops = state.employees.filter(e => !e.manager || e.position.includes("المدير المفوض") || e.position.includes("مساعد المدير")).slice(0,3);
  $("topSection").innerHTML = tops.map(e=>`<div class="top-card"><div class="top-pos">${esc(e.position||"إدارة عليا")}</div><div class="top-name">${esc(e.name)}</div></div>`).join("");
}
function groupByDept(){ return state.filtered.reduce((a,e)=>{ (a[e.department||"بدون قسم"] ||= []).push(e); return a; },{}); }
function renderDepartments(){
  const grouped = groupByDept();
  const entries = Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0],"ar"));
  $("departments").innerHTML = entries.map(([dept,members],idx)=>renderDepartment(dept,members,idx)).join("");
  document.querySelectorAll("[data-dept-toggle]").forEach(btn=>btn.addEventListener("click",()=>toggleDept(btn.dataset.deptToggle)));
  document.querySelectorAll("[data-node-toggle]").forEach(btn=>btn.addEventListener("click",(ev)=>{ev.stopPropagation();toggleNode(btn.dataset.nodeToggle)}));
}
function renderDepartment(dept,members,idx){
  const isOpen = state.openDepartments.has(k(dept));
  const branchCount = new Set(members.map(e=>e.branch).filter(Boolean)).size;
  const headCount = getRoots(members).length;
  return `<section class="department ${isOpen?'open':''}"><button class="dept-header" data-dept-toggle="${esc(k(dept))}" type="button"><div class="dept-title"><div class="dept-icon">${esc((dept||'؟').slice(0,1))}</div><div class="dept-info"><h2>${esc(dept)}</h2><p>اضغط لعرض أو إخفاء المخطط الهرمي لهذا القسم</p></div></div><div class="dept-meta"><span>${members.length} موظف</span><span>${headCount} رأس هيكل</span><span>${branchCount} موقع</span></div><span class="dept-arrow">⌄</span></button><div class="dept-body">${isOpen?`<div class="tree-wrap"><div class="org-chart">${renderTree(members)}</div></div>`:''}</div></section>`;
}
function toggleDept(deptKey){ state.openDepartments.has(deptKey) ? state.openDepartments.delete(deptKey) : state.openDepartments.add(deptKey); renderDepartments(); }
function toggleNode(nameKey){ state.collapsedNodes.has(nameKey) ? state.collapsedNodes.delete(nameKey) : state.collapsedNodes.add(nameKey); renderDepartments(); }
function getMaps(members){ const byName = new Map(members.map(e=>[k(e.name),e])); const children = new Map(members.map(e=>[k(e.name),[]])); members.forEach(e=>{ const mk=k(e.manager); if(mk && byName.has(mk) && mk!==k(e.name)) children.get(mk).push(e); }); return {byName,children}; }
function getRoots(members){ const {byName} = getMaps(members); return members.filter(e => !e.manager || !byName.has(k(e.manager)) || k(e.manager)===k(e.name)).sort(sortEmp); }
function renderTree(members){ const maps=getMaps(members), roots=getRoots(members); return `<ul>${roots.map(e=>renderNode(e,maps)).join("")}</ul>`; }
function renderNode(e,maps){
  const kids=(maps.children.get(k(e.name))||[]).sort(sortEmp); const collapsed=state.collapsedNodes.has(k(e.name));
  return `<li>${cardHtml(e,kids,maps.byName)}${kids.length && !collapsed ? `<ul>${kids.map(ch=>renderNode(ch,maps)).join("")}</ul>` : ''}</li>`;
}
function cardHtml(e,kids,byName){
  const tpl = document.createElement('div');
  const sameDeptManager = e.manager && byName.has(k(e.manager));
  const managerText = e.manager ? (sameDeptManager ? `المدير المباشر: ${e.manager}` : `يتبع إدارياً إلى: ${e.manager}`) : 'لا يوجد مدير مباشر محدد';
  const photoStyle = e.photoUrl ? `style="background-image:url('${esc(e.photoUrl)}');font-size:0"` : '';
  const highlighted = state.lastSearch && k([e.name,e.position,e.manager].join(' ')).includes(state.lastSearch) ? ' highlight' : '';
  const collapsed=state.collapsedNodes.has(k(e.name));
  return `<div class="node-card level-${level(e)}${highlighted}"><div class="avatar" ${photoStyle}>👤</div><div class="node-main"><div class="node-head"><h3>${esc(e.name)}</h3><span class="branch-badge">${esc(e.branch||'غير محدد')}</span></div><p class="position">${esc(e.position||'بدون مسمى وظيفي')}</p><p class="manager-line ${sameDeptManager?'':'external'}">${esc(managerText)}</p></div><button class="node-toggle ${kids.length?'':'hidden'} ${collapsed?'collapsed':''}" data-node-toggle="${esc(k(e.name))}" type="button">⌄</button><span class="child-count ${kids.length?'':'hidden'}">${kids.length}</span></div>`;
}
function sortEmp(a,b){ return levelRank(a)-levelRank(b) || (a.position||'').localeCompare(b.position||'', 'ar') || a.name.localeCompare(b.name,'ar'); }
function levelRank(e){ return ({top:0,manager:1,supervisor:2,employee:3})[level(e)] ?? 4; }
loadData().catch(err=>{ console.error(err); document.body.insertAdjacentHTML('afterbegin', '<div style="padding:14px;background:#ffecec;color:#900;text-align:center">تعذر تحميل البيانات. تأكد من رابط API أو ملف data.json.</div>'); });
