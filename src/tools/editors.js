import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Editors (Operations > Editors) ───────────────────────────────────────────
  {
    name: "mip_execute_groovy_script",
    description:
      "Groovy Editor: runs a Groovy script against the given input body + headers + properties and returns the result (output, headers, properties). " +
      "IMPORTANT: the script MUST define an `executeMessage` method whose parameter type is `com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO` (the Exchange type in the default template DOES NOT work at runtime), and the method must return that message. " +
      "DTO methods: getBody()/setBody(x), getHeaders()/setHeader(name,value), getProperties()/setProperty(name,value). " +
      "Example: `def executeMessage(com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO message) { message.setBody(message.getBody().toString().toUpperCase()); return message }`",
    inputSchema: {
      type: "object",
      properties: {
        groovyScript: { type: "string", description: "Groovy script to run (must define executeMessage(ScriptExchangeDTO) and return the message)" },
        input: { type: "string", description: "Input message body (optional)" },
        headers: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input headers [{name,value}] (optional)",
        },
        properties: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input exchange properties [{name,value}] (optional)",
        },
      },
      required: ["groovyScript"],
    },
  },
  {
    name: "mip_execute_xslt_transform",
    description:
      "XSLT Editor: applies an XSLT stylesheet to the given XML input and returns the transformation result (output, xsltVersion, outputMethod, status, errors).",
    inputSchema: {
      type: "object",
      properties: {
        inputXml: { type: "string", description: "XML input to transform" },
        xsltCode: { type: "string", description: "XSLT stylesheet (a complete <xsl:stylesheet> document)" },
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
