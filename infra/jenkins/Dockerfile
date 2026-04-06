FROM jenkins/jenkins:lts-jdk17

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    docker-cli \
    git \
    gnupg \
    jq \
    lsb-release \
  \
  # 🔥 ADD NODE.JS HERE
  && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs \
  \
  # install kubectl
  && curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl" \
  && chmod +x /usr/local/bin/kubectl \
  \
  && rm -rf /var/lib/apt/lists/*

COPY infra/jenkins/plugins.txt /usr/share/jenkins/ref/plugins.txt

RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

USER jenkins