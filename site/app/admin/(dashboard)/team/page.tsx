import AdminInviteForm from "@/components/AdminInviteForm";
import { listTeam } from "@/lib/admin-team";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const members = await listTeam();

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Team</h1>
          <p className="admin-head__note">
            Everyone who can sign in to this dashboard. Adding someone creates their account and
            gives you a link to send them.
          </p>
        </div>
      </div>

      <h2 className="admin-section-title" style={{ marginTop: 0 }}>
        Add someone, or re-issue a link
      </h2>
      <AdminInviteForm />

      <h2 className="admin-section-title">Accounts</h2>
      <div className="admin-table-wrap">
        {members.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Added</th>
                <th>Last signed in</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.email}</td>
                  <td className="admin-table__time">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="admin-table__time">
                    {member.lastSignInAt ? (
                      new Date(member.lastSignInAt).toLocaleString()
                    ) : (
                      // The useful signal when onboarding: the account exists
                      // but the person has never got in, so their link needs
                      // re-issuing.
                      <span className="admin-badge admin-badge--submitted">Never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty">
            <p className="admin-empty__title">No accounts yet</p>
            <p className="admin-empty__hint">Add the first one above.</p>
          </div>
        )}
      </div>

    </div>
  );
}
