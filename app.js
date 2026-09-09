const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");

// =====================================================
// ACCESS CONTROL
// =====================================================

const ADMIN_EMAILS = [
  "kapoor.lashika@gmail.com",
  "tcalabresi@shrewsbury.k12.ma.us",
];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isStudentEmail(email) {
  return normalizeEmail(email).includes("students");
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

function getRoleForEmail(email) {
  const normalized = normalizeEmail(email);

  if (!normalized) return "blocked";

  // Emails containing "students" are NEVER allowed in.
  if (isStudentEmail(normalized)) {
    return "blocked";
  }

  // Only these two specific emails are admins.
  if (isAdminEmail(normalized)) {
    return "admin";
  }

  // Everyone else is a regular user.
  return "user";
}

function canAccessApp(email) {
  return getRoleForEmail(email) !== "blocked";
}

function canAccessAdmin(email) {
  return getRoleForEmail(email) === "admin";
}

function getCurrentUser() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("dailyGrindCurrentUser") || "null"
    );

    if (!saved?.email) return null;

    const email = normalizeEmail(saved.email);
    const role = getRoleForEmail(email);

    // If an old saved account has become blocked, log it out.
    if (role === "blocked") {
      localStorage.removeItem("dailyGrindCurrentUser");
      localStorage.removeItem("dailyGrindView");
      return null;
    }

    return {
      email,
      role,
    };
  } catch {
    localStorage.removeItem("dailyGrindCurrentUser");
    return null;
  }
}

function saveCurrentUser(email) {
  const normalized = normalizeEmail(email);
  const role = getRoleForEmail(normalized);

  if (role === "blocked") {
    return false;
  }

  localStorage.setItem(
    "dailyGrindCurrentUser",
    JSON.stringify({
      email: normalized,
      role,
    })
  );

  return true;
}

function logout() {
  localStorage.removeItem("dailyGrindCurrentUser");
  localStorage.removeItem("dailyGrindView");

  state.view = "login";
  state.loginEmail = "";
  state.loginError = "";
  state.adminTab = "orders";

  render();
}

// =====================================================
// MENU DATA
// =====================================================

const coffeeTypes = [
  { value: "Regular", label: "Regular" },
  {
    value: "Caramel",
    label: "Caramel (currently not available)",
    warn: true,
  },
  {
    value: "Seasonal (Pumpkin)",
    label: "Seasonal (Pumpkin)",
  },
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

// Fixed from "maclk" to "milk"
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

// =====================================================
// STATE
// =====================================================

const initialUser = getCurrentUser();

let state = {
  view: initialUser
    ? (
        localStorage.getItem("dailyGrindView") === "admin" &&
        canAccessAdmin(initialUser.email)
          ? "admin"
          : "order"
      )
    : "login",

  adminTab: "orders",
  filter: "All",
  search: "",

  form: {
    firstName: "",
    lastName: "",
    roomNumber: "",
  },

  current: blankItem(),
  cart: [],
  error: "",
  modal: null,
  toast: "",
  confirmDelete: null,

  memberEmail: "",

  loginEmail: "",
  loginError: "",
};

// =====================================================
// ORDER HELPERS
// =====================================================

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
  return JSON.parse(
    localStorage.getItem("dailyGrindOrders") || "[]"
  );
}

function setOrders(orders) {
  localStorage.setItem(
    "dailyGrindOrders",
    JSON.stringify(orders)
  );
}

// =====================================================
// MEMBERS
// =====================================================

function getMembers() {
  let saved = [];

  try {
    saved = JSON.parse(
      localStorage.getItem("dailyGrindMembers") || "[]"
    );
  } catch {
    saved = [];
  }

  // Recalculate everyone's role every time.
  saved = saved
    .map((member) => {
      const email = normalizeEmail(member.email);

      return {
        ...member,
        email,
        status: getRoleForEmail(email),
      };
    })
    // Student emails are not allowed to be members.
    .filter(
      (member) =>
        member.email &&
        !isStudentEmail(member.email)
    );

  // Remove duplicate emails.
  const unique = [];

  saved.forEach((member) => {
    if (
      !unique.some(
        (item) => item.email === member.email
      )
    ) {
      unique.push(member);
    }
  });

  // Make sure both admins always exist.
  ADMIN_EMAILS.forEach((email) => {
    const existing = unique.find(
      (member) => member.email === email
    );

    if (existing) {
      existing.status = "admin";
    } else {
      unique.push({
        id: crypto.randomUUID(),
        email,
        status: "admin",
        displayName:
          email === "kapoor.lashika@gmail.com"
            ? "Lashika Kapoor"
            : "",
      });
    }
  });

  localStorage.setItem(
    "dailyGrindMembers",
    JSON.stringify(unique)
  );

  return unique;
}

