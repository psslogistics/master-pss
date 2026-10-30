export type RolePermissionDependencyIssue = {
  permissionKey: string;
  permissionLabel: string;
  missingKeys: string[];
  missingLabels: string[];
};

// These prerequisites reflect the read surface required to use each elevated
// action in the panel. They are warnings only; the Worker remains authoritative.
export const ROLE_PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  "clients.create": ["clients.view"],
  "clients.edit": ["clients.view"],
  "clients.assign": ["clients.view"],
  "clients.activity.view": ["clients.view"],
  "crm.manage": ["crm.view"],
  "shipments.create": ["shipments.view"],
  "shipments.edit": ["shipments.view"],
  "shipments.export": ["shipments.view"],
  "exceptions.manage": ["exceptions.view"],
  "tracking.update": ["tracking.view"],
  "pickup.create": ["pickup.view"],
  "pickup.assign": ["pickup.view"],
  "tickets.reply": ["tickets.view"],
  "tickets.close": ["tickets.view"],
  "tickets.reassign": ["tickets.view"],
  "tickets.escalations.view": ["tickets.view"],
  "billing.create": ["billing.view"],
  "billing.approve": ["billing.view"],
  "reports.export": ["reports.view"],
  "employees.create": ["employees.view"],
  "employees.edit": ["employees.view"],
  "employees.disable": ["employees.view"],
  "tasks.manage": ["tasks.view"],
  "roles.manage": ["roles.view"],
};

export function getRolePermissionDependencyIssues(
  permissionKeys: Iterable<string>,
  labels: Record<string, string> = {},
): RolePermissionDependencyIssue[] {
  const enabled = new Set(permissionKeys);
  return Object.entries(ROLE_PERMISSION_DEPENDENCIES)
    .filter(([permissionKey, requirements]) => enabled.has(permissionKey) && requirements.some((key) => !enabled.has(key)))
    .map(([permissionKey, requirements]) => {
      const missingKeys = requirements.filter((key) => !enabled.has(key));
      return {
        permissionKey,
        permissionLabel: labels[permissionKey] ?? permissionKey,
        missingKeys,
        missingLabels: missingKeys.map((key) => labels[key] ?? key),
      };
    });
}

export function compareRolePermissionSets(
  leftPermissionKeys: Iterable<string>,
  rightPermissionKeys: Iterable<string>,
  catalog: Array<{ key: string; label: string; group: string }>,
) {
  const left = new Set(leftPermissionKeys);
  const right = new Set(rightPermissionKeys);
  return catalog.map((permission) => ({
    ...permission,
    leftEnabled: left.has(permission.key),
    rightEnabled: right.has(permission.key),
    same: left.has(permission.key) === right.has(permission.key),
  }));
}
