import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Editors (Operations > Editors) ───────────────────────────────────────────
  {
    name: "mip_execute_groovy_script",
    description:
      "Groovy Editor: bir Groovy script'ini verilen input body + header + property'lere karşı çalıştırır ve sonucu (output, headers, properties) döner. " +
      "ÖNEMLI: script bir `executeMessage` metodu tanımlamalı ve parametre tipi `com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO` OLMALI (varsayılan şablondaki Exchange tipi runtime'da ÇALIŞMAZ), metod bu message'ı geri döndürmeli. " +
      "DTO metotları: getBody()/setBody(x), getHeaders()/setHeader(name,value), getProperties()/setProperty(name,value). " +
      "Örnek: `def executeMessage(com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO message) { message.setBody(message.getBody().toString().toUpperCase()); return message }`",
    inputSchema: {
      type: "object",
      properties: {
        groovyScript: { type: "string", description: "Çalıştırılacak Groovy script (executeMessage(ScriptExchangeDTO) tanımlamalı, message döndürmeli)" },
        input: { type: "string", description: "Input message body (opsiyonel)" },
        headers: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input header'ları [{name,value}] (opsiyonel)",
        },
        properties: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input exchange property'leri [{name,value}] (opsiyonel)",
        },
      },
      required: ["groovyScript"],
    },
  },
  {
    name: "mip_execute_xslt_transform",
    description:
      "XSLT Editor: verilen XML girdisine bir XSLT stylesheet uygular ve dönüşüm sonucunu (output, xsltVersion, outputMethod, status, errors) döner.",
    inputSchema: {
      type: "object",
      properties: {
        inputXml: { type: "string", description: "Dönüştürülecek XML girdi" },
        xsltCode: { type: "string", description: "XSLT stylesheet (tam <xsl:stylesheet> belgesi)" },
      },
      required: ["inputXml", "xsltCode"],
    },
  },
];

const handlers = {
    // ─── Editors ────────────────────────────────────────────────────────────────
    mip_execute_groovy_script: async (args, headers) => {
      const body = {
        input: args.input ?? "",
        groovyScript: args.groovyScript,
        headers: args.headers ?? [],
        properties: args.properties ?? [],
      };
      const res = await axios.post(`${BASE_URL}/api/groovy-script-execute`, body, { headers });
      return JSON.stringify(res.data, null, 2);
    },

    mip_execute_xslt_transform: async (args, headers) => {
      const body = { inputXml: args.inputXml, xsltCode: args.xsltCode };
      const res = await axios.post(`${BASE_URL}/api/xslt-transform-execute`, body, { headers });
      return JSON.stringify(res.data, null, 2);
    },
};

export default { tools, handlers };
