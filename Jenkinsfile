pipeline {
    agent any

    environment {
        DOCKERHUB_REPO = 'ikcloudky6/newbusiness'
        BACKEND_TAG    = "backend-${env.GIT_COMMIT[0..6]}"
        FRONTEND_TAG   = "frontend-${env.GIT_COMMIT[0..6]}"
        NAMESPACE      = 'newb'
        RELEASE_NAME   = 'businesswithoutwebsite'
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Images') {
            parallel {
                stage('Backend') {
                    steps {
                        sh """
                            docker build \
                              -t ${DOCKERHUB_REPO}:${BACKEND_TAG} \\
                              -t ${DOCKERHUB_REPO}:backend-latest \\
                              ./backend
                        """
                    }
                }
                stage('Frontend') {
                    steps {
                        sh """
                            docker build \\
                              -t ${DOCKERHUB_REPO}:${FRONTEND_TAG} \\
                              -t ${DOCKERHUB_REPO}:frontend-latest \\
                              ./frontend
                        """
                    }
                }
            }
        }

        stage('Push Images') {
            steps {
                // dockerhub-credentials -> Jenkins "Username with password" credential
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh "docker push ${BACKEND_IMAGE}:${BACKEND_TAG}"
                    sh "docker push ${BACKEND_IMAGE}:backend-latest"
                    sh "docker push ${FRONTEND_IMAGE}:${FRONTEND_TAG}"
                    sh "docker push ${FRONTEND_IMAGE}:frontend-latest"
                }
            }
        }

        stage('Deploy') {
            steps {
                // newb-kubeconfig  -> Jenkins "Secret file" credential (your newb-cluster.yaml)
                // google-places-api-key, companies-house-api-key, bing-search-api-key
                //   -> Jenkins "Secret text" credentials
                withCredentials([
                    file(credentialsId: 'newb-kubeconfig', variable: 'KUBECONFIG'),
                    string(credentialsId: 'google-places-api-key',    variable: 'GOOGLE_KEY'),
                    string(credentialsId: 'companies-house-api-key',  variable: 'CH_KEY'),
                    string(credentialsId: 'bing-search-api-key',      variable: 'BING_KEY')
                ]) {
                    sh """
                        helm upgrade --install ${RELEASE_NAME} ./helm/businesswithoutwebsite \
                          --namespace ${NAMESPACE} \
                          --create-namespace \
                          --set frontend.image.repository=${DOCKERHUB_REPO} \\
                          --set frontend.image.tag=${FRONTEND_TAG} \\
                          --set backend.image.repository=${DOCKERHUB_REPO} \\
                          --set backend.image.tag=${BACKEND_TAG} \\
                          --set backend.secretEnv.GOOGLE_PLACES_API_KEY="\${GOOGLE_KEY}" \
                          --set backend.secretEnv.COMPANIES_HOUSE_API_KEY="\${CH_KEY}" \
                          --set backend.secretEnv.BING_SEARCH_API_KEY="\${BING_KEY}" \                          --set ingress.tls.enabled=false \                          --wait \
                          --timeout 5m
                    """
                }
            }
        }

        stage('Verify') {
            steps {
                withCredentials([file(credentialsId: 'newb-kubeconfig', variable: 'KUBECONFIG')]) {
                    sh "kubectl rollout status deployment/${RELEASE_NAME}-backend  -n ${NAMESPACE} --timeout=2m"
                    sh "kubectl rollout status deployment/${RELEASE_NAME}-frontend -n ${NAMESPACE} --timeout=2m"
                    sh "kubectl get pods -n ${NAMESPACE}"
                }
            }
        }
    }

    post {
        success {
            echo "Deployment to namespace ${NAMESPACE} succeeded. Backend: ${BACKEND_TAG}  Frontend: ${FRONTEND_TAG}"
        }
        failure {
            withCredentials([file(credentialsId: 'newb-kubeconfig', variable: 'KUBECONFIG')]) {
                sh "kubectl get pods -n ${NAMESPACE} || true"
                sh "kubectl describe pods -n ${NAMESPACE} || true"
            }
        }
        always {
            sh "docker rmi ${DOCKERHUB_REPO}:${BACKEND_TAG}  || true"
            sh "docker rmi ${DOCKERHUB_REPO}:${FRONTEND_TAG} || true"
            sh 'docker logout || true'
        }
    }
}
