export const Sidebar = ({ user, onLogout }) => (
  <aside className="sidebar">
    <div>
      <p className="eyebrow">ForgeOps</p>
      <h1>Deployment control without babysitting pipelines.</h1>
      <p className="sidebar-copy">
        Connect GitHub, bind a repository, and send code through a Jenkins-driven,
        self-healing release path with live status visibility.
      </p>
    </div>

    <div className="profile-card">
      <div className="avatar-shell">
        {user?.github?.avatarUrl ? (
          <img src={user.github.avatarUrl} alt={user.name} className="avatar-image" />
        ) : (
          <span>{user?.name?.charAt(0) || "U"}</span>
        )}
      </div>
      <div>
        <strong>{user?.name}</strong>
        <p>{user?.email}</p>
      </div>
      <button className="ghost-button" onClick={onLogout}>
        Logout
      </button>
    </div>
  </aside>
);

