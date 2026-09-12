"use client";

import {
  Archive,
  BookOpen,
  CalendarClock,
  CircleHelp,
  Command,
  FileSignature,
  FileText,
  LifeBuoy,
  MessageCircle,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WeekiArea } from "./sidebar";

type HelpCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  action: string;
  area: WeekiArea;
};

const helpCards: HelpCard[] = [
  {
    title: "Serviços e vitrine",
    description:
      "Cadastre serviços, publique na vitrine e receba contratações com checkout.",
    icon: ShoppingBag,
    action: "Abrir Serviços",
    area: "services",
  },
  {
    title: "Orçamentos",
    description:
      "Monte propostas, aprove com o cliente e converta em cobrança ou contrato.",
    icon: FileText,
    action: "Abrir Orçamentos",
    area: "quotes",
  },
  {
    title: "Agenda",
    description:
      "Configure disponibilidade, tipos de evento e páginas públicas de agendamento.",
    icon: CalendarClock,
    action: "Abrir Agenda",
    area: "appointments",
  },
  {
    title: "Cobranças",
    description:
      "Crie cobranças, acompanhe vencimentos e conecte provedores de pagamento.",
    icon: ReceiptText,
    action: "Abrir Cobranças",
    area: "billing",
  },
  {
    title: "Contratos",
    description:
      "Gere contratos, preserve versões e acompanhe assinatura eletrônica.",
    icon: FileSignature,
    action: "Abrir Contratos",
    area: "contracts",
  },
  {
    title: "Arquivados",
    description:
      "Restaure demandas, serviços, modelos, contratos e relatórios arquivados.",
    icon: Archive,
    action: "Abrir Arquivados",
    area: "archives",
  },
];

const faqs = [
  {
    question: "Onde configuro minha vitrine pública?",
    answer:
      "Acesse Serviços para pré-visualizar a vitrine ou Configurações > Vitrine para editar slug, identidade pública, WhatsApp, e-mail e SEO.",
  },
  {
    question: "O que acontece quando arquivo um item?",
    answer:
      "Ele sai das listas ativas, mas continua salvo com histórico. Use Arquivados para restaurar quando precisar.",
  },
  {
    question: "Como faço uma cobrança a partir de uma contratação?",
    answer:
      "Em Serviços > Contratações, abra a ação de conversão para cobrança. A Weeki cria um rascunho com os dados do serviço e do cliente.",
  },
  {
    question: "Quais atalhos posso usar?",
    answer:
      "Use Ctrl+K para abrir comandos rápidos e N, dentro de Minha Semana, para criar uma demanda no dia atual.",
  },
];

export function HelpScreen({
  onNavigate,
  inboxCount,
  archivedCount,
}: {
  onNavigate: (area: WeekiArea) => void;
  inboxCount: number;
  archivedCount: number;
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-6 bg-gradient-to-br from-[#171329] via-[#2f245f] to-[#7657ff] p-6 text-white lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Central de ajuda
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em]">
              Ajuda ativa para operar a Weeki com segurança.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
              Encontre rapidamente os módulos principais, veja respostas curtas
              e confira caminhos recomendados para publicar, cobrar, assinar e
              recuperar itens arquivados.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => onNavigate("services")}
                className="h-9 rounded-md bg-white text-xs font-semibold text-[#3d2e8f] hover:bg-white/90"
              >
                <Sparkles className="size-3.5" /> Começar por Serviços
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate("settings")}
                className="h-9 rounded-md border-white/20 bg-white/10 text-xs text-white hover:bg-white/15"
              >
                <Settings className="size-3.5" /> Configurações
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Status do workspace</p>
                <p className="text-xs text-white/60">
                  Dados locais preservados
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <StatusBox label="Caixa de entrada" value={inboxCount} />
              <StatusBox label="Arquivados" value={archivedCount} />
            </div>
            <p className="mt-4 rounded-xl bg-black/10 p-3 text-xs leading-5 text-white/68">
              Dica: revise Configurações antes de publicar links públicos ou
              ativar pagamentos externos.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {helpCards.map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[#efedff] text-[#654ce4]">
              <card.icon className="size-4" />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              {card.title}
            </h2>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
              {card.description}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigate(card.area)}
              className="mt-4 h-8 text-[11px]"
            >
              {card.action}
            </Button>
          </article>
        ))}
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CircleHelp className="size-4 text-[#654ce4]" />
            <h2 className="text-sm font-semibold text-slate-900">
              Perguntas frequentes
            </h2>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {faqs.map((item) => (
              <div key={item.question} className="py-3 first:pt-0 last:pb-0">
                <p className="text-xs font-semibold text-slate-800">
                  {item.question}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Command className="size-4 text-[#654ce4]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Atalhos úteis
              </h2>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-500">
              <Shortcut label="Ctrl + K" description="Abrir comandos rápidos" />
              <Shortcut label="N" description="Nova demanda na semana" />
              <Shortcut label="Esc" description="Fechar janelas e menus" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-[#654ce4]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Precisa de suporte?
              </h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Esta versão traz ajuda contextual dentro do próprio produto. Para
              suporte humano, mantenha seus canais oficiais de WhatsApp/e-mail
              configurados em Configurações.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("settings")}
                className="h-8 justify-start text-[11px]"
              >
                <MessageCircle className="size-3.5" /> Revisar canais
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate("finance")}
                className="h-8 justify-start text-[11px]"
              >
                <WalletCards className="size-3.5" /> Conferir financeiro
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <BookOpen className="size-5 text-slate-400" />
            <p className="mt-3 text-xs font-semibold text-slate-700">
              Guia rápido
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Serviços publicam a oferta, Orçamentos formalizam a proposta,
              Cobranças recebem o pagamento e Contratos organizam a assinatura.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-[10px] uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Shortcut({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span>{description}</span>
      <kbd className="rounded-md border bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
        {label}
      </kbd>
    </div>
  );
}
