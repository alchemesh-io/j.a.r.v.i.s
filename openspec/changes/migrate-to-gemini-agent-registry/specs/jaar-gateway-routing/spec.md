## REMOVED Requirements

### Requirement: Host-based HTTPRoute for JAAR in jaar namespace
**Reason**: JAAR is decommissioned; there is no `jaar` namespace or AgentRegistry service left to route to. See `jaar-deployment` (removed) and `agent-platform-registration` (added) for the replacement architecture.
**Migration**: Delete the HTTPRoute template from `helm/jaar/` (the whole chart is removed). Gemini Enterprise Agent Registry is a managed Google Cloud service reached via the Google Cloud Console / API, not via this repository's Istio gateway.
