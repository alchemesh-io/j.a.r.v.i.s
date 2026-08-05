## REMOVED Requirements

### Requirement: Host-based HTTPRoute for JAAR in jaar namespace
**Reason**: JAAR is decommissioned; there is no `jaar-agentregistry` service to route to, and none ever existed on the target sandbox cluster.
**Migration**: Delete `helm/jaar/templates/httproute.yaml` along with the rest of the chart. No live HTTPRoute to remove on the target cluster since it never existed there.
