// ─── Queues (Operations > Queues) — Kafka topic izleme/yönetim ─────────────────
// v1.16.0-rc.5+ ile gelen özellik. Endpoint: /api/queues/kafka/topics.
import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  {
    name: "mip_list_kafka_topics",
    description:
      "Queues: returns the Kafka topic list. Each topic: bootstrapServers (cluster), topic, status (HEALTHY/DOWN), producerCount, consumerCount, inMip. scope='MIP' returns only topics used by MIP flows, scope='ALL' every topic in the cluster. Paginated; filter searches topic/cluster.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["MIP", "ALL"], description: "MIP (default) = MIP topics; ALL = all topics" },
        filter: { type: "string", description: "Optional: text occurring in the topic or cluster name" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 25)" },
        forceRefresh: { type: "boolean", description: "Bypass the cache and fetch fresh data from the cluster (optional)" },
      },
      required: [],
    },
  },
  {
    name: "mip_get_kafka_topic_detail",
    description:
      "Queues: returns the detail of a Kafka topic — cluster state (brokers/onlineBrokers), partitions, replicationFactor, retentionMs/Bytes, cleanupPolicy, compressionType, and the MIP producer/consumer flows using the topic (flowId, deployed, counters). bootstrapServers + topic are required.",
    inputSchema: {
      type: "object",
      properties: {
        bootstrapServers: { type: "string", description: "Cluster bootstrap servers (from mip_list_kafka_topics, e.g. 'kafka:9092')" },
        topic: { type: "string", description: "Topic name" },
        windowMinutes: { type: "number", description: "Statistics window (minutes, default 60)" },
        forceRefresh: { type: "boolean", description: "Bypass the cache (optional)" },
      },
      required: ["bootstrapServers", "topic"],
    },
  },
  {
    name: "mip_update_kafka_topic",
    description:
      "Queues: updates a Kafka topic's settings (retention, partitions etc.). CAUTION: this changes the real Kafka topic configuration. changes is an object holding the settings to modify (e.g. {retentionMs: 604800000}). Works only on 'editable' topics.",
    inputSchema: {
      type: "object",
      properties: {
        bootstrapServers: { type: "string", description: "Cluster bootstrap servers" },
        topic: { type: "string", description: "Topic name" },
        changes: { type: "object", description: "Topic settings to change (e.g. {retentionMs, retentionBytes, cleanupPolicy, compressionType, maxMessageBytes})" },
      },
      required: ["bootstrapServers", "topic", "changes"],
    },
  },
];

const handlers = {
  mip_list_kafka_topics: async (args, headers) => {
    const scope = args.scope ?? "MIP";
    const page = (args.page ?? 1) - 1;
    const size = args.size ?? 25;
    let url = `${BASE_URL}/api/queues/kafka/topics?scope=${scope}&paginationPage=${page}&paginationSize=${size}`;
    if (args.filter) url += `&filter=${encodeURIComponent(args.filter)}`;
    if (args.forceRefresh) url += `&forceRefresh=true`;
    const res = await axios.get(url, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_get_kafka_topic_detail: async (args, headers) => {
    const w = args.windowMinutes ?? 60;
    let url = `${BASE_URL}/api/queues/kafka/topics/detail?bootstrapServers=${encodeURIComponent(args.bootstrapServers)}&topic=${encodeURIComponent(args.topic)}&windowMinutes=${w}`;
    if (args.forceRefresh) url += `&forceRefresh=true`;
    const res = await axios.get(url, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_update_kafka_topic: async (args, headers) => {
    const body = { bootstrapServers: args.bootstrapServers, topic: args.topic, changes: args.changes };
    const res = await axios.put(`${BASE_URL}/api/queues/kafka/topics`, body, { headers });
    return `Kafka topic güncellendi (${args.topic}): ${JSON.stringify(res.data)}`;
  },
};

export default { tools, handlers };
