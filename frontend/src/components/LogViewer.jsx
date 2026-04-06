export const LogViewer = ({ logs }) => (
  <section className="panel log-panel">
    <div className="panel-header">
      <div>
        <p className="eyebrow">Console</p>
        <h3>Pipeline logs</h3>
      </div>
    </div>
    <pre>{logs || "No logs available yet. Trigger a pipeline or wait for Jenkins to stream output."}</pre>
  </section>
);
