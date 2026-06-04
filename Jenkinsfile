pipeline {
    agent any

    environment {
        REGISTRY       = '100.93.86.88:30980'
        BACKEND_IMAGE  = "${REGISTRY}/businesswithoutwebsite-backend"
        FRONTEND_IMAGE = "${REGISTRY}/businesswithoutwebsite-frontend"
        IMAGE_TAG      = "${env.GIT_COMMIT[0..6]}"
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
                              -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                              -t ${BACKEND_IMAGE}:latest \
                              ./backend
                        """
                    }
                }
                stage('Frontend') {
                    steps {
                        sh """
                            docker build \
                              -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                              -t ${FRONTEND_IMAGE}:latest \
                              ./frontend
                        """
                    }
                }
            }
        }

        stage('Push Images') {
            parallel {
                stage('Push Backend') {
                    steps {
                        sh "docker push ${BACKEND_IMAGE}:${IMAGE_TAG}"
                        sh "docker push ${BACKEND_IMAGE}:latest"
                    }
                }
                stage('Push Frontend') {
                    steps {
                        sh "docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}"
                        sh "docker push ${FRONTEND_IMAGE}:latest"
                    }
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
                          --set frontend.image.tag=${IMAGE_TAG} \
                          --set backend.image.tag=${IMAGE_TAG} \
                          --set backend.secretEnv.GOOGLE_PLACES_API_KEY="\${GOOGLE_KEY}" \
                          --set backend.secretEnv.COMPANIES_HOUSE_API_KEY="\${CH_KEY}" \
                          --set backend.secretEnv.BING_SEARCH_API_KEY="\${BING_KEY}" \
                          --wait \
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
            echo "Deployment ${IMAGE_TAG} to namespace ${NAMESPACE} succeeded."
        }
        failure {
            withCredentials([file(credentialsId: 'newb-kubeconfig', variable: 'KUBECONFIG')]) {
                sh "kubectl get pods -n ${NAMESPACE} || true"
                sh "kubectl describe pods -n ${NAMESPACE} || true"
            }
        }
        always {
            // Clean up local images to save disk space on Jenkins agent
            sh "docker rmi ${BACKEND_IMAGE}:${IMAGE_TAG}  || true"
            sh "docker rmi ${FRONTEND_IMAGE}:${IMAGE_TAG} || true"
        }
    }
}