function setMembers(members) {
  const safeMembers = [];
  const seen = new Set();

  members.forEach((member) => {
    const email = normalizeEmail(member.email);

    if (!email) return;

    // Student emails can never be saved.
    if (isStudentEmail(email)) return;

    if (seen.has(email)) return;

    seen.add(email);

    safeMembers.push({
      ...member,
      email,
      status: getRoleForEmail(email),
    });
  });

  // Always restore the admins if necessary.
  ADMIN_EMAILS.forEach((email) => {
    const existing = safeMembers.find(
      (member) => member.email === email
    );

    if (existing) {
      existing.status = "admin";
    } else {
      safeMembers.push({
        id: crypto.randomUUID(),
        email,
        status: "admin",
        displayName:
          email === "kapoor.lashika@gmail.com"
            ? "Lashika Kapoor"
            : "",
      });
    }
  });

  localStorage.setItem(
    "dailyGrindMembers",
    JSON.stringify(safeMembers)
  );
}

function addMemberAutomatically(email) {
  const normalized = normalizeEmail(email);

  if (!canAccessApp(normalized)) {
    return;
  }

  const members = getMembers();

  if (
    members.some(
      (member) => member.email === normalized
    )
  ) {
    return;
  }

  setMembers([
    {
      id: crypto.randomUUID(),
      email: normalized,
      status: getRoleForEmail(normalized),
      displayName: "",
    },
    ...members,
  ]);
}

// =====================================================
// GENERAL STATE
// =====================================================

function update(patch) {
  state = {
    ...state,
    ...patch,
  };

  render();
}

function setView(view) {
  const user = getCurrentUser();

  if (!user) {
    state.view = "login";
    render();
    return;
  }

  // Only admins are allowed into admin view.
  if (
    view === "admin" &&
    !canAccessAdmin(user.email)
  ) {
    showToast("You do not have administrator access.");
    return;
  }

  localStorage.setItem(
    "dailyGrindView",
    view
  );

  update({
    view,
    error: "",
    toast: "",
  });
}

// =====================================================
// DISPLAY HELPERS
// =====================================================

function itemName(item) {
  const temp = item.temperature || "Hot";

  if (item.drinkType === "Coffee") {
    return `${temp} ${item.coffeeType || "Regular"} Coffee`;
  }

  return `${temp} ${
    (item.teaType || "").trim() || "Tea"
  }`;
}

