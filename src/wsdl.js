// ─── WSDL Helpers ─────────────────────────────────────────────────────────────
// MIP, SOAP Start adapter icin yuklenen WSDL'lerde her <xs:schema> elementinde
// elementFormDefault="qualified" olmasini zorunlu kilar. Bu deger eksikse veya
// "unqualified" ise SOAP Sender flow'lari beklendigi gibi calismaz.
import { err } from "./i18n/index.js";
export function ensureElementFormDefaultQualified(wsdlContent) {
  const warnings = [];
  const schemaTagRegex = /<([\w-]+:)?schema\b([^>]*?)(\/?)>/g;
  const result = wsdlContent.replace(schemaTagRegex, (match, prefix, attrs, selfClose) => {
    const efdMatch = attrs.match(/elementFormDefault\s*=\s*"([^"]*)"/);
    const ns = prefix ?? "";
    if (efdMatch) {
      if (efdMatch[1] !== "qualified") {
        warnings.push(`<${ns}schema> uzerinde elementFormDefault="${efdMatch[1]}" bulundu, "qualified" ile degistirildi.`);
        const newAttrs = attrs.replace(/elementFormDefault\s*=\s*"[^"]*"/, 'elementFormDefault="qualified"');
        return `<${ns}schema${newAttrs}${selfClose}>`;
      }
      return match;
    }
    warnings.push(`<${ns}schema> uzerinde elementFormDefault yoktu, "qualified" enjekte edildi.`);
    return `<${ns}schema${attrs} elementFormDefault="qualified"${selfClose}>`;
  });
  return { content: result, warnings, modified: warnings.length > 0 };
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateXsdElement(elementName, fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return `      <xsd:element name="${escapeXml(elementName)}">\n        <xsd:complexType>\n          <xsd:sequence/>\n        </xsd:complexType>\n      </xsd:element>`;
  }
  const fieldXml = fields.map(f => {
    const name = escapeXml(f.name);
    const type = f.type ?? "string";
    const minOccurs = f.minOccurs ?? 0;
    const maxOccurs = f.maxOccurs ?? 1;
    const typeAttr = type.includes(":") ? type : `xsd:${type}`;
    return `            <xsd:element name="${name}" type="${escapeXml(typeAttr)}" minOccurs="${minOccurs}" maxOccurs="${maxOccurs}"/>`;
  }).join("\n");
  return `      <xsd:element name="${escapeXml(elementName)}">\n        <xsd:complexType>\n          <xsd:sequence>\n${fieldXml}\n          </xsd:sequence>\n        </xsd:complexType>\n      </xsd:element>`;
}

export function generateWsdl({ serviceName, targetNamespace, serviceAddress, operations }) {
  if (!serviceName) throw err.at("wsdl.serviceNameRequired", null, "generateWsdl: serviceName is required.");
  if (!targetNamespace) throw err.at("wsdl.targetNamespaceRequired", null, "generateWsdl: targetNamespace is required.");
  if (!Array.isArray(operations) || operations.length === 0) {
    throw err.at("wsdl.operationRequired", null, "generateWsdl: at least one operation must be defined.");
  }
  const tns = targetNamespace;
  const addr = serviceAddress || `http://localhost/soap/${serviceName}`;

  const schemaElements = [];
  for (const op of operations) {
    if (!op.name) throw err.at("wsdl.operationNameRequired", null, "generateWsdl: name is required for every operation.");
    schemaElements.push(generateXsdElement(`${op.name}Request`, op.request?.fields ?? []));
    schemaElements.push(generateXsdElement(`${op.name}Response`, op.response?.fields ?? []));
  }

  const messages = operations.flatMap(op => [
    `  <wsdl:message name="${op.name}RequestMessage">\n    <wsdl:part name="parameters" element="tns:${op.name}Request"/>\n  </wsdl:message>`,
    `  <wsdl:message name="${op.name}ResponseMessage">\n    <wsdl:part name="parameters" element="tns:${op.name}Response"/>\n  </wsdl:message>`,
  ]);

  const portTypeOps = operations.map(op =>
    `    <wsdl:operation name="${op.name}">\n      <wsdl:input message="tns:${op.name}RequestMessage"/>\n      <wsdl:output message="tns:${op.name}ResponseMessage"/>\n    </wsdl:operation>`
  );

  const bindingOps = operations.map(op => {
    const action = op.soapAction ?? `${tns}/${op.name}`;
    return `    <wsdl:operation name="${op.name}">\n      <soap:operation soapAction="${escapeXml(action)}"/>\n      <wsdl:input>\n        <soap:body use="literal"/>\n      </wsdl:input>\n      <wsdl:output>\n        <soap:body use="literal"/>\n      </wsdl:output>\n    </wsdl:operation>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:tns="${escapeXml(tns)}"
    targetNamespace="${escapeXml(tns)}">

  <wsdl:types>
    <xsd:schema targetNamespace="${escapeXml(tns)}" elementFormDefault="qualified">
${schemaElements.join("\n")}
    </xsd:schema>
  </wsdl:types>

${messages.join("\n")}

  <wsdl:portType name="${serviceName}PortType">
${portTypeOps.join("\n")}
  </wsdl:portType>

  <wsdl:binding name="${serviceName}Binding" type="tns:${serviceName}PortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
${bindingOps.join("\n")}
  </wsdl:binding>

  <wsdl:service name="${serviceName}">
    <wsdl:port name="${serviceName}Port" binding="tns:${serviceName}Binding">
      <soap:address location="${escapeXml(addr)}"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>
`;
}
