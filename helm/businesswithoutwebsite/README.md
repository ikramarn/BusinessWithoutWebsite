# BusinessWithoutWebsite Helm Chart

This chart deploys both services into Kubernetes:
- Frontend deployment and service
- Backend deployment and service
- Single ingress with path routing (`/` -> frontend, `/api` -> backend)

## Namespace

The default namespace in this chart is `newb`.

## Prerequisites

- A Kubernetes cluster
- `kubectl` and `helm` configured
- Container images for frontend and backend pushed to a registry accessible by the cluster
- An ingress controller (for example NGINX Ingress) if you keep ingress enabled

## Configure Values

Update at minimum:
- `frontend.image.repository`
- `frontend.image.tag`
- `backend.image.repository`
- `backend.image.tag`
- `ingress.host`
- `backend.secretEnv` API keys

## Install

```bash
helm upgrade --install businesswithoutwebsite ./helm/businesswithoutwebsite -n newb --create-namespace
```

## Upgrade with explicit values file

```bash
helm upgrade --install businesswithoutwebsite ./helm/businesswithoutwebsite -n newb --create-namespace -f ./helm/businesswithoutwebsite/values.yaml
```

## Verify

```bash
kubectl get pods -n newb
kubectl get svc -n newb
kubectl get ingress -n newb
```