function itemDetails(item) {
  const parts = Object.keys(additionNames)
    .filter((key) => item[key] > 0)
    .map(
      (key) =>
        `${item[key]} ${additionNames[key]}`
    );

  return parts.length
    ? parts.join(", ")
    : "No additions";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// =====================================================
// LOGIN
// =====================================================

function loginView() {
  return `
    <div class="app">
      <main class="main">
        <section class="card" style="max-width:500px;margin:80px auto;">
          
          <div style="text-align:center;margin-bottom:24px;">
            <img
              class="logo"
              src="logo.png"
              alt="The Daily Grind"
              style="width:80px;height:80px;margin:0 auto 16px;"
            />

            <h1
              class="brand-title"
              style="font-size:28px;"
            >
              The Daily Grind
            </h1>

            <p class="brand-subtitle">
              Coffee Cart Order System
            </p>
          </div>

          <form data-login-form>

            <label class="field">
              <span class="label">
                Email Address
              </span>

              <input
                class="input"
                type="email"
                data-login-email
                value="${escapeHtml(state.loginEmail)}"
                placeholder="Enter your email"
                autocomplete="email"
                required
              />
            </label>

            ${
              state.loginError
                ? `
                  <p class="error">
                    ${escapeHtml(state.loginError)}
                  </p>
                `
                : ""
            }

            <button
              class="primary-button full"
              style="margin-top:20px;"
              type="submit"
            >
              Continue
            </button>

          </form>

        </section>
      </main>
    </div>
  `;
}

function handleLogin() {
  const email = normalizeEmail(state.loginEmail);

  if (!email) {
    state.loginError =
      "Please enter your email address.";
    render();
    return;
  }

  if (!email.includes("@")) {
    state.loginError =
      "Please enter a valid email address.";
    render();
    return;
  }

  // BLOCK ANY EMAIL WITH "students"
  if (isStudentEmail(email)) {
    state.loginError =
      "Student accounts are not permitted to access The Daily Grind.";

    localStorage.removeItem(
      "dailyGrindCurrentUser"
    );

    localStorage.removeItem(
      "dailyGrindView"
    );

    render();
    return;
  }

  const role = getRoleForEmail(email);

  saveCurrentUser(email);
  addMemberAutomatically(email);

  state.loginError = "";
  state.loginEmail = "";

  // Admins start at the admin dashboard.
  // Everyone else starts at ordering.
  const nextView =
    role === "admin"
      ? "admin"
      : "order";

  localStorage.setItem(
    "dailyGrindView",
    nextView
  );

  state.view = nextView;

  render();
}

// =====================================================
// HEADER
// =====================================================

function header(
  title,
  subtitle,
  pendingCount = 0
) {
  const user = getCurrentUser();

  return `
    <header class="header">
      <div class="header-inner">

        <div class="brand">
          <img
            class="logo"
            src="logo.png"
            alt=""
          />

          <div>
            <h1 class="brand-title">
              ${title}
            </h1>

            <p class="brand-subtitle">
              ${subtitle}
            </p>
          </div>
        </div>

        <div class="header-actions">

          ${
            pendingCount
              ? `
                <span class="status pending">
                  ${pendingCount} pending
                </span>
              `
              : ""
          }

          ${
            user &&
            canAccessAdmin(user.email)
              ? `
                <button
                  class="outline-button"
                  data-action="${
                    state.view === "admin"
                      ? "order-view"
                      : "admin-view"
                  }"
                >
                  ${
                    state.view === "admin"
                      ? "Place Order"
                      : "Admin"
                  }
                </button>
              `
              : ""
          }

          <button
            class="outline-button"
            data-action="logout"
          >
            Log Out
          </button>

        </div>
      </div>
    </header>
  `;
}

// =====================================================
// ORDER COMPONENTS
// =====================================================

function choice(
  label,
  key,
  value,
  extra = ""
) {
  const active =
    state.current[key] === value;

  return `
    <button
      class="choice ${
        active ? "active" : ""
      } ${extra}"
      data-choice-key="${key}"
      data-choice-value="${escapeHtml(value)}"
    >
      ${label}
    </button>
  `;
}

function stepperRows(items) {
  return items
    .map(
      (item) => `
        <div class="stepper-row">

          <span class="stepper-label">
            ${item.label}
          </span>

          <div class="stepper">

            <button
              class="round-button"
              data-step="${item.key}"
              data-delta="-1"
              ${
                state.current[item.key] <= 0
                  ? "disabled"
                  : ""
              }
            >
              −
            </button>

            <span class="count">
              ${state.current[item.key]}
            </span>

            <button
              class="round-button"
              data-step="${item.key}"
              data-delta="1"
              ${
                state.current[item.key] >= 3
                  ? "disabled"
                  : ""
              }
            >
              +
            </button>

          </div>
        </div>
      `
    )
    .join("");
}

