import type { Page, Route } from "@playwright/test";

type Role = "SUPPLIER" | "VALIDATOR" | "ADMIN";

type User = {
  userId: string;
  email: string;
  fullName: string;
  password: string;
  role: Role;
};

type SupplierContact = {
  id: string;
  fullName: string;
  email?: string;
  contactType: string;
  jobTitle?: string;
  phone?: string;
  isPrimary: boolean;
  createdAt: string;
};

type SupplierCategory = { id: string; code: string; name: string };

type SupplierProfile = {
  id: string;
  userId: string;
  status: string;
  preferredLanguage?: "IT" | "EN";
  companyName?: string;
  tradingName?: string;
  companyType?: string;
  registrationNumber?: string;
  vatNumber?: string;
  taxId?: string;
  countryOfIncorporation?: string;
  incorporationDate?: string;
  website?: string;
  description?: string;
  employeeCountRange?: string;
  annualRevenueRange?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  rejectionReason?: string;
  revisionNotes?: string;
  isCriticalEditPending?: boolean;
  reviewerName?: string;
  lastReviewedAt?: string;
  submittedAt?: string;
  isNew?: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: SupplierContact[];
  categories: SupplierCategory[];
};

type DocumentRow = {
  id: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  isCurrent: boolean;
  expiryDate?: string;
  notes?: string;
  uploadedAt: string;
  uploadedByName?: string;
};

type ReviewRow = {
  id: string;
  action: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  comment?: string;
  previousStatus: string;
  newStatus: string;
  reviewerName?: string;
  createdAt: string;
};

type AdminReviewCaseRow = {
  id: string;
  applicationId: string;
  status: string;
  decision?: string | null;
  slaDueAt?: string | null;
  updatedAt: string;
};

type Store = {
  usersByEmail: Map<string, User>;
  supplierByUserId: Map<string, SupplierProfile>;
  supplierById: Map<string, SupplierProfile>;
  docsBySupplierId: Map<string, DocumentRow[]>;
  reviewsBySupplierId: Map<string, ReviewRow[]>;
  categoriesTree: Array<{ id: string; code: string; name: string; parentId: string | null; children?: unknown[] }>;
};

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function ok<T>(data: T, message = "OK") {
  return { success: true, message, data };
}

function pageResponse<T>(content: T[]) {
  return {
    content,
    number: 0,
    size: content.length || 20,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true
  };
}

function toAdminReviewQueueRows(store: Store): AdminReviewCaseRow[] {
  return Array.from(store.supplierById.values())
    .filter((profile) => profile.status === "PENDING")
    .map((profile) => ({
      id: `case_${profile.id}`,
      applicationId: profile.id,
      status: "IN_PROGRESS",
      decision: null,
      slaDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      updatedAt: profile.updatedAt
    }));
}

function canonicalApiPath(path: string): string {
  if (path.startsWith("/api/v2/")) {
    return `/api/${path.slice("/api/v2/".length)}`;
  }
  return path;
}

function initStore(): Store {
  const store: Store = {
    usersByEmail: new Map(),
    supplierByUserId: new Map(),
    supplierById: new Map(),
    docsBySupplierId: new Map(),
    reviewsBySupplierId: new Map(),
    categoriesTree: [
      {
        id: "cat-a",
        code: "A",
        name: "Lavori",
        parentId: null,
        children: [
          { id: "cat-a1", code: "A1", name: "Edilizia", parentId: "cat-a", children: [] },
          { id: "cat-a2", code: "A2", name: "Impianti", parentId: "cat-a", children: [] }
        ]
      }
    ]
  };

  const validatorUser: User = {
    userId: "usr_validator",
    email: "validator.rossi@supplierplatform.com",
    fullName: "Validator Rossi",
    password: "Test@12345",
    role: "VALIDATOR"
  };
  store.usersByEmail.set(validatorUser.email.toLowerCase(), validatorUser);
  return store;
}

function getBearerTokenUserId(route: Route): string | null {
  const auth = route.request().headers()["authorization"] || route.request().headers()["Authorization"];
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  const parts = token.split(":");
  return parts.length === 2 ? parts[1] : null;
}

async function jsonBody<T>(route: Route): Promise<T> {
  const raw = route.request().postData() || "{}";
  return JSON.parse(raw) as T;
}

