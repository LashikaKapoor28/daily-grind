const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");

const coffeeTypes = [
  { value: "Regular", label: "Regular" },
  { value: "Caramel", label: "Caramel (currently not available)", warn: true },
  { value: "Seasonal (Pumpkin)", label: "Seasonal (Pumpkin)" },
];
const cream = [
  { key: "regularCream", label: "Regular Cream" },
  { key: "frenchVanillaCream", label: "French Vanilla" },
  { key: "hazelnutCream", label: "Hazelnut" },
];
const sugar = [
  { key: "rawSugar", label: "Sugar in the Raw" },
  { key: "splenda", label: "Splenda" },
];
const milk = [
  { key: "regularMilk", label: "Regular Milk" },
  { key: "almondMilk", label: "Almond Milk" },
  { key: "oatMilk", label: "Oat Milk" },
];
const additionNames = {
  regularCream: "Regular Cream",
  frenchVanillaCream: "French Vanilla",
  hazelnutCream: "Hazelnut",
  rawSugar: "Raw Sugar",
  splenda: "Splenda",
  regularMilk: "Regular Milk",
  almondMilk: "Almond Milk",
  oatMilk: "Oat Milk",
};

let state = {
  view: localStorage.getItem("dailyGrindView") || "order",
  adminTab: "orders",
  filter: "All",
  search: "",
  form: { firstName: "", lastName: "", roomNumber: "" },
  current: blankItem(),
  cart: [],
  error: "",
  modal: null,
  toast: "",
  confirmDelete: null,
  memberEmail: "",
  memberRole: "user",
};

function blankItem() {
  return {
    drinkType: "Coffee",
    coffeeType: "Regular",
    teaType: "",
    temperature: "Hot",
    regularCream: 0,
    frenchVanillaCream: 0,
    hazelnutCream: 0,
    rawSugar: 0,
    splenda: 0,
    regularMilk: 0,
    almondMilk: 0,
    oatMilk: 0,
  };
}

function getOrders() {
  return JSON.parse(localStorage.getItem("dailyGrindOrders") || "[]");
}

function setOrders(orders) {
  localStorage.setItem("dailyGrindOrders", JSON.stringify(orders));
}

function getMembers() {
  const saved = JSON.parse(localStorage.getItem("dailyGrindMembers") || "[]");
  if (saved.length) return saved;
  return [
    { id: crypto.randomUUID(), email: "coffeekartshs@gmail.com", status: "admin", displayName: "Coffee Kart" },
    { id: crypto.randomUUID(), email: "teacher@shrewsbury.k12.ma.us", status: "user", displayName: "Sample Teacher" },
  ];
}

function setMembers(members) {
  localStorage.setItem("dailyGrindMembers", JSON.stringify(members));
}

function update(patch) {
  state = { ...state, ...patch };
  render();
}

function setView(view) {
  localStorage.setItem("dailyGrindView", view);
  update({ view, error: "", toast: "" });
}

function itemName(item) {
  const temp = item.temperature || "Hot";
  if (item.drinkType === "Coffee") return `${temp} ${item.coffeeType || "Regular"} Coffee`;
  return `${temp} ${(item.teaType || "").trim() || "Tea"}`;
}