function orderForm() {
  const isTea =
    state.current.drinkType === "Tea";

  return `
    <section class="card">

      <h2 class="section-title">
        ${
          state.cart.length
            ? "Add Another Item"
            : "Your Order"
        }
      </h2>

      <div class="group">
        <div class="segmented">
          ${choice(
            "Coffee",
            "drinkType",
            "Coffee"
          )}

          ${choice(
            "Tea",
            "drinkType",
            "Tea"
          )}
        </div>
      </div>

      ${
        isTea
          ? `
            <div class="group">

              <label class="label">
                What type of tea?
              </label>

              <input
                class="input"
                data-field="teaType"
                value="${escapeHtml(
                  state.current.teaType
                )}"
                placeholder="e.g. Green, Earl Grey, Chamomile..."
              />

            </div>
          `
          : `
            <div class="group">

              <label class="label">
                Coffee Type
              </label>

              <div class="option-grid">

                ${coffeeTypes
                  .map(
                    (type) => `
                      <button
                        class="choice ${
                          state.current
                            .coffeeType ===
                          type.value
                            ? "active"
                            : ""
                        } ${
                          type.warn
                            ? "warn"
                            : ""
                        }"
                        data-choice-key="coffeeType"
                        data-choice-value="${type.value}"
                      >
                        ${type.label}
                      </button>
                    `
                  )
                  .join("")}

              </div>
            </div>
          `
      }

      <div class="group">

        <label class="label">
          Temperature
        </label>

        <div class="segmented">

          ${choice(
            "Hot",
            "temperature",
            "Hot"
          )}

          ${choice(
            "Iced",
            "temperature",
            "Iced"
          )}

        </div>
      </div>

      <div class="group">
        <h3 class="group-heading">
          Cream
        </h3>

        ${stepperRows(cream)}
      </div>

      <div class="group">
        <h3 class="group-heading">
          Sugar
        </h3>

        ${stepperRows(sugar)}
      </div>

      <div class="group">
        <h3 class="group-heading">
          Milk
        </h3>

        ${stepperRows(milk)}
      </div>

      <button
        class="add-button"
        data-action="add-item"
      >
        ${
          state.cart.length
            ? "+ Add Another Item"
            : "+ Add to Order"
        }
      </button>

    </section>
  `;
}

function summary() {
  if (!state.cart.length) {
    return "";
  }

  const total =
    state.cart.length;

  return `
    <section class="card">

      <h2 class="section-title">
        Order Summary
      </h2>

      <div class="summary-list">

        ${state.cart
          .map(
            (item) => `
              <div class="summary-item">

                <div class="summary-item-inner">

                  <div>
                    <p class="item-name">
                      ${itemName(item)}
                    </p>

                    <p class="item-details">
                      ${itemDetails(item)}
                    </p>
                  </div>

                  <button
                    class="remove-button"
                    data-remove-cart="${item.id}"
                    aria-label="Remove item"
                  >
                    ×
                  </button>

                </div>
              </div>
            `
          )
          .join("")}

      </div>

      <div class="total-row">

        <div class="total-line">

          <span class="total-label">
            Total
          </span>

          <span class="total-value">
            $${total.toFixed(2)}
          </span>

        </div>

        <p class="tiny">
          $1.00 per item. Payment collected at delivery.
        </p>

      </div>

      ${
        state.error
          ? `
            <p class="error">
              ${state.error}
            </p>
          `
          : ""
      }

      <button
        class="primary-button full"
        data-action="place-order"
        style="margin-top:16px"
      >
        Place Order
      </button>

    </section>
  `;
}

