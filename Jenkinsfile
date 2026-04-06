pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    string(name: 'RUN_ID', defaultValue: '', description: 'Platform pipeline run identifier')
    string(name: 'REPOSITORY_URL', defaultValue: '', description: 'Target repository clone URL')
    string(name: 'REPOSITORY_NAME', defaultValue: '', description: 'owner/name of the selected repository')
    string(name: 'DEFAULT_BRANCH', defaultValue: 'main', description: 'Branch to build')
    string(name: 'DOCKER_IMAGE', defaultValue: 'ghcr.io/example/app', description: 'Target image name')
    string(name: 'K8S_NAMESPACE', defaultValue: 'devops-platform', description: 'Target namespace')
  }

  stages {
    stage('Checkout') {
      options { timeout(time: 5, unit: 'MINUTES') }
      steps {
        withCredentials([string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')]) {
          sh '''
            echo "[stage:checkout][status:start]"
            rm -rf application
            AUTHENTICATED_URL=$(echo "${REPOSITORY_URL}" | sed "s#https://#https://oauth2:${GITHUB_TOKEN}@#")
            git clone --branch "${DEFAULT_BRANCH}" "${AUTHENTICATED_URL}" application
            echo "[stage:checkout][status:success]"
          '''
        }
      }
      post {
        failure {
          sh 'echo "[stage:checkout][status:failed]"'
        }
      }
    }

    stage('Detect') {
      steps {
        sh '''
          echo "[stage:detect][status:start]"
          PROJECT_TYPE=$(./infra/jenkins/detect-project.sh application)
          echo "${PROJECT_TYPE}" > .project-type
          case "${PROJECT_TYPE}" in
            node) echo "3000" > .app-port ;;
            java) echo "8080" > .app-port ;;
            python) echo "8000" > .app-port ;;
            go) echo "8080" > .app-port ;;
          esac
          echo "Detected ${PROJECT_TYPE}"
          echo "[stage:detect][status:success]"
        '''
      }
      post {
        failure {
          sh 'echo "[stage:detect][status:failed]"'
        }
      }
    }

    stage('Build') {
      options { timeout(time: 10, unit: 'MINUTES') }
      steps {
        retry(3) {
          sh '''
            echo "[stage:build][status:start]"
            ./infra/jenkins/build-and-test.sh application "$(cat .project-type)" build
            echo "[stage:build][status:success]"
          '''
        }
      }
      post {
        failure {
          sh 'echo "[stage:build][status:failed]"'
        }
      }
    }

    stage('Test') {
      options { timeout(time: 10, unit: 'MINUTES') }
      steps {
        retry(3) {
          sh '''
            echo "[stage:test][status:start]"
            ./infra/jenkins/build-and-test.sh application "$(cat .project-type)" test
            echo "[stage:test][status:success]"
          '''
        }
      }
      post {
        failure {
          sh 'echo "[stage:test][status:failed]"'
        }
      }
    }

    stage('Containerize') {
      options { timeout(time: 15, unit: 'MINUTES') }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          retry(3) {
            sh '''
              echo "[stage:containerize][status:start]"
              REGISTRY_HOST=$(echo "${DOCKER_IMAGE}" | cut -d/ -f1)
              echo "${REG_PASS}" | docker login "${REGISTRY_HOST}" -u "${REG_USER}" --password-stdin
              DOCKERFILE_PATH=$(./infra/jenkins/render-dockerfile.sh application "$(cat .project-type)")
              docker build -f "$DOCKERFILE_PATH" -t "${DOCKER_IMAGE}:${BUILD_NUMBER}" -t "${DOCKER_IMAGE}:latest" application
              docker push "${DOCKER_IMAGE}:${BUILD_NUMBER}"
              docker push "${DOCKER_IMAGE}:latest"
              echo "[stage:containerize][status:success]"
            '''
          }
        }
      }
      post {
        failure {
          sh 'echo "[stage:containerize][status:failed]"'
        }
      }
    }

    stage('Auto Commit Metadata') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh '''
            ./infra/jenkins/auto-commit-version.sh application "${DEFAULT_BRANCH}" "${RUN_ID}"
          '''
        }
      }
    }

    stage('Deploy') {
      options { timeout(time: 10, unit: 'MINUTES') }
      steps {
        retry(3) {
          sh '''
            echo "[stage:deploy][status:start]"
            ./infra/jenkins/self-heal-deploy.sh apply application "${REPOSITORY_NAME##*/}" "${DOCKER_IMAGE}:${BUILD_NUMBER}" "${K8S_NAMESPACE}" "$(cat .app-port)"
            echo "[stage:deploy][status:success]"
          '''
        }
      }
      post {
        failure {
          sh 'echo "[stage:deploy][status:failed]"'
        }
      }
    }

    stage('Verify') {
      options { timeout(time: 10, unit: 'MINUTES') }
      steps {
        sh '''
          echo "[stage:verify][status:start]"
          ./infra/jenkins/self-heal-deploy.sh verify application "${REPOSITORY_NAME##*/}" "${DOCKER_IMAGE}:${BUILD_NUMBER}" "${K8S_NAMESPACE}" "$(cat .app-port)"
          echo "[stage:verify][status:success]"
        '''
      }
      post {
        failure {
          sh 'echo "[stage:verify][status:failed]"'
        }
      }
    }
  }
}
