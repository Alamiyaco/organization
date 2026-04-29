
const CONFIG = {
  API_URL: "",
  LOCAL_DATA: "data.json"
};

const state = {
  employees: [],
  filtered: []
};

const $ = (id) => document.getElementById(id);
const normalize = (v) => String(v || "").trim().replace(/\s+/g, " ");
const key = (v) => normalize(v).toLowerCase();

async function loadEmployees(){
  const url = CONFIG.API_URL || CONFIG.LOCAL_DATA;
  const res = await fetch(url, { cache: "no-store" });
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : (payload.employees || []);
  state.employees = rows
    .map((r) => ({
      name: normalize(r.name || r["Employee Name"]),
      branch: normalize(r.branch || r["Branch"]),
      department: normalize(r.department || r["Department"]),
      position: normalize(r.position || r["position"] || r["Position"]),
      manager: normalize(r.manager || r["Manager"]),
      photoUrl: normalize(r.photoUrl || r["Photo"] || r["Image"] || "")
    }))
    .filter((r) => r.name);
  state.filtered = [...state.employees];
  setupFilters();
  render();
}

function uniqueValues(field){
  return [...new Set(state.employees.map(e => e[field]).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, "ar"));
}

function fillSelect(id, values){
  const select = $(id);
  const first = select.options[0].outerHTML;
  select.innerHTML = first + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
}

function setupFilters(){
  fillSelect("departmentFilter", uniqueValues("department"));
  fillSelect("branchFilter", uniqueValues("branch"));
  fillSelect("managerFilter", uniqueValues("manager"));
  ["searchInput","departmentFilter","branchFilter","managerFilter"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
  });
  $("resetBtn").addEventListener("click", () => {
    $("searchInput").value = "";
    $("departmentFilter").value = "";
    $("branchFilter").value = "";
    $("managerFilter").value = "";
    applyFilters();
  });
}

function applyFilters(){
  const q = key($("searchInput").value);
  const dept = $("departmentFilter").value;
  const branch = $("branchFilter").value;
  const manager = $("managerFilter").value;

  state.filtered = state.employees.filter(e => {
    const haystack = key([e.name,e.branch,e.department,e.position,e.manager].join(" "));
    return (!q || haystack.includes(q))
      && (!dept || e.department === dept)
      && (!branch || e.branch === branch)
      && (!manager || e.manager === manager);
  });
  render();
}

function render(){
  $("totalEmployees").textContent = state.filtered.length;
  renderSummary();
  renderDepartments();
  $("emptyState").classList.toggle("hidden", state.filtered.length > 0);
}

function renderSummary(){
  const depts = new Set(state.filtered.map(e => e.department).filter(Boolean)).size;
  const branches = new Set(state.filtered.map(e => e.branch).filter(Boolean)).size;
  const managers = new Set(state.filtered.map(e => e.manager).filter(Boolean)).size;
  $("summary").innerHTML = `
    <div class="stat"><strong>${state.filtered.length}</strong><span>موظف</span></div>
    <div class="stat"><strong>${depts}</strong><span>قسم</span></div>
    <div class="stat"><strong>${branches}</strong><span>مكان عمل</span></div>
    <div class="stat"><strong>${managers}</strong><span>مدير مباشر</span></div>
  `;
}

function renderDepartments(){
  const root = $("departments");
  root.innerHTML = "";
  const grouped = groupBy(state.filtered, "department");
  const entries = Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0], "ar"));

  for(const [department, employees] of entries){
    const section = document.createElement("section");
    section.className = "department";
    section.innerHTML = `
      <div class="department-header">
        <div class="department-title">
          <div class="dept-icon">${escapeHtml((department || "؟").slice(0,1))}</div>
          <div>
            <h2>${escapeHtml(department || "بدون قسم")}</h2>
          </div>
        </div>
        <div class="department-count">${employees.length} موظف</div>
      </div>
      <div class="tree"></div>
    `;
    const tree = section.querySelector(".tree");
    buildDepartmentTree(tree, employees, department);
    root.appendChild(section);
  }
}

function buildDepartmentTree(container, employees, department){
  const byName = new Map(employees.map(e => [key(e.name), e]));
  const children = new Map();
  const roots = [];

  employees.forEach(e => children.set(key(e.name), []));
  employees.forEach(e => {
    const managerKey = key(e.manager);
    if(managerKey && byName.has(managerKey)){
      children.get(managerKey).push(e);
    }else{
      roots.push(e);
    }
  });

  roots.sort(sortPeople).forEach(e => container.appendChild(renderNode(e, children, byName)));
}

function renderNode(employee, children, byName){
  const node = document.createElement("div");
  node.className = "node";
  node.appendChild(employeeCard(employee, byName));
  const kids = (children.get(key(employee.name)) || []).sort(sortPeople);
  if(kids.length){
    const kidsWrap = document.createElement("div");
    kidsWrap.className = "children";
    kids.forEach(child => kidsWrap.appendChild(renderNode(child, children, byName)));
    node.appendChild(kidsWrap);
  }
  return node;
}

function employeeCard(e, byName){
  const tpl = $("employeeTemplate").content.cloneNode(true);
  const card = tpl.querySelector(".employee-card");
  const avatar = tpl.querySelector(".avatar");
  const title = tpl.querySelector("h3");
  const branch = tpl.querySelector(".branch-badge");
  const position = tpl.querySelector(".position");
  const manager = tpl.querySelector(".manager-line");

  title.textContent = e.name;
  branch.textContent = e.branch || "غير محدد";
  position.textContent = e.position || "بدون مسمى وظيفي";

  const sameDepartmentManager = e.manager && byName.has(key(e.manager));
  if(e.manager){
    manager.textContent = sameDepartmentManager ? `المدير المباشر: ${e.manager}` : `يتبع إدارياً إلى: ${e.manager}`;
    manager.classList.toggle("external", !sameDepartmentManager);
  }else{
    manager.textContent = "لا يوجد مدير مباشر محدد";
  }

  if(e.photoUrl){
    avatar.classList.add("has-photo");
    avatar.style.backgroundImage = `url("${e.photoUrl}")`;
  }

  return card;
}

function groupBy(arr, field){
  return arr.reduce((acc,item) => {
    const value = item[field] || "بدون قسم";
    (acc[value] ||= []).push(item);
    return acc;
  }, {});
}

function sortPeople(a,b){
  const pa = a.position || "";
  const pb = b.position || "";
  return pa.localeCompare(pb, "ar") || a.name.localeCompare(b.name, "ar");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }

loadEmployees().catch(err => {
  console.error(err);
  $("departments").innerHTML = "";
  $("emptyState").classList.remove("hidden");
  $("emptyState").textContent = "تعذر تحميل بيانات الهيكل الإداري. تأكد من رابط Google Apps Script أو ملف data.json.";
});