function orderView() {
  return `
    <div class="app">

      ${header(
        "The Daily Grind",
        "Place an Order"
      )}

      <main class="main stack">

        <section class="card">

          <h2 class="section-title">
            Your Information
          </h2>

          <div class="grid-2">

            <label class="field">

              <span class="label">
                First Name
              </span>

              <input
                class="input"
                data-person="firstName"
                value="${escapeHtml(
                  state.form.firstName
                )}"
                placeholder="First name"
              />

            </label>

            <label class="field">

              <span class="label">
                Last Name
              </span>

              <input
                class="input"
                data-person="lastName"
                value="${escapeHtml(
                  state.form.lastName
                )}"
                placeholder="Last name"
              />

            </label>

          </div>

          <label class="field">

            <span class="label">
              Room Number
            </span>

            <input
              class="input"
              data-person="roomNumber"
              value="${escapeHtml(
                state.form.roomNumber
              )}"
              placeholder="e.g. 204, M1, A3"
            />

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
  if (!state.modal) {
    return "";
  }

  return `
    <div class="modal">

      <div class="modal-card">

        <div class="success-mark">
          ✓
        </div>

        <h2>
          Order Placed
        </h2>

        <p class="muted">
          For
          ${escapeHtml(
            state.modal.firstName
          )}
          ${escapeHtml(
            state.modal.lastName
          )},
          Room
          ${escapeHtml(
            state.modal.roomNumber
          )}
        </p>

        <p>
          ${state.modal.itemCount}
          ${
            state.modal.itemCount === 1
              ? "item"
              : "items"
          }
          -
          $${state.modal.total.toFixed(2)}
          due at delivery
        </p>

        <button
          class="primary-button full"
          data-action="done"
          style="margin-top:24px"
        >
          Done
        </button>

      </div>
    </div>
  `;
}

// =====================================================
// ADMIN
// =====================================================

function adminView() {
  const user =
    getCurrentUser();

  // Extra security check.
  if (
    !user ||
    !canAccessAdmin(user.email)
  ) {
    return orderView();
  }

  const orders =
    getOrders();

  const pending =
    orders.filter(
      (order) =>
        order.status === "Pending"
    ).length;

  return `
    <div class="app">

      ${header(
        "The Daily Grind",
        "Admin Dashboard",
        pending
      )}

      <div class="tabs-wrap">

        <div class="tabs">

          ${["orders", "users"]
            .map(
              (tab) => `
                <button
                  class="tab ${
                    state.adminTab === tab
                      ? "active"
                      : ""
                  }"
                  data-admin-tab="${tab}"
                >
                  ${tab}
                </button>
              `
            )
            .join("")}

        </div>

      </div>

      ${
        state.adminTab === "orders"
          ? adminOrders(orders)
          : adminUsers()
      }

      ${
        state.toast
          ? `
            <div class="toast">
              ${state.toast}
            </div>
          `
          : ""
      }

    </div>
  `;
}

function adminOrders(orders) {
  const counts = {
    All: orders.length,

    Pending:
      orders.filter(
        (order) =>
          order.status === "Pending"
      ).length,

    "In Progress":
      orders.filter(
        (order) =>
          order.status === "In Progress"
      ).length,

    Delivered:
      orders.filter(
        (order) =>
          order.status === "Delivered"
      ).length,
  };

  const needle =
    state.search
      .trim()
      .toLowerCase();

  const filtered =
    orders.filter((order) => {
      const matchesStatus =
        state.filter === "All" ||
        order.status === state.filter;

      const haystack =
        `${order.teacherFirstName} ${order.teacherLastName} ${order.roomNumber} ${order.teacherEmail}`
          .toLowerCase();

      return (
        matchesStatus &&
        (
          !needle ||
          haystack.includes(needle)
        )
      );
    });

  return `
    <main class="main admin-main">

      <div class="filter-row">

        <span class="search-icon">
          ⌕
        </span>

        <input
          class="input"
          data-search
          value="${escapeHtml(
            state.search
          )}"
          placeholder="Search by name, room, or email"
        />

      </div>

      <div class="chip-row">

        ${Object.keys(counts)
          .map(
            (key) => `
              <button
                class="chip ${
                  state.filter === key
                    ? "active"
                    : ""
                }"
                data-filter="${key}"
              >
                ${key}
                (${counts[key]})
              </button>
            `
          )
          .join("")}

      </div>

      ${
        filtered.length
          ? `
            <div class="orders">
              ${filtered
                .map(orderCard)
                .join("")}
            </div>
          `
          : `
            <div class="empty">
              No orders to show
            </div>
          `
      }

    </main>
  `;
}

function statusClass(status) {
  if (status === "Delivered") {
    return "delivered";
  }

  if (status === "In Progress") {
    return "progress";
  }

  return "pending";
}

function orderCard(order) {
  const next =
    order.status === "Pending"
      ? "In Progress"
      : order.status === "In Progress"
        ? "Delivered"
        : "";

  return `
    <article class="order-card">

      <div class="order-head">

        <div>

          <h3 class="order-name">

            ${escapeHtml(
              order.teacherFirstName
            )}

            ${escapeHtml(
              order.teacherLastName
            )}

            <span
              class="status ${statusClass(
                order.status
              )}"
            >
              ${order.status}
            </span>

          </h3>

          <p class="order-meta">
            Room
            ${escapeHtml(
              order.roomNumber
            )}
            ·
            ${escapeHtml(
              order.teacherEmail
            )}
          </p>

        </div>

        <div class="order-time">

          <div>
            ${new Date(
              order.created_date
            ).toLocaleTimeString(
              [],
              {
                hour: "numeric",
                minute: "2-digit",
              }
            )}
          </div>

          <div class="muted">
            ${dateLabel(
              order.created_date
            )}
          </div>

        </div>

      </div>

      <div class="order-lines">

        ${order.items
          .map(
            (item, index) => `
              <div class="order-line">

                <span class="line-number">
                  ${index + 1}
                </span>

                <div>

                  <p class="item-name">
                    ${itemName(item)}
                  </p>

                  <p class="item-details">
                    ${itemDetails(item)}
                  </p>

                </div>

              </div>
            `
          )
          .join("")}

      </div>

      <div class="order-foot">

        <div class="order-meta">

          ${order.items.length}

          ${
            order.items.length === 1
              ? "item"
              : "items"
          }

          ·

          <strong class="total-value">
            $${order.cost.toFixed(2)}
          </strong>

          <span class="pill">
            Pay in person
          </span>

        </div>

        <div>

          ${
            next
              ? `
                <button
                  class="primary-button"
                  data-status="${order.id}"
                  data-next="${next}"
                >
                  Mark ${next}
                </button>
              `
              : ""
          }

          <button
            class="icon-button"
            data-confirm="${order.id}"
            aria-label="Delete order"
          >
            ⌫
          </button>

        </div>

      </div>

      ${
        state.confirmDelete ===
        order.id
          ? `
            <div class="confirm-remove">

              <span>
                Remove this order?
              </span>

              <div>

                <button
                  class="danger-button"
                  data-delete="${order.id}"
                >
                  Remove Order
                </button>

                <button
                  class="outline-button"
                  data-action="cancel-delete"
                >
                  Cancel
                </button>

              </div>

            </div>
          `
          : ""
      }

    </article>
  `;
}

function dateLabel(dateString) {
  const date =
    new Date(dateString);

  const today =
    new Date();

  const yesterday =
    new Date();

  yesterday.setDate(
    today.getDate() - 1
  );

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return "Today";
  }

  if (
    date.toDateString() ===
    yesterday.toDateString()
  ) {
    return "Yesterday";
  }

  return date.toLocaleDateString(
    [],
    {
      month: "short",
      day: "numeric",
    }
  );
}

// =====================================================
// ADMIN USERS
// =====================================================

function adminUsers() {
  const members =
    getMembers();

  return `
    <main class="main admin-main">

      <form
        class="card inline-form"
        data-member-form
      >

        <input
          class="input"
          data-member-email
          value="${escapeHtml(
            state.memberEmail
          )}"
          type="email"
          placeholder="Add user by email..."
        />

        <button
          class="primary-button"
          type="submit"
        >
          Add User
        </button>

      </form>

      ${
        members.length
          ? `
            <div class="members">
              ${members
                .map(memberCard)
                .join("")}
            </div>
          `
          : `
            <div class="empty">
              No users yet.
            </div>
          `
      }

    </main>
  `;
}

function memberCard(member) {
  const email =
    normalizeEmail(member.email);

  const role =
    getRoleForEmail(email);

  return `
    <article class="member-card">

      <div class="member-head">

        <div>

          <p class="item-name">
            ${escapeHtml(email)}
          </p>

          ${
            member.displayName
              ? `
                <p class="item-details">
                  ${escapeHtml(
                    member.displayName
                  )}
                </p>
              `
              : ""
          }

          <div style="margin-top:8px;">

            <span class="status ${role}">
              ${
                role === "admin"
                  ? "Admin"
                  : "User"
              }
            </span>

          </div>

        </div>

        ${
          isAdminEmail(email)
            ? ""
            : `
              <button
                class="icon-button"
                data-remove-member="${member.id}"
                aria-label="Remove user"
              >
                ⌫
              </button>
            `
        }

      </div>

    </article>
  `;
}

// =====================================================
// PLACE ORDER
// =====================================================

function placeOrder() {
  const {
    firstName,
    lastName,
    roomNumber,
  } = state.form;

  if (
    !firstName.trim() ||
    !lastName.trim()
  ) {
    return update({
      error:
        "Please enter your first and last name.",
    });
  }

  if (!roomNumber.trim()) {
    return update({
      error:
        "Please enter your room number before submitting.",
    });
  }

  if (!state.cart.length) {
    return update({
      error:
        "Please add at least one item to your order.",
    });
  }

  const user =
    getCurrentUser();

  if (!user) {
    state.view = "login";
    render();
    return;
  }

  const order = {
    id: crypto.randomUUID(),

    teacherFirstName:
      firstName.trim(),

    teacherLastName:
      lastName.trim(),

    // Use the email that logged into the app.
    teacherEmail:
      user.email,

    roomNumber:
      roomNumber.trim(),

    items:
      state.cart,

    cost:
      state.cart.length,

    status:
      "Pending",

    created_date:
      new Date().toISOString(),
  };

  setOrders([
    order,
    ...getOrders(),
  ]);

  update({
    cart: [],
    error: "",

    modal: {
      firstName:
        order.teacherFirstName,

      lastName:
        order.teacherLastName,

      roomNumber:
        order.roomNumber,

      itemCount:
        order.items.length,

      total:
        order.cost,
    },
  });
}

// =====================================================
// TOAST
// =====================================================

function showToast(message) {
  state.toast = message;

  render();

  setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

// =====================================================
// EVENTS
// =====================================================

function bindEvents() {
  app.addEventListener(
    "input",
    (event) => {
      const target =
        event.target;

      if (
        target.matches(
          "[data-login-email]"
        )
      ) {
        state.loginEmail =
          target.value;

        state.loginError = "";
      }

      if (
        target.matches(
          "[data-person]"
        )
      ) {
        state.form[
          target.dataset.person
        ] = target.value;
      }

      if (
        target.matches(
          "[data-field]"
        )
      ) {
        state.current[
          target.dataset.field
        ] = target.value;
      }

      if (
        target.matches(
          "[data-search]"
        )
      ) {
        state.search =
          target.value;

        const cursor =
          target.selectionStart;

        render();

        requestAnimationFrame(
          () => {
            const search =
              $("[data-search]");

            if (search) {
              search.focus();

              search.setSelectionRange(
                cursor,
                cursor
              );
            }
          }
        );
      }

      if (
        target.matches(
          "[data-member-email]"
        )
      ) {
        state.memberEmail =
          target.value;
      }
    }
  );

  // FORM SUBMISSION
  app.addEventListener(
    "submit",
    (event) => {

      // LOGIN
      if (
        event.target.matches(
          "[data-login-form]"
        )
      ) {
        event.preventDefault();
        handleLogin();
        return;
      }

      // ADD MEMBER
      if (
        event.target.matches(
          "[data-member-form]"
        )
      ) {
        event.preventDefault();

        const currentUser =
          getCurrentUser();

        if (
          !currentUser ||
          !canAccessAdmin(
            currentUser.email
          )
        ) {
          showToast(
            "Administrator access required."
          );

          return;
        }

        const email =
          normalizeEmail(
            state.memberEmail
          );

        if (!email) {
          showToast(
            "Enter an email address."
          );

          return;
        }

        if (
          !email.includes("@")
        ) {
          showToast(
            "Enter a valid email address."
          );

          return;
        }

        // STUDENT EMAILS CANNOT BE ADDED
        if (
          isStudentEmail(email)
        ) {
          state.memberEmail = "";

          showToast(
            "Student email addresses are not allowed."
          );

          return;
        }

        const members =
          getMembers();

        if (
          members.some(
            (member) =>
              member.email === email
          )
        ) {
          showToast(
            "That email is already added."
          );

          return;
        }

        const role =
          getRoleForEmail(email);

        setMembers([
          {
            id:
              crypto.randomUUID(),

            email,

            status:
              role,

            displayName:
              "",
          },

          ...members,
        ]);

        state.memberEmail = "";

        showToast(
          role === "admin"
            ? `${email} added as admin`
            : `${email} added as user`
        );

        return;
      }
    }
  );

  // CLICK EVENTS
  app.addEventListener(
    "click",
    (event) => {
      const target =
        event.target.closest(
          "button"
        );

      if (!target) {
        return;
      }

      // LOG OUT
      if (
        target.dataset.action ===
        "logout"
      ) {
        logout();
        return;
      }

      // ADMIN VIEW
      if (
        target.dataset.action ===
        "admin-view"
      ) {
        const user =
          getCurrentUser();

        if (
          !user ||
          !canAccessAdmin(
            user.email
          )
        ) {
          showToast(
            "You do not have administrator access."
          );

          return;
        }

        setView("admin");
        return;
      }

      // ORDER VIEW
      if (
        target.dataset.action ===
        "order-view"
      ) {
        setView("order");
        return;
      }

      // ADD ITEM
      if (
        target.dataset.action ===
        "add-item"
      ) {
        update({
          current:
            blankItem(),

          cart: [
            ...state.cart,

            {
              ...state.current,
              id:
                crypto.randomUUID(),
            },
          ],
        });

        return;
      }

      // PLACE ORDER
      if (
        target.dataset.action ===
        "place-order"
      ) {
        placeOrder();
        return;
      }

      // DONE
      if (
        target.dataset.action ===
        "done"
      ) {
        update({
          modal: null,

          form: {
            ...state.form,
            roomNumber: "",
          },
        });

        return;
      }

      // CANCEL DELETE
      if (
        target.dataset.action ===
        "cancel-delete"
      ) {
        update({
          confirmDelete: null,
        });

        return;
      }

      // CHOICES
      if (
        target.dataset.choiceKey
      ) {
        state.current[
          target.dataset.choiceKey
        ] =
          target.dataset.choiceValue;

        if (
          target.dataset.choiceKey ===
          "drinkType"
        ) {
          state.current.coffeeType =
            "Regular";

          state.current.teaType =
            "";
        }

        render();
        return;
      }

      // STEPPER
      if (
        target.dataset.step
      ) {
        const key =
          target.dataset.step;

        const delta =
          Number(
            target.dataset.delta
          );

        state.current[key] =
          Math.max(
            0,
            Math.min(
              3,
              state.current[key] +
                delta
            )
          );

        render();
        return;
      }

      // REMOVE CART ITEM
      if (
        target.dataset.removeCart
      ) {
        update({
          cart:
            state.cart.filter(
              (item) =>
                item.id !==
                target.dataset
                  .removeCart
            ),
        });

        return;
      }

      // ADMIN TAB
      if (
        target.dataset.adminTab
      ) {
        const user =
          getCurrentUser();

        if (
          !user ||
          !canAccessAdmin(
            user.email
          )
        ) {
          return;
        }

        update({
          adminTab:
            target.dataset
              .adminTab,
        });

        return;
      }

      // FILTER
      if (
        target.dataset.filter
      ) {
        update({
          filter:
            target.dataset.filter,
        });

        return;
      }

      // CONFIRM ORDER DELETE
      if (
        target.dataset.confirm
      ) {
        update({
          confirmDelete:
            target.dataset.confirm,
        });

        return;
      }

      // DELETE ORDER
      if (
        target.dataset.delete
      ) {
        const user =
          getCurrentUser();

        if (
          !user ||
          !canAccessAdmin(
            user.email
          )
        ) {
          return;
        }

        setOrders(
          getOrders().filter(
            (order) =>
              order.id !==
              target.dataset.delete
          )
        );

        update({
          confirmDelete: null,
        });

        return;
      }

      // UPDATE ORDER STATUS
      if (
        target.dataset.status
      ) {
        const user =
          getCurrentUser();

        if (
          !user ||
          !canAccessAdmin(
            user.email
          )
        ) {
          return;
        }

        const orders =
          getOrders().map(
            (order) =>
              order.id ===
              target.dataset.status
                ? {
                    ...order,

                    status:
                      target.dataset
                        .next,
                  }
                : order
          );

        setOrders(orders);

        showToast(
          `Order marked ${target.dataset.next}`
        );

        return;
      }

      // REMOVE MEMBER
      if (
        target.dataset
          .removeMember
      ) {
        const currentUser =
          getCurrentUser();

        if (
          !currentUser ||
          !canAccessAdmin(
            currentUser.email
          )
        ) {
          return;
        }

        const member =
          getMembers().find(
            (item) =>
              item.id ===
              target.dataset
                .removeMember
          );

        if (!member) {
          return;
        }

        // ADMINS CANNOT BE DELETED
        if (
          isAdminEmail(
            member.email
          )
        ) {
          showToast(
            "Administrators cannot be removed."
          );

          return;
        }

        setMembers(
          getMembers().filter(
            (item) =>
              item.id !==
              target.dataset
                .removeMember
          )
        );

        showToast(
          `${member.email} removed`
        );

        return;
      }
    }
  );
}

// =====================================================
// RENDER
// =====================================================

function render() {
  const user =
    getCurrentUser();

  // No logged in user.
  if (!user) {
    state.view = "login";
    app.innerHTML =
      loginView();

    return;
  }

  // Extra protection against blocked accounts.
  if (
    !canAccessApp(user.email)
  ) {
    logout();
    return;
  }

  // Never allow a normal user to stay on admin page.
  if (
    state.view === "admin" &&
    !canAccessAdmin(user.email)
  ) {
    state.view = "order";

    localStorage.setItem(
      "dailyGrindView",
      "order"
    );
  }

  if (
    state.view === "admin"
  ) {
    app.innerHTML =
      adminView();
  } else {
    app.innerHTML =
      orderView();
  }
}

// =====================================================
// START APP
// =====================================================

getMembers();
bindEvents();
render();