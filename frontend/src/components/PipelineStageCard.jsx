export const PipelineStageCard = ({ stage }) => (
  <article className={`stage-card stage-${stage.status}`}>
    <span className="stage-dot" />
    <div>
      <p className="stage-label">{stage.label}</p>
      <p className="stage-status">{stage.status}</p>
    </div>
  </article>
);

