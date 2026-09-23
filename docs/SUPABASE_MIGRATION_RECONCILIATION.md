# Supabase Migration Reconciliation

Audit date: 23 September 2026  
Project: `PSS Logistics` (`qyelfkmafzspctqkrwxf`)

The live Supabase ledger reports 14 applied migrations and the project is `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.155 in `ap-southeast-2`.

The Master checkout is the authored Supabase migration source. The Admin checkout contains only three Supabase migration files and is not a complete migration archive.

Confirmed production-to-source mappings:

| Production entry | Authored Master source |
|---|---|
| `employee_credentials` | `202609020001_employee_credentials.sql` |
| `client_profile_fields` | `202608310002_client_profile_fields.sql` |
| `identity_profile_rules` | `202609030001_identity_profile_rules.sql` |
| `access_hardening` | `202609050001_access_hardening.sql` |
| `rate_cards_private_storage` | `202609070001_rate_cards.sql` |
| `admin_permission_catalog_v2` | `202609100001_admin_permission_catalog.sql` |
| `add_missing_rbac_foreign_key_indexes` | `202609170002_missing_rbac_foreign_key_indexes.sql` |
| `optimize_rbac_rls_initplans` | `202609170003_optimize_rbac_rls_initplans.sql` |
| `harden_governance_policy_roles` | `20260919043125_harden_governance_policy_roles.sql` |
| `split_governance_write_policies` | `20260919043232_split_governance_write_policies.sql` |
| `active_employee_assignments` | `20260920165555_active_employee_assignments.sql` |

Three production entries do not have one-to-one filenames in the authored history:

- `harden_rpc_execute_privileges`
- `revoke_authenticated_employee_code_execution`
- `move_rbac_security_definer_functions_to_private_schema`

Their current live private RBAC definitions and grants are preserved in `SUPABASE_PRIVATE_RBAC_SNAPSHOT.sql`. That snapshot is evidence for reconciliation, not an instruction to apply blindly. Do not recreate or replay these entries speculatively; retrieve the original migration SQL from Supabase deployment history before independently rebuilding the database.
