// ─── Queues (Operations > Queues) — Kafka topic izleme/yönetim ─────────────────
// v1.16.0-rc.5+ ile gelen özellik. Endpoint: /api/queues/kafka/topics.
import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  {
    name: "mip_list_kafka_topics",
    description:
      "Queues: Kafka topic listesini döner. Her topic: bootstrapServers (cluster), topic, status (HEALTHY/DOWN), producerCount, consumerCount, inMip. scope='MIP' yalnızca MIP flow'larının kullandığı topic'ler, scope='ALL' cluster'daki tüm topic'ler. Sayfalı; filter topic/cluster'da arar.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["MIP", "ALL"], description: "MIP (varsayılan) = MIP topic'leri; ALL = tüm topic'ler" },
        filter: { type: "string", description: "Opsiyonel: topic veya cluster adında geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 25)" },
        forceRefresh: { type: "boolean", description: "Önbelleği atlayıp cluster'dan taze veri çek (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "mip_get_kafka_topic_detail",
    description:
      "Queues: bir Kafka topic'inin detayını döner — cluster durumu (brokers/onlineBrokers), partitions, replicationFactor, retentionMs/Bytes, cleanupPolicy, compressionType, ve topic'i kullanan MIP producer/consumer flow'ları (flowId, deployed, sayaçlar). bootstrapServers + topic zorunlu.",
    inputSchema: {
      type: "object",
      properties: {
        bootstrapServers: { type: "string", description: "Cluster bootstrap servers (mip_list_kafka_topics'ten alınır, ör. 'kafka:9092')" },
        topic: { type: "string", description: "Topic adı" },
        windowMinutes: { type: "number", description: "İstatistik penceresi (dakika, varsayılan 60)" },
        forceRefresh: { type: "boolean", description: "Önbelleği atla (opsiyonel)" },
      },
      required: ["bootstrapServers", "topic"],
    },
  },
  {
    name: "mip_update_kafka_topic",
    description:
      "Queues: bir Kafka topic'inin ayarlarını günceller (retention, partitions vb.). DİKKAT: gerçek Kafka topic konfigürasyonunu değiştirir. changes, değiştirilecek ayarları içeren bir objedir (ör. {retentionMs: 604800000}). Yalnızca 'editable' topic'lerde çalışır.",
    inputSchema: {
      type: "object",
      properties: {
        bootstrapServers: { type: "string", description: "Cluster bootstrap servers" },
        topic: { type: "string", description: "Topic adı" },
        changes: { type: "object", description: "Değiştirilecek topic ayarları (ör. {retentionMs, retentionBytes, cleanupPolicy, compressionType, maxMessageBytes})" },
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
