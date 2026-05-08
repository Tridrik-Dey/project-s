# RBAC Matrix V2 (Freeze)

## Roles

- `SUPER_ADMIN`
- `RESPONSABILE_ALBO`
- `REVISORE`
- `VIEWER`
- `SUPPLIER`

Admin users can hold multiple admin roles.

## Permissions Matrix (Action-Level)

| Action | SUPER_ADMIN | RESPONSABILE_ALBO | REVISORE | VIEWER | SUPPLIER |
|---|---|---|---|---|---|
| Manage admin users/roles | Y | N | N | N | N |
| Configure lifecycle/notifications | Y | N | N | N | N |
| Create/renew/cancel invite | Y | Y | N | N | N |
| View pending queue | Y | Y | Y | N | N |
| Assign review case | Y | Y | N | N | N |
| Request integration | Y | Y | Y | N | N |
| Approve/Reject application | Y | Y | N | N | N |
| Suspend/Reactivate profile | Y | Y | N | N | N |
| Hard delete profile | Y | N | N | N | N |
| Add internal admin note | Y | Y | Y | N | N |
| View internal admin note | Y | Y | Y | N | N |
| Submit supplier evaluation | Y | Y | Y | N | N |
| Annul evaluation | Y | N | N | N | N |
| View reports/exports | Y | Y | Y | Y (limited) | N |
| View active supplier profiles | Y | Y | Y | Y | own only |
| Edit own draft application | N | N | N | N | Y |
| Submit own application/renewal | N | N | N | N | Y |
| View own review outcome/comms | N | N | N | N | Y |

## Data Visibility Rules

1. `VIEWER`
- Can read active supplier cards and high-level scores.
- Cannot access internal notes, full documents, sensitive fields.

2. `REVISORE`
- Can access review-required data and documents.
- Cannot perform final approve/reject.

3. `RESPONSABILE_ALBO`
- Full review and decision scope.

4. `SUPER_ADMIN`
- Full system scope including deletion, role management, config.

5. `SUPPLIER`
- Own profile/application data only.

## Sensitive Field Policy

Sensitive fields include personal identifiers, fiscal/legal declarations, and potentially banking data.

- Read access must be explicitly granted by role.
- Access attempts must be auditable.

## Supplier Evaluation Assignment Rule

Requirement source intent:

- Supplier evaluations must be inserted by the internal Gruppo Solco referente/evaluator who collaborated directly with the supplier.
- Evaluations are immutable after submission, except annulment by Super Admin.
- Suppliers see aggregate scores and anonymous comments, not the internal evaluator identity.

Implemented operating rule:

1. Evaluator assignment is explicit per supplier registry profile.
   - The system stores the active evaluator assignment in `supplier_evaluator_assignments`.
   - The record links supplier profile, assigned evaluator, assigning actor, timestamp, active state, and optional reason.

2. Assignment managers:
   - `SUPER_ADMIN` can assign `SUPER_ADMIN`, `RESPONSABILE_ALBO`, or `REVISORE`.
   - `RESPONSABILE_ALBO` can assign `RESPONSABILE_ALBO` or `REVISORE`.
   - `REVISORE` cannot assign evaluators.
   - `VIEWER` cannot assign evaluators.

3. Evaluation submission:
   - `SUPER_ADMIN`, `RESPONSABILE_ALBO`, and `REVISORE` keep the role-level ability to submit evaluations.
   - A user can submit values for a supplier only when they are the active assigned evaluator for that supplier.
   - `VIEWER` remains read-only.

4. Annulment:
   - Only `SUPER_ADMIN` can annul an evaluation.
   - Annulment preserves the original row and marks it annulled with actor and timestamp.

5. Audit:
   - Every evaluator assignment change emits `revamp.supplier-evaluator.assigned`.
   - Audit captures old evaluator, new evaluator, actor role, supplier profile id, and reason.

How this satisfies the requirement:

- The system no longer treats evaluation as "any admin can rate any supplier".
- The assignment record is the system's proof of who is the internal collaborator/evaluator for that supplier.
- Revisore users can evaluate only when explicitly assigned by Super Admin or Responsabile Albo.
- Viewer users cannot insert values.
- Existing evaluation rows stay immutable; corrections are handled through new evaluations or Super Admin annulment.
