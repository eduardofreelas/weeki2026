import type { ContractTemplate } from "@/shared/contracts";

const now = "2026-09-10T12:00:00.000Z";

export const serviceAgreementTemplateContent = `
<h1>Contrato de Prestação de Serviços</h1>
<p>Pelo presente instrumento, <strong>{{business.name}}</strong>, doravante denominada CONTRATADA, e <strong>{{client.name}}</strong>, doravante denominada CONTRATANTE, ajustam a prestação dos serviços descritos neste contrato.</p>
<h2>1. Objeto</h2>
<p>A CONTRATADA prestará os serviços de <strong>{{service.title}}</strong>, conforme descrição: {{service.description}}</p>
<p>Escopo: {{service.scope}}</p>
<h2>2. Entregas e Prazos</h2>
<p>As entregas previstas são: {{service.deliverables}}</p>
<p>Prazo estimado: {{service.deadline}}. Revisões incluídas: {{service.revisions}}.</p>
<h2>3. Valor e Condições de Pagamento</h2>
<p>O valor total contratado é de {{contract.value}}, pago conforme as seguintes condições: {{contract.paymentTerms}}</p>
<h2>4. Vigência</h2>
<p>Este contrato inicia em {{contract.startDate}} e terá término em {{contract.endDate}}, salvo renovação, rescisão ou encerramento formal pelas partes.</p>
<h2>5. Responsabilidades</h2>
<p>A CONTRATADA executará os serviços com zelo técnico e comunicação adequada. A CONTRATANTE fornecerá informações, acessos e aprovações necessários ao andamento do trabalho.</p>
<h2>6. Propriedade Intelectual</h2>
<p>Os direitos patrimoniais sobre as entregas serão tratados conforme as condições aprovadas pelas partes e a quitação dos valores devidos.</p>
<h2>7. Confidencialidade e Dados Pessoais</h2>
<p>As partes deverão manter confidenciais as informações estratégicas, comerciais e técnicas recebidas durante a execução. Dados pessoais serão tratados apenas para a execução deste contrato, em conformidade com a LGPD.</p>
<h2>8. Foro</h2>
<p>Fica eleito o foro de {{contract.jurisdiction}} para dirimir controvérsias decorrentes deste contrato, salvo regra legal obrigatória em sentido diverso.</p>
`;

export const createSeedContractTemplates = (): ContractTemplate[] => [
  {
    id: "service-agreement-br",
    name: "Contrato de Prestação de Serviços",
    description: "Modelo base para projetos, recorrências e serviços avulsos.",
    category: "Serviços",
    content: serviceAgreementTemplateContent.trim(),
    variables: [
      { id: "business.name", required: true, fallback: "" },
      { id: "client.name", required: true, fallback: "" },
      { id: "service.title", required: true, fallback: "" },
      { id: "service.description", required: true, fallback: "" },
      { id: "service.scope", required: true, fallback: "" },
      { id: "service.deliverables", required: false, fallback: "entregas combinadas entre as partes" },
      { id: "service.deadline", required: false, fallback: "conforme cronograma aprovado" },
      { id: "service.revisions", required: false, fallback: "conforme proposta aprovada" },
      { id: "contract.value", required: true, fallback: "" },
      { id: "contract.paymentTerms", required: true, fallback: "" },
      { id: "contract.startDate", required: true, fallback: "" },
      { id: "contract.endDate", required: false, fallback: "por prazo indeterminado" },
      { id: "contract.jurisdiction", required: false, fallback: "domicílio da CONTRATADA" },
    ],
    favorite: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  },
];