function itemDetails(item) {
  const parts = Object.keys(additionNames)
    .filter((key) => item[key] > 0)
    .map((key) => `${item[key]} ${additionNames[key]}`);
  return parts.length ? parts.join(", ") : "No additions";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function header(title, subtitle, pendingCount = 0) {
  return `
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <img class="logo" src="logo.png" alt="" />
          <div>
            <h1 class="brand-title">${title}</h1>
            <p class="brand-subtitle">${subtitle}</p>
          </div>
        </div>
        <div class="header-actions">
          ${pendingCount ? `<span class="status pending">${pendingCount} pending</span>` : ""}
          <button class="outline-button" data-action="${state.view === "admin" ? "order-view" : "admin-view"}">
            ${state.view === "admin" ? "Place Order" : "Admin"}
          </button>
        </div>
      </div>
    </header>
  `;
}

function choice(label, key, value, extra = "") {
  const active = state.current[key] === value;
  return `<button class="choice ${active ? "active" : ""} ${extra}" data-choice-key="${key}" data-choice-value="${escapeHtml(value)}">${label}</button>`;
}

function stepperRows(items) {
  return items
    .map(
      (item) => `
        <div class="stepper-row">
          <span class="stepper-label">${item.label}</span>
          <div class="stepper">
            <button class="round-button" data-step="${item.key}" data-delta="-1" ${state.current[item.key] <= 0 ? "disabled" : ""}>−</button>
            <span class="count">${state.current[item.key]}</span>
            <button class="round-button" data-step="${item.key}" data-delta="1" ${state.current[item.key] >= 3 ? "disabled" : ""}>+</button>
          </div>
        </div>
      `
    )
    .join("");
}

function orderForm() {
  const isTea = state.current.drinkType === "Tea";
  return `
    <section class="card">
      <h2 class="section-title">${state.cart.length ? "Add Another Item" : "Your Order"}</h2>
      <div class="group">
        <div class="segmented">
          ${choice("Coffee", "drinkType", "Coffee")}
          ${choice("Tea", "drinkType", "Tea")}
        </div>
      </div>
      ${
        isTea
          ? `<div class="group">
              <label class="label">What type of tea?</label>
              <input class="input" data-field="teaType" value="${escapeHtml(state.current.teaType)}" placeholder="e.g. Green, Earl Grey, Chamomile..." />
            </div>`
          : `<div class="group">
              <label class="label">Coffee Type</label>
              <div class="option-grid">
                ${coffeeTypes
                  .map(
                    (type) =>
                      `<button class="choice ${state.current.coffeeType === type.value ? "active" : ""} ${type.warn ? "warn" : ""}" data-choice-key="coffeeType" data-choice-value="${type.value}">${type.label}</button>`
                  )
                  .join("")}
              </div>
            </div>`
      }
      <div class="group">
        <label class="label">Temperature</label>
        <div class="segmented">
          ${choice("Hot", "temperature", "Hot")}
          ${choice("Iced", "temperature", "Iced")}
        </div>
      </div>
      <div class="group">
        <h3 class="group-heading">Cream</h3>
        ${stepperRows(cream)}
      </div>
      <div class="group">
        <h3 class="group-heading">Sugar</h3>
        ${stepperRows(sugar)}
      </div>
      <div class="group">
        <h3 class="group-heading">Milk</h3>
        ${stepperRows(milk)}
      </div>
      <button class="add-button" data-action="add-item">${state.cart.length ? "+ Add Another Item" : "+ Add to Order"}</button>
    </section>
  `;
}

function summary() {
  if (!state.cart.length) return "";
  const total = state.cart.length;
  return `
    <section class="card">
      <h2 class="section-title">Order Summary</h2>
      <div class="summary-list">
        ${state.cart
          .map(
            (item) => `
              <div class="summary-item">
                <div class="summary-item-inner">
                  <div>
                    <p class="item-name">${itemName(item)}</p>
                    <p class="item-details">${itemDetails(item)}</p>
                  </div>
                  <button class="remove-button" data-remove-cart="${item.id}" aria-label="Remove item">×</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="total-row">
        <div class="total-line">
          <span class="total-label">Total</span>
          <span class="total-value">$${total.toFixed(2)}</span>
        </div>
        <p class="tiny">$1.00 per item. Payment collected at delivery.</p>
      </div>
      ${state.error ? `<p class="error">${state.error}</p>` : ""}
      <button class="primary-button full" data-action="place-order" style="margin-top:16px">Place Order</button>
    </section>
  `;
}

function orderView() {
  return `
    <div class="app">
      ${header("The Daily Grind", "Place an Order")}
      <main class="main stack">
        <section class="card">
          <h2 class="section-title">Your Information</h2>
          <div class="grid-2">
            <label class="field">
              <span class="label">First Name</span>
              <input class="input" data-person="firstName" value="${escapeHtml(state.form.firstName)}" placeholder="First name" />
            </label>
            <label class="field">
              <span class="label">Last Name</span>
              <input class="input" data-person="lastName" value="${escapeHtml(state.form.lastName)}" placeholder="Last name" />
            </label>
          </div>
          <label class="field">
            <span class="label">Room Number</span>
            <input class="input" data-person="roomNumber" value="${escapeHtml(state.form.roomNumber)}" placeholder="e.g. 204, M1, A3" />
          </label>
        </section>
        ${orderForm()}
        ${summary()}
      </main>
      ${modal()}
    </div>
  `;
}

function modal() {
  if (!state.modal) return "";
  return `
    <div class="modal">
      <div class="modal-card">
        <div class="success-mark">✓</div>
        <h2>Order Placed</h2>
        <p class="muted">For ${escapeHtml(state.modal.firstName)} ${escapeHtml(state.modal.lastName)}, Room ${escapeHtml(state.modal.roomNumber)}</p>
        <p>${state.modal.itemCount} ${state.modal.itemCount === 1 ? "item" : "items"} - $${state.modal.total.toFixed(2)} due at delivery</p>
        <button class="primary-button full" data-action="done" style="margin-top:24px">Done</button>
      </div>
    </div>
  `;
}

function adminView() {
  const orders = getOrders();
  const pending = orders.filter((order) => order.status === "Pending").length;
  return `
    <div class="app">
      ${header("The Daily Grind", "Admin Dashboard", pending)}
      <div class="tabs-wrap">
        <div class="tabs">
          ${["orders", "users"].map((tab) => `<button class="tab ${state.adminTab === tab ? "active" : ""}" data-admin-tab="${tab}">${tab}</button>`).join("")}
        </div>
      </div>
      ${state.adminTab === "orders" ? adminOrders(orders) : adminUsers()}
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
    </div>
  `;
}

function adminOrders(orders) {
  const counts = {
    All: orders.length,
    Pending: orders.filter((order) => order.status === "Pending").length,
    "In Progress": orders.filter((order) => order.status === "In Progress").length,
    Delivered: orders.filter((order) => order.status === "Delivered").length,
  };
  const needle = state.search.trim().toLowerCase();
  const filtered = orders.filter((order) => {
    const matchesStatus = state.filter === "All" || order.status === state.filter;
    const haystack = `${order.teacherFirstName} ${order.teacherLastName} ${order.roomNumber} ${order.teacherEmail}`.toLowerCase();
    return matchesStatus && (!needle || haystack.includes(needle));
  });

  return `
    <main class="main admin-main">
      <div class="filter-row">
        <span class="search-icon">⌕</span>
        <input class="input" data-search value="${escapeHtml(state.search)}" placeholder="Search by name, room, or email" />
      </div>
      <div class="chip-row">
        ${Object.keys(counts)
          .map((key) => `<button class="chip ${state.filter === key ? "active" : ""}" data-filter="${key}">${key} (${counts[key]})</button>`)
          .join("")}
      </div>
      ${
        filtered.length
          ? `<div class="orders">${filtered.map(orderCard).join("")}</div>`
          : `<div class="empty">No orders to show</div>`
      }
    </main>
  `;
}

function statusClass(status) {
  if (status === "Delivered") return "delivered";
  if (status === "In Progress") return "progress";
  return "pending";
}

function orderCard(order) {
  const next = order.status === "Pending" ? "In Progress" : order.status === "In Progress" ? "Delivered" : "";
  return `
    <article class="order-card">
      <div class="order-head">
        <div>
          <h3 class="order-name">${escapeHtml(order.teacherFirstName)} ${escapeHtml(order.teacherLastName)} <span class="status ${statusClass(order.status)}">${order.status}</span></h3>
          <p class="order-meta">Room ${escapeHtml(order.roomNumber)} · ${escapeHtml(order.teacherEmail)}</p>
        </div>
        <div class="order-time">
          <div>${new Date(order.created_date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          <div class="muted">${dateLabel(order.created_date)}</div>
        </div>
      </div>
      <div class="order-lines">
        ${order.items
          .map(
            (item, index) => `
              <div class="order-line">
                <span class="line-number">${index + 1}</span>
                <div>
                  <p class="item-name">${itemName(item)}</p>
                  <p class="item-details">${itemDetails(item)}</p>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="order-foot">
        <div class="order-meta">${order.items.length} ${order.items.length === 1 ? "item" : "items"} · <strong class="total-value">$${order.cost.toFixed(2)}</strong><span class="pill">Pay in person</span></div>
        <div>
          ${next ? `<button class="primary-button" data-status="${order.id}" data-next="${next}">Mark ${next}</button>` : ""}
          <button class="icon-button" data-confirm="${order.id}" aria-label="Delete order">⌫</button>
        </div>
      </div>
      ${
        state.confirmDelete === order.id
          ? `<div class="confirm-remove">
              <span>Remove this order?</span>
              <div>
                <button class="danger-button" data-delete="${order.id}">Remove Order</button>
                <button class="outline-button" data-action="cancel-delete">Cancel</button>
              </div>
            </div>`
          : ""
      }
    </article>
  `;
}

function dateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function adminUsers() {
  const members = getMembers();
  return `
    <main class="main admin-main">
      <form class="card inline-form" data-member-form>
        <input class="input" data-member-email value="${escapeHtml(state.memberEmail)}" type="email" placeholder="Add user by email..." />
        <select class="select" data-member-role>
          ${["user", "admin", "blocked"].map((role) => `<option value="${role}" ${state.memberRole === role ? "selected" : ""}>${role[0].toUpperCase() + role.slice(1)}</option>`).join("")}
        </select>
        <button class="primary-button">Add</button>
      </form>
      ${
        members.length
          ? `<div class="members">${members.map(memberCard).join("")}</div>`
          : `<div class="empty">No users yet.</div>`
      }
    </main>
  `;
}

function memberCard(member) {
  return `
    <article class="member-card">
      <div class="member-head">
        <div>
          <p class="item-name">${escapeHtml(member.email)}</p>
          ${member.displayName ? `<p class="item-details">${escapeHtml(member.displayName)}</p>` : ""}
        </div>
        <button class="icon-button" data-remove-member="${member.id}" aria-label="Remove user">⌫</button>
      </div>
      <div class="role-actions">
        ${["admin", "user", "blocked"]
          .map((role) => `<button class="chip ${member.status === role ? `status ${role}` : ""}" data-member-status="${member.id}" data-role="${role}">${role}</button>`)
          .join("")}
      </div>
    </article>
  `;
}

function placeOrder() {
  const { firstName, lastName, roomNumber } = state.form;
  if (!firstName.trim() || !lastName.trim()) return update({ error: "Please enter your first and last name." });
  if (!roomNumber.trim()) return update({ error: "Please enter your room number before submitting." });
  if (!state.cart.length) return update({ error: "Please add at least one item to your order." });
  const order = {
    id: crypto.randomUUID(),
    teacherFirstName: firstName.trim(),
    teacherLastName: lastName.trim(),
    teacherEmail: "local.teacher@shrewsbury.k12.ma.us",
    roomNumber: roomNumber.trim(),
    items: state.cart,
    cost: state.cart.length,
    status: "Pending",
    created_date: new Date().toISOString(),
  };
  setOrders([order, ...getOrders()]);
  update({
    cart: [],
    error: "",
    modal: {
      firstName: order.teacherFirstName,
      lastName: order.teacherLastName,
      roomNumber: order.roomNumber,
      itemCount: order.items.length,
      total: order.cost,
    },
  });
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

function bindEvents() {
  app.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-person]")) {
      state.form[target.dataset.person] = target.value;
    }
    if (target.matches("[data-field]")) {
      state.current[target.dataset.field] = target.value;
    }
    if (target.matches("[data-search]")) {
      state.search = target.value;
      const cursor = target.selectionStart;
      render();
      requestAnimationFrame(() => {
        const search = $("[data-search]");
        if (search) {
          search.focus();
          search.setSelectionRange(cursor, cursor);
        }
      });
    }
    if (target.matches("[data-member-email]")) {
      state.memberEmail = target.value;
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-member-role]")) {
      state.memberRole = event.target.value;
    }
  });

  app.addEventListener("submit", (event) => {
    if (event.target.matches("[data-member-form]")) {
      event.preventDefault();
      const email = state.memberEmail.trim().toLowerCase();
      if (!email) return;
      setMembers([{ id: crypto.randomUUID(), email, status: state.memberRole, displayName: "" }, ...getMembers()]);
      state.memberEmail = "";
      showToast(`${email} added`);
    }
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.action === "admin-view") return setView("admin");
    if (target.dataset.action === "order-view") return setView("order");
    if (target.dataset.action === "add-item") {
      update({ current: blankItem(), cart: [...state.cart, { ...state.current, id: crypto.randomUUID() }] });
      return;
    }
    if (target.dataset.action === "place-order") return placeOrder();
    if (target.dataset.action === "done") return update({ modal: null, form: { ...state.form, roomNumber: "" } });
    if (target.dataset.action === "cancel-delete") return update({ confirmDelete: null });

    if (target.dataset.choiceKey) {
      state.current[target.dataset.choiceKey] = target.dataset.choiceValue;
      if (target.dataset.choiceKey === "drinkType") {
        state.current.coffeeType = "Regular";
        state.current.teaType = "";
      }
      render();
      return;
    }

    if (target.dataset.step) {
      const key = target.dataset.step;
      const delta = Number(target.dataset.delta);
      state.current[key] = Math.max(0, Math.min(3, state.current[key] + delta));
      render();
      return;
    }

    if (target.dataset.removeCart) {
      update({ cart: state.cart.filter((item) => item.id !== target.dataset.removeCart) });
      return;
    }

    if (target.dataset.adminTab) return update({ adminTab: target.dataset.adminTab });
    if (target.dataset.filter) return update({ filter: target.dataset.filter });
    if (target.dataset.confirm) return update({ confirmDelete: target.dataset.confirm });

    if (target.dataset.delete) {
      setOrders(getOrders().filter((order) => order.id !== target.dataset.delete));
      update({ confirmDelete: null });
      return;
    }

    if (target.dataset.status) {
      const orders = getOrders().map((order) => (order.id === target.dataset.status ? { ...order, status: target.dataset.next } : order));
      setOrders(orders);
      showToast(`Order marked ${target.dataset.next}`);
      return;
    }

    if (target.dataset.removeMember) {
      const member = getMembers().find((item) => item.id === target.dataset.removeMember);
      setMembers(getMembers().filter((item) => item.id !== target.dataset.removeMember));
      showToast(`${member?.email || "User"} removed`);
      return;
    }

    if (target.dataset.memberStatus) {
      const role = target.dataset.role;
      const members = getMembers().map((member) => (member.id === target.dataset.memberStatus ? { ...member, status: role } : member));
      setMembers(members);
      showToast(`User set to ${role}`);
    }
  });
}

function render() {
  app.innerHTML = state.view === "admin" ? adminView() : orderView();
}

bindEvents();
render();
