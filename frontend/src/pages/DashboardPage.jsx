import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { LogViewer } from "../components/LogViewer.jsx";
import { PipelineStageCard } from "../components/PipelineStageCard.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { usePipelineSocket } from "../hooks/usePipelineSocket.js";
import { api } from "../services/api.js";

const mergePipeline = (pipelines, incoming) => {
  const existing = pipelines.find((pipeline) => pipeline.id === incoming.id);

  if (!existing) {
    return [incoming, ...pipelines];
  }

  return pipelines
    .map((pipeline) => (pipeline.id === incoming.id ? incoming : pipeline))
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
};

export const DashboardPage = ({ token, user, onUserRefresh, onLogout }) => {
  const [repositories, setRepositories] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(user.github?.selectedRepository || null);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [logs, setLogs] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [actionMessage, setActionMessage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const githubStatus = params.get("github");

    if (githubStatus === "connected") {
      window.history.replaceState({}, "", "/dashboard");
      return "GitHub account connected successfully. You can load repositories now.";
    }

    if (githubStatus === "failed") {
      window.history.replaceState({}, "", "/dashboard");
      return "GitHub connection could not be completed. Please try again.";
    }

    return "";
  });
  const deferredPipelines = useDeferredValue(pipelines);

  const selectedPipeline = useMemo(
    () => deferredPipelines.find((pipeline) => pipeline.id === selectedPipelineId) || deferredPipelines[0] || null,
    [deferredPipelines, selectedPipelineId]
  );

  const handlePipelineUpdate = useCallback((pipeline) => {
    setPipelines((current) => mergePipeline(current, pipeline));
    if (selectedPipelineId === pipeline.id || !selectedPipelineId) {
      setSelectedPipelineId(pipeline.id);
      setLogs(pipeline.logs || "");
    }
  }, [selectedPipelineId]);

  usePipelineSocket(token, handlePipelineUpdate);

  useEffect(() => {
    setSelectedRepo(user.github?.selectedRepository || null);
  }, [user.github?.selectedRepository]);

  useEffect(() => {
    setLoadingPipelines(true);
    api
      .listPipelines(token)
      .then(({ pipelines: entries }) => {
        setPipelines(entries);
        if (entries[0]) {
          setSelectedPipelineId(entries[0].id);
          setLogs(entries[0].logs || "");
        }
      })
      .catch((error) => setActionMessage(error.message))
      .finally(() => setLoadingPipelines(false));
  }, [token]);

  useEffect(() => {
    if (!selectedPipeline?.id) {
      return;
    }

    api
      .getLogs(token, selectedPipeline.id)
      .then(({ logs: nextLogs }) => setLogs(nextLogs))
      .catch(() => {});
  }, [selectedPipeline?.id, token]);

  const connectGithub = async () => {
    try {
      const { url } = await api.getGithubConnectUrl(token);
      window.location.href = url;
    } catch (error) {
      setActionMessage(error.message);
    }
  };

  const loadRepositories = async () => {
    setLoadingRepos(true);
    setActionMessage("");

    try {
      const { repositories: entries } = await api.listRepositories(token);
      setRepositories(entries);
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setLoadingRepos(false);
    }
  };

  const saveRepository = async (repository) => {
    try {
      setActionMessage("");
      const response = await api.selectRepository(token, repository);
      setSelectedRepo(repository);
      await onUserRefresh(response.user);
      setActionMessage(`Repository ${repository.fullName} is now connected to Jenkins automation.`);
    } catch (error) {
      setActionMessage(error.message);
    }
  };

  const triggerPipeline = async () => {
    try {
      setActionMessage("");
      const { pipeline } = await api.triggerPipeline(token, selectedRepo);
      setPipelines((current) => mergePipeline(current, pipeline));
      setSelectedPipelineId(pipeline.id);
      setLogs(pipeline.logs || "");
      setActionMessage("Pipeline triggered. Jenkins will now build, test, containerize, and deploy.");
    } catch (error) {
      setActionMessage(error.message);
    }
  };

  return (
    <div className="dashboard-shell">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="dashboard-main">
        <section className="hero-strip">
          <div>
            <p className="eyebrow">Operations dashboard</p>
            <h2>Repository-driven delivery with rollback-aware deployment flow</h2>
          </div>
          <div className="hero-actions">
            <button className="secondary-button" onClick={connectGithub}>
              {user.github?.connected ? "Reconnect GitHub" : "Connect GitHub"}
            </button>
            <button className="primary-button" disabled={!selectedRepo} onClick={triggerPipeline}>
              Trigger pipeline
            </button>
          </div>
        </section>

        {actionMessage ? <p className="banner-info">{actionMessage}</p> : null}

        <section className="dashboard-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Source control</p>
                <h3>GitHub repositories</h3>
              </div>
              <button className="secondary-button" onClick={loadRepositories}>
                {loadingRepos ? "Loading..." : "Load repositories"}
              </button>
            </div>

            {!user.github?.connected ? (
              <p className="muted-copy">
                Connect your GitHub account to browse repositories and auto-provision the webhook.
              </p>
            ) : (
              <div className="repo-list">
                {repositories.length === 0 ? (
                  <p className="muted-copy">No repositories loaded yet.</p>
                ) : (
                  repositories.map((repository) => (
                    <button
                      key={repository.id}
                      className={`repo-card ${selectedRepo?.id === repository.id ? "repo-card-active" : ""}`}
                      onClick={() => saveRepository(repository)}
                    >
                      <strong>{repository.fullName}</strong>
                      <span>{repository.private ? "Private" : "Public"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Pipeline engine</p>
                <h3>Recent runs</h3>
              </div>
            </div>

            {loadingPipelines ? (
              <p className="muted-copy">Loading pipelines...</p>
            ) : pipelines.length === 0 ? (
              <p className="muted-copy">No pipeline activity yet.</p>
            ) : (
              <div className="pipeline-list">
                {pipelines.map((pipeline) => (
                  <button
                    key={pipeline.id}
                    className={`pipeline-card ${selectedPipeline?.id === pipeline.id ? "pipeline-card-active" : ""}`}
                    onClick={() => setSelectedPipelineId(pipeline.id)}
                  >
                    <div>
                      <strong>{pipeline.repository.fullName}</strong>
                      <p>{pipeline.source} trigger</p>
                    </div>
                    <span className={`status-pill status-${pipeline.status}`}>{pipeline.status}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="detail-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Execution view</p>
                <h3>Stage status</h3>
              </div>
            </div>

            {selectedPipeline ? (
              <>
                <div className="deployment-summary">
                  <div>
                    <p className="summary-label">Environment</p>
                    <strong>{selectedPipeline.targetEnvironment}</strong>
                  </div>
                  <div>
                    <p className="summary-label">Deployment status</p>
                    <strong>{selectedPipeline.status}</strong>
                  </div>
                </div>

                <div className="stage-grid">
                  {selectedPipeline.stages.map((stage) => (
                    <PipelineStageCard key={stage.key} stage={stage} />
                  ))}
                </div>
              </>
            ) : (
              <p className="muted-copy">Select a pipeline run to inspect its state.</p>
            )}
          </section>

          <LogViewer logs={logs} />
        </section>
      </main>
    </div>
  );
};
