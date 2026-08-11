import duotone from "icons/duotone";
export const navigation = [{
  type: "label",
  label: "Admin"
}, {
  name: "Dashboard",
  icon: duotone.Dashboard,
  path: "/vendor/dashboard"
}, {
  name: "Products",
  icon: duotone.Products,
  children: [{
    name: "Product List",
    path: "/admin/products"
  }, {
    name: "Create Product",
    path: "/admin/products/create"
  }, {
    name: "Bulk Pricing",
    path: "/admin/pricing"
  }]
}, {
  name: "Categories",
  icon: duotone.Accounts,
  children: [{
    name: "Category List",
    path: "/admin/categories"
  }, {
    name: "Create Category",
    path: "/admin/categories/create"
  }]
}, {
  name: "Brands",
  icon: duotone.Accounts,
  children: [{
    name: "Brand List",
    path: "/admin/brands"
  }, {
    name: "Create Brand",
    path: "/admin/brands/create"
  }]
}, {
  name: "Homepage",
  icon: duotone.Dashboard,
  path: "/admin/homepage"
}, {
  name: "Import Products",
  icon: duotone.Products,
  path: "/admin/catalog-imports"
}, {
  name: "Catalog Verification",
  icon: duotone.Dashboard,
  path: "/admin/catalog-verification"
}, {
  name: "Orders",
  icon: duotone.Order,
  path: "/admin/orders"
}, {
  name: "Payments",
  icon: duotone.Refund,
  path: "/admin/payments"
}, {
  name: "Customers",
  icon: duotone.Accounts,
  path: "/admin/customers"
}, {
  name: "Support Tickets",
  icon: duotone.ElementHub,
  path: "/admin/tickets"
}, {
  name: "Reviews",
  icon: duotone.Accounts,
  path: "/admin/reviews"
}, {
  name: "Product Q&A",
  icon: duotone.Accounts,
  path: "/admin/qna"
}, {
  name: "Bundles",
  icon: duotone.Products,
  path: "/admin/bundles"
}, {
  name: "Variants",
  icon: duotone.Products,
  path: "/admin/variants"
}, {
  name: "Relations",
  icon: duotone.Products,
  path: "/admin/relations"
}, {
  type: "label",
  label: "Settings"
}, {
  name: "Account Settings",
  icon: duotone.AccountSetting,
  path: "/vendor/account-settings"
}, {
  name: "Site Settings",
  icon: duotone.SiteSetting,
  path: "/vendor/site-settings"
}, {
  name: "Logout",
  icon: duotone.Session,
  path: "/",
  action: "logout"
}];
