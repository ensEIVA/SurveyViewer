import { createClient } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import { API_URL } from '../config'
import { NexusService } from '../gen/nexus/v1/nexus_service_pb'

export const nexusClient = createClient(NexusService, createGrpcWebTransport({ baseUrl: API_URL }))
