#!/usr/bin/env bash
set -euo pipefail

mode="${1:?mode is required}"
repo_dir="${2:?repository path is required}"
app_name="${3:?application name is required}"
image="${4:?image is required}"
namespace="${5:?namespace is required}"
port="${6:-3000}"

manifest_dir="${repo_dir}/.forgeops/k8s"
deployment_file="${manifest_dir}/deployment.yaml"
service_file="${manifest_dir}/service.yaml"

mkdir -p "${manifest_dir}"

render_manifests() {
  cat > "${deployment_file}" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${app_name}
  namespace: ${namespace}
spec:
  replicas: 2
  revisionHistoryLimit: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ${app_name}
  template:
    metadata:
      labels:
        app: ${app_name}
    spec:
      restartPolicy: Always
      containers:
        - name: ${app_name}
          image: ${image}
          imagePullPolicy: Always
          ports:
            - containerPort: ${port}
          readinessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 20
            periodSeconds: 15
            timeoutSeconds: 5
EOF

  cat > "${service_file}" <<EOF
apiVersion: v1
kind: Service
metadata:
  name: ${app_name}
  namespace: ${namespace}
spec:
  type: NodePort
  selector:
    app: ${app_name}
  ports:
    - port: 80
      targetPort: ${port}
      protocol: TCP
EOF
}

kubectl get namespace "${namespace}" >/dev/null 2>&1 || kubectl create namespace "${namespace}"

case "${mode}" in
  apply)
    render_manifests
    kubectl apply -f "${deployment_file}"
    kubectl apply -f "${service_file}"
    ;;
  verify)
    if kubectl rollout status "deployment/${app_name}" -n "${namespace}" --timeout=180s; then
      exit 0
    fi

    echo "[stage:selfheal][status:start]"
    kubectl rollout undo "deployment/${app_name}" -n "${namespace}"
    kubectl rollout status "deployment/${app_name}" -n "${namespace}" --timeout=180s
    echo "[stage:selfheal][status:success]"
    ;;
  *)
    echo "Unknown deployment mode: ${mode}" >&2
    exit 1
    ;;
esac
