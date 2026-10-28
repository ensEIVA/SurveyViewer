// The Nexus topic keys, as the backend publishes them: "<package>/<service>/<method>".
// Not the generated *Topic constants: protoc-gen-fletcher's TypeScript output turns
// the package's dots into slashes ("nexus/topics/v1/..."), while its C++ output,
// which Nexus publishes with, keeps them. Switch back once the generators agree.
export const LIVE_POINTS_TOPIC = 'nexus.topics.v1/LivePoints/Snapshot'
export const VESSEL_POSITION_TOPIC = 'nexus.topics.v1/VesselPositions/Position'