function categoryIndex(store: Store) {
  const out = new Map<string, SupplierCategory>();
  const walk = (nodes: Array<{ id: string; code: string; name: string; children?: unknown[] }>) => {
    for (const node of nodes) {
      out.set(node.id, { id: node.id, code: node.code, name: node.name });
      if (Array.isArray(node.children)) walk(node.children as Array<{ id: string; code: string; name: string; children?: unknown[] }>);
    }
  };
  walk(store.categoriesTree as Array<{ id: string; code: string; name: string; children?: unknown[] }>);
  return out;
}

export async function installMockApi(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("revamp_email_verified", "1");
  });

  const store = initStore();
  const categoriesById = categoryIndex(store);

  const handler = async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const normalizedPath = canonicalApiPath(path);
    const method = req.method().toUpperCase();

    if (normalizedPath === "/api/support/contact" && method === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok({ submitted: true })) });
      return;
    }

    if (normalizedPath === "/api/categories/tree" && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(store.categoriesTree)) });
      return;
    }

    if (normalizedPath === "/api/auth/register" && method === "POST") {
      const body = await jsonBody<{ fullName: string; email: string; password: string }>(route);
      const email = body.email.toLowerCase();
      const userId = newId("usr");
      const supplierId = newId("sup");
      const user: User = { userId, email, fullName: body.fullName, password: body.password, role: "SUPPLIER" };
      const ts = nowIso();
      const profile: SupplierProfile = {
        id: supplierId,
        userId,
        status: "DRAFT",
        createdAt: ts,
        updatedAt: ts,
        contacts: [],
        categories: []
      };
      store.usersByEmail.set(email, user);
      store.supplierByUserId.set(userId, profile);
      store.supplierById.set(supplierId, profile);
      store.docsBySupplierId.set(supplierId, []);
      store.reviewsBySupplierId.set(supplierId, []);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok({
          token: `mock:${userId}`,
          userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }))
      });
      return;
    }

    if (normalizedPath === "/api/auth/login" && method === "POST") {
      const body = await jsonBody<{ email: string; password: string }>(route);
      const user = store.usersByEmail.get(body.email.toLowerCase());
      if (!user || user.password !== body.password) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Bad credentials", data: null })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok({
          token: `mock:${user.userId}`,
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }))
      });
      return;
    }

    if (normalizedPath === "/api/supplier/profile" && method === "GET") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath === "/api/supplier/profile" && method === "PUT") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      const body = await jsonBody<Record<string, unknown>>(route);
      Object.assign(profile, body, { updatedAt: nowIso() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath === "/api/supplier/profile/categories" && method === "POST") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      const body = await jsonBody<{ categoryIds: string[] }>(route);
      profile.categories = (body.categoryIds || []).map((id) => categoriesById.get(id)).filter(Boolean) as SupplierCategory[];
      profile.updatedAt = nowIso();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath === "/api/supplier/profile/contacts" && method === "POST") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      const body = await jsonBody<{
        fullName: string;
        email?: string;
        contactType: string;
        jobTitle?: string;
        phone?: string;
        isPrimary: boolean;
      }>(route);
      const contact: SupplierContact = {
        id: newId("cnt"),
        fullName: body.fullName,
        email: body.email,
        contactType: body.contactType,
        jobTitle: body.jobTitle,
        phone: body.phone,
        isPrimary: Boolean(body.isPrimary),
        createdAt: nowIso()
      };
      if (contact.isPrimary) {
        for (const c of profile.contacts) c.isPrimary = false;
      }
      profile.contacts.push(contact);
      profile.updatedAt = nowIso();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath.startsWith("/api/supplier/profile/contacts/") && method === "DELETE") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      const contactId = normalizedPath.split("/").pop() || "";
      if (profile) {
        profile.contacts = profile.contacts.filter((c) => c.id !== contactId);
        profile.updatedAt = nowIso();
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(undefined)) });
      return;
    }

    if (normalizedPath === "/api/supplier/profile/submit" && method === "POST") {
      const userId = getBearerTokenUserId(route);
      const profile = userId ? store.supplierByUserId.get(userId) : undefined;
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      profile.status = "PENDING";
      profile.submittedAt = nowIso();
      profile.updatedAt = nowIso();
      profile.isNew = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath.startsWith("/api/documents/upload/") && method === "POST") {
      const supplierId = normalizedPath.split("/").pop() || "";
      const list = store.docsBySupplierId.get(supplierId) || [];
      const doc: DocumentRow = {
        id: newId("doc"),
        documentType: "COMPANY_PROFILE",
        originalFilename: "random-upload.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
        isCurrent: true,
        expiryDate: "2027-12-31",
        notes: "Uploaded in mock",
        uploadedAt: nowIso(),
        uploadedByName: "Mock User"
      };
      list.unshift(doc);
      store.docsBySupplierId.set(supplierId, list);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(doc)) });
      return;
    }

    if (normalizedPath.startsWith("/api/documents/") && method === "GET") {
      const supplierId = normalizedPath.split("/").pop() || "";
      const docs = store.docsBySupplierId.get(supplierId) || [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(docs)) });
      return;
    }

    if (normalizedPath === "/api/validator/queue" && method === "GET") {
      const rows = Array.from(store.supplierById.values()).filter((p) => p.status === "PENDING");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(pageResponse(rows))) });
      return;
    }

    if (normalizedPath === "/api/validator/queue/notifications" && method === "GET") {
      const count = Array.from(store.supplierById.values()).filter((p) => p.status === "PENDING" && p.isNew).length;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok({ newPendingCount: count, serverTime: nowIso(), lastSeenAt: nowIso() }))
      });
      return;
    }

    if (normalizedPath === "/api/validator/queue/notifications/seen" && method === "POST") {
      for (const profile of store.supplierById.values()) profile.isNew = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok({ newPendingCount: 0, serverTime: nowIso(), lastSeenAt: nowIso() }))
      });
      return;
    }

    if (normalizedPath.startsWith("/api/validator/suppliers/") && method === "GET" && !normalizedPath.endsWith("/reviews")) {
      const supplierId = normalizedPath.split("/")[4];
      const profile = store.supplierById.get(supplierId);
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(profile)) });
      return;
    }

    if (normalizedPath.endsWith("/reviews") && method === "GET") {
      const supplierId = normalizedPath.split("/")[4];
      const reviews = store.reviewsBySupplierId.get(supplierId) || [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(reviews)) });
      return;
    }

    if (normalizedPath.endsWith("/review") && method === "POST") {
      const supplierId = normalizedPath.split("/")[4];
      const profile = store.supplierById.get(supplierId);
      if (!profile) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "Not found", data: null }) });
        return;
      }
      const body = await jsonBody<{ action: "APPROVED" | "REJECTED" | "REVISION_REQUESTED"; comment?: string }>(route);
      const prev = profile.status;
      let next = prev;
      if (body.action === "APPROVED") next = "APPROVED";
      if (body.action === "REJECTED") next = "REJECTED";
      if (body.action === "REVISION_REQUESTED") next = "NEEDS_REVISION";
      profile.status = next;
      profile.lastReviewedAt = nowIso();
      profile.reviewerName = "Validator Rossi";
      profile.updatedAt = nowIso();

      const review: ReviewRow = {
        id: newId("rev"),
        action: body.action,
        comment: body.comment,
        previousStatus: prev,
        newStatus: next,
        reviewerName: "Validator Rossi",
        createdAt: nowIso()
      };
      const reviews = store.reviewsBySupplierId.get(supplierId) || [];
      reviews.unshift(review);
      store.reviewsBySupplierId.set(supplierId, reviews);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(review)) });
      return;
    }

    if (normalizedPath === "/api/search/fields" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok([{
          tableName: "supplier_profiles",
          fields: [{ fieldKey: "supplier.companyName", label: "Company Name", tableName: "supplier_profiles", columnName: "company_name", dataType: "TEXT", matchMode: "LIKE", exportable: true }]
        }]))
      });
      return;
    }

    if (normalizedPath === "/api/search/suppliers" && method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const rows = Array.from(store.supplierById.values()).filter((p) => (p.companyName || "").toLowerCase().includes(q));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(pageResponse(rows))) });
      return;
    }

    if (normalizedPath === "/api/reviews/queue" && method === "GET") {
      const queue = toAdminReviewQueueRows(store);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(queue)) });
      return;
    }

    if (normalizedPath === "/api/reports/kpis" && method === "GET") {
      const suppliers = Array.from(store.supplierById.values());
      const pendingInvites = 0;
      const payload = {
        totalSuppliers: suppliers.length,
        activeSuppliers: suppliers.filter((s) => s.status === "APPROVED").length,
        pendingSuppliers: suppliers.filter((s) => s.status === "PENDING").length,
        submittedApplications: suppliers.filter((s) => Boolean(s.submittedAt)).length,
        pendingInvites
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(payload)) });
      return;
    }

    if (/^\/api\/reviews\/[^/]+\/history$/.test(normalizedPath) && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok([])) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ok(undefined))
    });
  };

  await page.route("http://localhost:8081/api/**", handler);
  await page.route("http://127.0.0.1:8081/api/**", handler);
}
